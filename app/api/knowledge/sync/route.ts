import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";
import { fetchYoutubeTranscript, extractVideoId } from "@/lib/youtube-transcript";

/**
 * POST /api/knowledge/sync
 * Sync a YouTube channel or playlist to the knowledge base
 *
 * Body: {
 *   type: 'channel' | 'playlist' | 'video'
 *   url: string
 *   maxVideos?: number (default: 50)
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, url, maxVideos = 50 } = body;

    if (!type || !url) {
      return NextResponse.json(
        { error: "Type and URL are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    if (type === 'video') {
      // Single video sync
      const videoId = extractVideoId(url);
      if (!videoId) {
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
      }

      const { transcript, title: fetchedTitle, lengthSecs, viewCount, publishDate } =
        await fetchYoutubeTranscript(videoId);

      if (!transcript || transcript.trim().length < 50) {
        return NextResponse.json(
          { error: "Transcript too short or unavailable" },
          { status: 400 }
        );
      }

      const videoTitle = fetchedTitle || `YouTube: ${videoId}`;
      const chunks = chunkText(transcript);

      // Check if video already exists
      const { data: existing } = await supabase
        .from('video_chunks')
        .select('video_id')
        .eq('video_id', videoId)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase.from('video_chunks').delete().eq('video_id', videoId);
      }

      // Insert chunks
      const chunkData = chunks.map((content, chunk_index) => ({
        video_id: videoId,
        video_title: videoTitle,
        channel_name: 'Unknown',
        youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
        chunk_index,
        content,
      }));

      await supabase.from('video_chunks').insert(chunkData);

      return NextResponse.json({
        success: true,
        ingested: 1,
        videos: [{ videoId, title: videoTitle, chunks: chunks.length }],
      });
    }

    if (type === 'playlist') {
      const playlistId = extractPlaylistId(url);
      if (!playlistId) {
        return NextResponse.json({ error: "Invalid playlist URL" }, { status: 400 });
      }

      // For playlist sync, we'd need the YouTube Data API
      // For now, return a message about API requirement
      return NextResponse.json({
        error: "Playlist sync requires YouTube Data API configuration. Set YOUTUBE_API_KEY in environment.",
        videos: [],
      });
    }

    if (type === 'channel') {
      // For channel sync, we'd need the YouTube Data API
      return NextResponse.json({
        error: "Channel sync requires YouTube Data API configuration. Set YOUTUBE_API_KEY in environment.",
        videos: [],
      });
    }

    return NextResponse.json({ error: "Invalid sync type" }, { status: 400 });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * Extract playlist ID from various YouTube URL formats
 */
function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Chunk text into manageable pieces
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
