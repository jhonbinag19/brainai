import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';
import { sendConfirmationEmail } from '@/lib/mailgun';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Always use Nuno AI domain
    const nunoAiDomain = process.env.NEXT_PUBLIC_APP_URL || 'https://nunoai-brain.vercel.app';

    const supabase = getSupabaseClient();

    // Create user without email confirmation (disabled in Supabase)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${nunoAiDomain}/auth/callback`,
        data: { email_confirm: false }
      }
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Send confirmation email via Mailgun
    const confirmUrl = `${nunoAiDomain}/auth/confirm?email=${encodeURIComponent(email)}`;
    const emailSent = await sendConfirmationEmail(email, confirmUrl);

    if (!emailSent) {
      console.error('Failed to send confirmation email, but user was created');
    }

    return NextResponse.json({
      success: true,
      message: 'Account created. Please check your email to confirm your account.',
      emailSent,
      user: data.user ? { id: data.user.id, email: data.user.email } : null
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
