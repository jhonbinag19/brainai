import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";

/**
 * GET /api/knowledge/videos
 * List all videos in the knowledge base with stats
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Get unique videos with aggregated stats
    const { data: videos, error } = await supabase.rpc('get_video_stats', {
      order_by: 'created_at',
      order_dir: 'DESC'
    } as any) as any;

    if (error) {
      // Fallback: Query directly if RPC doesn't exist
      const { data: chunks } = await supabase
        .from('video_chunks')
        .select('video_id, video_title, channel_name, youtube_url, created_at')
        .order('created_at', { ascending: false });

      // Aggregate by video_id
      const videoMap = new Map();
      for (const chunk of chunks || []) {
        if (!videoMap.has(chunk.video_id)) {
          videoMap.set(chunk.video_id, {
            video_id: chunk.video_id,
            video_title: chunk.video_title,
            channel_name: chunk.channel_name,
            youtube_url: chunk.youtube_url,
            created_at: chunk.created_at,
            chunk_count: 0,
          });
        }
        const video = videoMap.get(chunk.video_id);
        video.chunk_count++;
      }

      return NextResponse.json({
        success: true,
        videos: Array.from(videoMap.values()),
        total: videoMap.size,
      });
    }

    return NextResponse.json({
      success: true,
      videos,
      total: videos?.length || 0,
    });
  } catch (err) {
    console.error('List videos error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
