import { NextResponse } from "next/server";

// Anthropic Claude API configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, brain } = body;

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

    // Call Anthropic Claude API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        stream: true,
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
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
