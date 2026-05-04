const YBR_API_URL = process.env.YBR_API_URL!;

export function ybrUrl(path: string): string {
  return `${YBR_API_URL}${path}`;
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
