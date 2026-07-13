// Local types for Nuno AI application

export interface VideoStats {
  video_id: string;
  video_title: string;
  channel_name: string;
  youtube_url: string;
  chunk_count: number;
  created_at: string;
}

export interface VideoChunk {
  id: string;
  video_id: string;
  video_title: string;
  channel_name: string;
  youtube_url: string;
  chunk_index: number;
  content: string;
  similarity?: number;
}

export interface Brain {
  slug: string;
  name: string;
  description?: string;
  channels?: number;
  total_videos?: number;
  transcribed?: number;
  total_chunks?: number;
  avg_chunk_quality?: number | null;
  health_status?: string;
  last_synced?: string;
}

export interface ChatSource {
  video_title?: string;
  channel_name?: string;
  youtube_url?: string;
  is_primary?: boolean;
  similarity?: number;
}

// Fetch brains from Supabase or use defaults
export async function getBrains(): Promise<Brain[]> {
  try {
    const { getSupabaseClient } = await import("@/lib/supabase-client");
    const supabase = getSupabaseClient();

    // Try to fetch from brain_stats view
    const { data, error } = await supabase
      .from('brain_stats')
      .select('*');

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.error('Error fetching brains from Supabase:', err);
  }

  // Fallback to default
  return [{
    slug: "nuno-ai-knowledge",
    name: "Nuno AI Knowledge Base",
    description: "Default knowledge base for Nuno AI assistant",
    total_videos: 0,
    transcribed: 0,
    total_chunks: 0,
    avg_chunk_quality: null,
    health_status: "healthy",
    last_synced: new Date().toISOString(),
  }];
}

export async function getBrainBySlug(slug: string): Promise<Brain | undefined> {
  const brains = await getBrains();
  return brains.find(b => b.slug === slug);
}
