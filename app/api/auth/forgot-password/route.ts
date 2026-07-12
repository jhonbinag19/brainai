import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
import { sendPasswordResetEmail } from '@/lib/mailgun';
import {
  createPasswordResetToken,
  invalidatePreviousTokens,
  cleanupExpiredTokens
} from '@/lib/password-reset';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();

    // Check if user exists
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      // Don't reveal if email exists (security best practice)
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Invalidate any previous unused tokens for this email
    await invalidatePreviousTokens(email);

    // Clean up expired tokens periodically (don't await)
    cleanupExpiredTokens().catch(err => console.error('Cleanup error:', err));

    // Generate a new reset token
    const token = await createPasswordResetToken(email);

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to generate reset token. Please try again.' },
        { status: 500 }
      );
    }

    // Create reset URL with token - always use Nuno AI domain
    const nunoAiDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://nunoai-brain.vercel.app';
    const resetUrl = `${nunoAiDomain}/auth/reset-password?token=${token}`;

    // Send email via Mailgun
    console.log('Sending password reset email to:', email, 'via Mailgun');
    const emailSent = await sendPasswordResetEmail(email, resetUrl);
    console.log('Password reset email sent result:', emailSent);

    if (!emailSent) {
      console.error('Failed to send password reset email via Mailgun');
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
      emailSent,
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
