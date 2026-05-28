import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

/**
 * Server-only admin client with full permissions.
 * DO NOT import this in client components.
 */
export function getAdminSupabaseClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}