// Local types for Nuno AI application

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

// Local brain storage (can be extended to use database)
const DEFAULT_BRAINS: Brain[] = [
  {
    slug: "nuno-ai-knowledge",
    name: "Nuno AI Knowledge Base",
    description: "Default knowledge base for Nuno AI assistant",
    total_videos: 0,
    transcribed: 0,
    total_chunks: 0,
    avg_chunk_quality: null,
    health_status: "healthy",
    last_synced: new Date().toISOString(),
  },
];

export function getBrains(): Brain[] {
  return DEFAULT_BRAINS;
}

export function getBrainBySlug(slug: string): Brain | undefined {
  return DEFAULT_BRAINS.find(b => b.slug === slug);
}
