import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  if (code) {
    // OAuth callback (e.g., Google Calendar)
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    if (data.session) {
      // Redirect to dashboard
      return NextResponse.redirect(`${requestUrl.origin}/`);
    }
  }

  if (token_hash && type === "invite") {
    // Invite token - redirect to signup page
    return NextResponse.redirect(`${requestUrl.origin}/signup?token=${token_hash}`);
  }

  // Default redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}











