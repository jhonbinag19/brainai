import { getAdminSupabaseClient } from './supabase-admin';

export interface ResetTokenData {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  used_at?: string;
}

/**
 * Generate a cryptographically secure random token
 */
function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}

/**
 * Create a password reset token for the given email
 * Returns the token string, or null if creation fails
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  try {
    const supabase = getAdminSupabaseClient();

    // Generate a secure random token
    const token = generateToken(32);

    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Insert the token into the database
    const { error } = await (supabase as any)
      .from('password_reset_tokens')
      .insert({
        email,
        token,
        expires_at: expiresAt,
        used: false
      });

    if (error) {
      console.error('Error creating password reset token:', error);
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error in createPasswordResetToken:', error);
    return null;
  }
}

/**
 * Verify a password reset token and return the associated email
 * Returns null if token is invalid, expired, or already used
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  try {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await (supabase as any)
      .from('password_reset_tokens')
      .select('email, expires_at, used')
      .eq('token', token)
      .single();

    if (error || !data) {
      console.error('Error verifying token:', error);
      return null;
    }

    // Check if token is expired
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }

    // Check if token is already used
    if (data.used) {
      return null;
    }

    return data.email;
  } catch (error) {
    console.error('Error in verifyPasswordResetToken:', error);
    return null;
  }
}

/**
 * Mark a password reset token as used
 * Returns true if successful, false otherwise
 */
export async function markTokenAsUsed(token: string): Promise<boolean> {
  try {
    const supabase = getAdminSupabaseClient();

    const { error } = await (supabase as any)
      .from('password_reset_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('token', token);

    if (error) {
      console.error('Error marking token as used:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markTokenAsUsed:', error);
    return false;
  }
}

/**
 * Invalidate all existing tokens for an email (useful when user requests a new reset)
 * Returns the number of tokens invalidated
 */
export async function invalidatePreviousTokens(email: string): Promise<number> {
  try {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await (supabase as any)
      .from('password_reset_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('used', false)
      .select('id');

    if (error) {
      console.error('Error invalidating previous tokens:', error);
      return 0;
    }

    return data?.length ?? 0;
  } catch (error) {
    console.error('Error in invalidatePreviousTokens:', error);
    return 0;
  }
}

/**
 * Clean up expired and used tokens older than 24 hours
 * Returns the number of tokens deleted
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const supabase = getAdminSupabaseClient();

    const { data, error } = await supabase.rpc('cleanup_expired_tokens');

    if (error) {
      console.error('Error cleaning up tokens:', error);
      return 0;
    }

    // The function returns a BIGINT directly
    return (data as number) ?? 0;
  } catch (error) {
    console.error('Error in cleanupExpiredTokens:', error);
    return 0;
  }
}
