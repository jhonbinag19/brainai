import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase-admin";
import { verifyConfirmToken, normalizeEmail } from "@/lib/email-confirm";

/**
 * POST /api/auth/confirm — actually confirm a user's email in Supabase Auth.
 *
 * The previous flow only *displayed* "confirmed" client-side; the account
 * stayed unconfirmed and Supabase rejected every sign-in with
 * email_not_confirmed (shown to users as "incorrect password").
 */
export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and token are required" },
        { status: 400 }
      );
    }

    if (!verifyConfirmToken(email, token)) {
      return NextResponse.json(
        { error: "Invalid confirmation link. Please request a new one by signing up again or resetting your password." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabaseClient();
    const target = normalizeEmail(email);
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("Error listing users:", listError);
      return NextResponse.json({ error: "Failed to confirm email" }, { status: 500 });
    }

    const user = users.find((u) => normalizeEmail(u.email ?? "") === target);

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!user.email_confirmed_at) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updateError) {
        console.error("Error confirming email:", updateError);
        return NextResponse.json({ error: "Failed to confirm email" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Email confirmed. You can now sign in." });
  } catch (error) {
    console.error("Confirm email error:", error);
    return NextResponse.json({ error: "An error occurred while confirming email" }, { status: 500 });
  }
}
