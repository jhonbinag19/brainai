import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAdminSupabaseClient } from "@/lib/supabase-admin";

/**
 * POST /api/chat — RAG chat over the YouTube Brain.
 *
 * Retrieval matches the RAM Studio Brain pipeline that indexes the videos:
 * Gemini embedding of the query → match_chunks (pgvector) filtered by brain
 * slug → Claude answers from the retrieved transcript chunks with citations.
 *
 * SSE events emitted: {type:"sources"} → {type:"text"}* → {type:"done"}
 * (or {type:"error"}). This is the shape ChatWindow.tsx already parses.
 */

const ANSWER_MODEL = "claude-sonnet-5";

// Must match the model/dimensions the chunks were indexed with
const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_TOP_K = 7;
const MIN_SIMILARITY = 0.3;
const DEFAULT_BRAIN_SLUG = "nuno-gohighlevel";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type ChunkRow = {
  chunk_id: string;
  content: string;
  video_title: string;
  channel_name: string;
  youtube_video_id: string;
  timestamp_start: number | null;
  similarity: number;
  is_primary_src: boolean;
};

function sseError(error: string, status: number) {
  return new Response(
    `data: ${JSON.stringify({ type: "error", error })}\n\n`,
    { status, headers: { "Content-Type": "text/event-stream" } }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, brain, conversationHistory } = body;

    if (!query?.trim()) {
      return sseError("Query is required", 400);
    }
    if (!anthropic) {
      return sseError("ANTHROPIC_API_KEY not configured", 500);
    }
    if (!genAI) {
      return sseError("GEMINI_API_KEY not configured", 500);
    }

    const supabase = getAdminSupabaseClient();
    const brainSlug = typeof brain === "string" && brain.trim() ? brain.trim() : DEFAULT_BRAIN_SLUG;

    // Validate the brain exists in the shared YouTube Brain database
    const { data: brainRow, error: brainErr } = (await supabase
      .from("brains")
      .select("id, slug, name")
      .eq("slug", brainSlug)
      .single()) as { data: { id: string; slug: string; name: string } | null; error: any };

    if (brainErr || !brainRow) {
      return sseError(`Brain "${brainSlug}" not found`, 404);
    }

    // Embed the query — prepend brain name for domain-specific embedding,
    // exactly as the indexing pipeline does
    const enrichedQuery = `${brainRow.name}: ${query}`;
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const embedResult = await model.embedContent({
      content: { role: "user", parts: [{ text: enrichedQuery }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as Parameters<typeof model.embedContent>[0]);
    const queryEmbedding = embedResult.embedding.values;

    // Dual retrieval for source diversity: primary sources fill most slots,
    // supplementary sources fill the rest
    const PRIMARY_SLOTS = DEFAULT_TOP_K - 2;
    const SUPP_SLOTS = 2;

    const [{ data: primaryData }, { data: suppData }] = await Promise.all([
      supabase.rpc("match_chunks", {
        query_embedding: queryEmbedding,
        brain_slug_in: brainSlug,
        match_count: PRIMARY_SLOTS,
        min_similarity: MIN_SIMILARITY,
        prefer_primary: true,
      } as any),
      supabase.rpc("match_chunks", {
        query_embedding: queryEmbedding,
        brain_slug_in: brainSlug,
        match_count: SUPP_SLOTS,
        min_similarity: MIN_SIMILARITY,
        prefer_primary: false,
      } as any),
    ]);

    const retrievedPrimary = (primaryData ?? []) as ChunkRow[];
    const seenIds = new Set(retrievedPrimary.map((c) => c.chunk_id));
    const uniqueSupp = ((suppData ?? []) as ChunkRow[]).filter(
      (c) => !seenIds.has(c.chunk_id)
    );
    const chunks = [...retrievedPrimary, ...uniqueSupp];

    const encoder = new TextEncoder();

    // No matching knowledge — stream a friendly message so the UI renders it
    if (chunks.length === 0) {
      const noAnswer = `I don't have enough knowledge in the ${brainRow.name} brain to answer this question yet.`;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "sources", sources: [] })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: noAnswer })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // Build the knowledge-base context for the system prompt
    const primaryChunks = chunks.filter((c) => c.is_primary_src);
    const supplementaryChunks = chunks.filter((c) => !c.is_primary_src);

    let context = "";
    if (primaryChunks.length > 0) {
      context += "## Primary Sources (cite first)\n\n";
      for (const chunk of primaryChunks) {
        context += `**[${chunk.video_title}]** (${chunk.channel_name})\n${chunk.content}\n\n`;
      }
    }
    if (supplementaryChunks.length > 0) {
      context += "## Supplementary Sources\n\n";
      for (const chunk of supplementaryChunks) {
        context += `**[${chunk.video_title}]** (${chunk.channel_name})\n${chunk.content}\n\n`;
      }
    }

    const systemPrompt = [
      `You are the ${brainRow.name} assistant. Answer using ONLY the source content below. Never hallucinate.`,
      `Cite video titles. Primary sources first, supplementary as "Also referenced from:".`,
      `## Knowledge Base\n\n${context}`,
    ].join("\n\n");

    // Conversation history (if the client sends it) + current query
    const messages: Anthropic.MessageParam[] = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-40)) {
        if ((msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: "user", content: query });

    const sources = chunks.map((chunk) => ({
      video_title: chunk.video_title,
      channel_name: chunk.channel_name,
      youtube_url: chunk.timestamp_start
        ? `https://www.youtube.com/watch?v=${chunk.youtube_video_id}&t=${Math.floor(chunk.timestamp_start)}`
        : `https://www.youtube.com/watch?v=${chunk.youtube_video_id}`,
      is_primary: chunk.is_primary_src,
      similarity: Math.round(chunk.similarity * 1000) / 1000,
    }));

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Sources are known before Claude responds — send them first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
          );

          const claudeStream = anthropic.messages.stream({
            model: ANSWER_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages,
          });

          for await (const event of claudeStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`)
              );
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`)
          );
          controller.close();
        }
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
    const errMsg = err instanceof Error ? err.message : String(err);
    return sseError(errMsg, 500);
  }
}
