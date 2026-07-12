-- ============================================
-- Password Reset Tokens Table
-- ============================================
-- Stores password reset tokens with expiration
-- Enables password reset functionality across
-- multiple serverless instances (Vercel)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx
  ON public.password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx
  ON public.password_reset_tokens(email);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
  ON public.password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS password_reset_tokens_used_idx
  ON public.password_reset_tokens(used);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Service role has full access" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "No direct access for users" ON public.password_reset_tokens;

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access" ON public.password_reset_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: No access for anon/auth users (only via API)
CREATE POLICY "No direct access for users" ON public.password_reset_tokens
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Create a function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < NOW()
    OR (used = TRUE AND used_at < NOW() - INTERVAL '24 hours');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute on cleanup function to service role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tokens() TO service_role;

-- Comments
COMMENT ON TABLE public.password_reset_tokens IS 'Stores password reset tokens with expiration for secure password resets across serverless instances';
COMMENT ON FUNCTION public.cleanup_expired_tokens() IS 'Cleans up expired and used password reset tokens older than 24 hours';
