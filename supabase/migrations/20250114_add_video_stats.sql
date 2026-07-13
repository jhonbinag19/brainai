-- Create helper function to get video statistics
CREATE OR REPLACE FUNCTION get_video_stats(
  order_by TEXT DEFAULT 'created_at',
  order_dir TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
  video_id TEXT,
  video_title TEXT,
  channel_name TEXT,
  youtube_url TEXT,
  chunk_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vc.video_id,
    vc.video_title,
    vc.channel_name,
    vc.youtube_url,
    COUNT(*) as chunk_count,
    MAX(vc.created_at) as created_at
  FROM video_chunks vc
  GROUP BY vc.video_id, vc.video_title, vc.channel_name, vc.youtube_url
  ORDER BY
    CASE
      WHEN order_by = 'created_at' AND order_dir = 'DESC' THEN MAX(vc.created_at) END DESC,
    CASE
      WHEN order_by = 'created_at' AND order_dir = 'ASC' THEN MAX(vc.created_at) END ASC,
    CASE
      WHEN order_by = 'video_title' AND order_dir = 'DESC' THEN vc.video_title END DESC,
    CASE
      WHEN order_by = 'video_title' AND order_dir = 'ASC' THEN vc.video_title END ASC,
    CASE
      WHEN order_dir = 'DESC' THEN COUNT(*) END DESC,
    CASE
      WHEN order_dir = 'ASC' THEN COUNT(*) END ASC;
END;
$$;

-- Add comment
COMMENT ON FUNCTION get_video_stats IS 'Returns aggregated statistics for all videos in the knowledge base';
