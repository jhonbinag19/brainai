import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";
import { fetchYoutubeTranscript, extractVideoId } from "@/lib/youtube-transcript";

/**
 * POST /api/knowledge/youtube
 * Add a YouTube video transcript to the knowledge base
 *
 * Body: { url: string, title?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, title } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Fetch transcript
    const { transcript, title: fetchedTitle, lengthSecs, viewCount, publishDate } =
      await fetchYoutubeTranscript(videoId);

    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json({ error: "Transcript too short or unavailable" }, { status: 400 });
    }

    const videoTitle = title || fetchedTitle || `YouTube: ${videoId}`;

    // Chunk the transcript for better search
    const chunks = chunkText(transcript);

    const supabase = getSupabaseClient();

    // Check if video already exists
    const { data: existing } = await supabase
      .from('video_chunks')
      .select('video_id')
      .eq('video_id', videoId)
      .limit(1);

    // Delete existing chunks for this video if any
    if (existing && existing.length > 0) {
      await supabase.from('video_chunks').delete().eq('video_id', videoId);
    }

    // Insert chunks
    const chunkData = chunks.map((content, chunk_index) => ({
      video_id: videoId,
      video_title: videoTitle,
      channel_name: 'Unknown', // Will be updated if we add channel fetching
      youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
      chunk_index,
      content,
    }));

    const { error } = await supabase.from('video_chunks').insert(chunkData as any);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      videoId,
      title: videoTitle,
      chunks: chunks.length,
      lengthSecs,
      viewCount,
      publishDate,
    });
  } catch (err) {
    console.error('YouTube ingestion error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * Chunk text into manageable pieces for search
 */
function chunkText(text: string): string[] {
  const CHUNK_SIZE = 1200;
  const CHUNK_OVERLAP = 100;

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(' ');
      current = words.slice(-Math.floor(CHUNK_OVERLAP / 5)).join(' ') + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(c => c.length > 50);
}
