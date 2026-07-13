import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const brain = searchParams.get("brain");

    if (!q?.trim()) {
      return NextResponse.json({ results: [] });
    }

    const supabase = getSupabaseClient();

    // Search video chunks using the Supabase function
    const { data: chunks, error } = await supabase
      .rpc('search_video_chunks', {
        search_query: q,
        match_count: 100
      } as any) as any;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ results: [], error: error.message });
    }

    const results = (chunks && chunks.length > 0) ? chunks.map((chunk: any) => ({
      id: chunk.id,
      title: chunk.video_title,
      content: chunk.content,
      similarity: chunk.similarity,
      metadata: {
        video_id: chunk.video_id,
        channel_name: chunk.channel_name,
        youtube_url: chunk.youtube_url,
        brain: brain || "default",
      },
    })) : [];

    return NextResponse.json({ query: q, results });
  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
