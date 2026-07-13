-- Create video_chunks table for RAG chat
-- This stores transcript chunks from indexed videos

CREATE TABLE IF NOT EXISTS video_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for search performance
CREATE INDEX IF NOT EXISTS idx_video_chunks_video_id ON video_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_content_gin ON video_chunks USING gin(to_tsvector('english', content));

-- Create full-text search function
CREATE OR REPLACE FUNCTION search_video_chunks(search_query TEXT, match_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  video_id TEXT,
  video_title TEXT,
  channel_name TEXT,
  youtube_url TEXT,
  chunk_index INTEGER,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vc.id,
    vc.video_id,
    vc.video_title,
    vc.channel_name,
    vc.youtube_url,
    vc.chunk_index,
    vc.content,
    ts_rank(to_tsvector('english', vc.content), query) as similarity
  FROM video_chunks vc,
       plainto_tsquery('english', search_query) query
  WHERE to_tsvector('english', vc.content) @@ query
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_video_chunks_updated_at BEFORE UPDATE
  ON video_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for brain statistics
CREATE OR REPLACE VIEW brain_stats AS
SELECT
  'nuno-ai-knowledge' as slug,
  'Nuno AI Knowledge Base' as name,
  'Default knowledge base for Nuno AI assistant' as description,
  COUNT(DISTINCT video_id) as total_videos,
  COUNT(DISTINCT video_id) as transcribed,
  COUNT(*) as total_chunks,
  NULL::NUMERIC as avg_chunk_quality,
  'healthy' as health_status,
  MAX(created_at)::TEXT as last_synced
FROM video_chunks;
