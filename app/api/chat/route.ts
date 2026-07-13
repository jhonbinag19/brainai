import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";

// Anthropic Claude API configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface VideoChunk {
  id: string;
  video_id: string;
  video_title: string;
  channel_name: string;
  youtube_url: string;
  content: string;
  similarity?: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, brain, conversationHistory } = body;

    if (!query?.trim()) {
      return new Response(
        `data: {"type":"error","error":"Query is required"}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        `data: {"type":"error","error":"ANTHROPIC_API_KEY not configured"}\n\n`,
        { status: 500, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    // Search for relevant video chunks in Supabase
    let contextChunks: VideoChunk[] = [];
    let sources: any[] = [];

    try {
      const supabase = getSupabaseClient();

      // Try to search using full-text search or vector similarity
      // This searches for video chunks that match the query
      const { data: chunks, error } = await supabase
        .rpc('search_video_chunks', {
          search_query: query,
          match_count: 50
        } as any) as any;

      if (!error && chunks && chunks.length > 0) {
        contextChunks = chunks;
        // Deduplicate sources by video_id
        const uniqueSources = new Map();
        for (const chunk of chunks) {
          if (!uniqueSources.has(chunk.video_id)) {
            uniqueSources.set(chunk.video_id, {
              video_title: chunk.video_title,
              channel_name: chunk.channel_name,
              youtube_url: chunk.youtube_url,
              similarity: chunk.similarity,
            });
          }
        }
        sources = Array.from(uniqueSources.values());

        console.log(`Found ${chunks.length} relevant chunks for query`);
      } else {
        // Fallback: Try direct text search if RPC doesn't exist
        const { data: fallbackChunks } = await supabase
          .from('video_chunks')
          .select('*')
          .textSearch('content', query)
          .limit(50);

        if (fallbackChunks) {
          contextChunks = fallbackChunks;
          sources = fallbackChunks.map((chunk: VideoChunk) => ({
            video_title: chunk.video_title,
            channel_name: chunk.channel_name,
            youtube_url: chunk.youtube_url,
          }));
        }
      }
    } catch (searchError) {
      console.error('Video search error (continuing without context):', searchError);
    }

    // Build messages array with conversation history
    const messages: Message[] = [];

    // Add system prompt with context from video chunks
    if (contextChunks.length > 0) {
      const contextText = contextChunks
        .map((chunk, i) => `[Source ${i + 1}: ${chunk.video_title} by ${chunk.channel_name}]\n${chunk.content}`)
        .join('\n\n');

      messages.push({
        role: "user",
        content: `You are a helpful AI assistant with access to a knowledge base of video transcripts. Your goal is to answer questions accurately using the provided context while being transparent about your sources.

IMPORTANT INSTRUCTIONS:
1. Use the video transcript excerpts below to answer the user's question
2. Always cite which video(s) you're getting information from using the video title
3. If multiple videos provide relevant information, synthesize them together
4. If the context doesn't contain enough information to fully answer, admit this and suggest what additional context would help
5. For factual claims, indicate the source video
6. You can speak conversationally while staying grounded in the provided context

Relevant Video Context:
${contextText}

Now, answer the user's question based on the above video transcripts.`,
      });
    }

    // Add conversation history if provided (for long conversations)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Take last 100 messages to manage context window (adjust as needed)
      const recentHistory = conversationHistory.slice(-100);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    // Add current query
    messages.push({
      role: "user",
      content: query,
    });

    // Send sources first if we have them
    if (sources.length > 0) {
      const sourcesEvent = `data: ${JSON.stringify({ type: "sources", sources })}\n\n`;
      // We'll send this after starting the stream
    }

    // Call Anthropic Claude API with extended settings for long conversations
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 81920,
        stream: true,
        messages,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      return new Response(
        `data: {"type":"error","error":"Claude API error: ${errorText}"}\n\n`,
        { status: response.status || 500, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    // Transform Claude's streaming format to our SSE format
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = "";
          let sourcesSent = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Send done event
              controller.enqueue(new TextEncoder().encode(`data: {"type":"done"}\n\n`));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const json = line.slice(6);
                try {
                  const parsed = JSON.parse(json);

                  // Send sources before first text chunk
                  if (sources.length > 0 && !sourcesSent && parsed.type === "content_block_start") {
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
                    );
                    sourcesSent = true;
                  }

                  // Handle different event types from Claude
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: {"type":"text","text":"${escapeJSON(parsed.delta.text)}"}\n\n`
                      )
                    );
                  } else if (parsed.type === "message_stop") {
                    controller.enqueue(new TextEncoder().encode(`data: {"type":"done"}\n\n`));
                    controller.close();
                    return;
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          controller.close();
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      `data: {"type":"error","error":"${escapeJSON(String(err))}"}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }
}

// Helper to escape JSON strings
function escapeJSON(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
