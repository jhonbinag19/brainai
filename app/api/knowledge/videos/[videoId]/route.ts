import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";

/**
 * DELETE /api/knowledge/videos/:videoId
 * Remove a video and all its chunks from the knowledge base
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const supabase = getSupabaseClient();

    // Delete all chunks for this video
    const { error } = await supabase
      .from('video_chunks')
      .delete()
      .eq('video_id', videoId);

    if (error) {
      console.error('Delete video error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: videoId,
    });
  } catch (err) {
    console.error('Delete video error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
