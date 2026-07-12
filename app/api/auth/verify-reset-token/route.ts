import { NextRequest, NextResponse } from 'next/server';
import { verifyPasswordResetToken } from '@/lib/password-reset';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify token and get associated email
    const email = await verifyPasswordResetToken(token);

    if (!email) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Token is valid - return associated email
    return NextResponse.json({
      valid: true,
      email
    });

  } catch (error) {
    console.error('Verify token error:', error);
    return NextResponse.json(
      { valid: false, error: 'An error occurred while verifying token' },
      { status: 500 }
    );
  }
}
