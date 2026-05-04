import { getAuthCookie } from "@/lib/auth";
import { ybrUrl } from "@/lib/ybr-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cookie = await getAuthCookie();

    const upstream = await fetch(ybrUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ message: body.query ?? body.message, brain: body.brain }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => `HTTP ${upstream.status}`);
      return new Response(text, { status: upstream.status || 500 });
    }

    // Pipe via explicit ReadableStream for reliable SSE in dev and prod
    const upstreamReader = upstream.body.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) { controller.close(); break; }
            controller.enqueue(value);
          }
        } catch {
          controller.close();
        }
      },
      cancel() {
        upstreamReader.cancel();
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
      `data: {"type":"error","error":${JSON.stringify(String(err))}}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }
}
