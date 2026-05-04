const SUPABASE_URL = process.env.YBR_SUPABASE_URL!;
const ANON_KEY = process.env.YBR_SUPABASE_ANON_KEY!;
const EMAIL = process.env.YBR_EMAIL!;
const PASSWORD = process.env.YBR_PASSWORD!;
const COOKIE_NAME = "sb-owsgwezlriohfvkogtkp-auth-token";

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let cached: Session | null = null;

async function signIn(): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Supabase sign-in failed: ${res.status}`);
  const data = await res.json();
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
}

async function refresh(refreshToken: string): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Supabase refresh failed: ${res.status}`);
  const data = await res.json();
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
}

function buildCookie(s: Session): string {
  const val = JSON.stringify({
    access_token: s.access_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: s.expires_at,
    refresh_token: s.refresh_token,
  });
  return `${COOKIE_NAME}=${encodeURIComponent(val)}`;
}

export async function getAuthCookie(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Use cached session if valid for at least 60 more seconds
  if (cached && cached.expires_at > now + 60) {
    return buildCookie(cached);
  }

  // Try refresh first, fall back to full sign-in
  if (cached?.refresh_token) {
    try {
      cached = await refresh(cached.refresh_token);
      return buildCookie(cached);
    } catch {
      // fall through to full sign-in
    }
  }

  cached = await signIn();
  return buildCookie(cached);
}
