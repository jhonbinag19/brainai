import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';
import {
  verifyPasswordResetToken,
  markTokenAsUsed
} from '@/lib/password-reset';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Verify token and get email
    const email = await verifyPasswordResetToken(token);

    if (!email) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Get the user by email using admin client
    const supabase = getAdminSupabaseClient();
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to process password reset' },
        { status: 500 }
      );
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user password using admin API. Completing a reset proves the
    // user controls this inbox, so also confirm the email — otherwise an
    // unconfirmed account still can't sign in even with the new password.
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password, email_confirm: true }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Mark the token as used
    await markTokenAsUsed(token);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Update password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating password' },
      { status: 500 }
    );
  }
}
