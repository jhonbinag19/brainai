import crypto from "crypto";

/**
 * Stateless email-confirmation tokens.
 *
 * The confirm link carries HMAC(email, server secret). Only the server can
 * mint a valid token, so possession of the link proves it came from the
 * confirmation email we sent to that address — no token table needed.
 * Server-side only (uses the service role key as the HMAC secret).
 */

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return s;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createConfirmToken(email: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`email-confirm:${normalizeEmail(email)}`)
    .digest("hex");
}

export function verifyConfirmToken(email: string, token: string): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = createConfirmToken(email);
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}
