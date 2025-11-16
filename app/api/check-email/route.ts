import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Check if email exists in users table
    // Try with program_id first, fallback if column doesn't exist
    let userData: any = null;
    let userError: any = null;
    
    const result = await supabaseAdmin
      .from("users")
      .select("id, email, auth_user_id, business_id, program_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    
    if (result.error && result.error.message?.includes("program_id")) {
      // Retry without program_id
      const retryResult = await supabaseAdmin
        .from("users")
        .select("id, email, auth_user_id, business_id")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      userData = retryResult.data;
      userError = retryResult.error;
    } else {
      userData = result.data;
      userError = result.error;
    }

    if (userError && userError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to check email", details: userError.message },
        { status: 500 }
      );
    }

    if (!userData) {
      return NextResponse.json(
        { exists: false, message: "This email is not registered. Please contact your administrator to be added to the system." },
        { status: 200 }
      );
    }

    const user = userData as { id: string; email: string; auth_user_id: string | null; business_id: string; program_id?: string | null };

    if (user.auth_user_id) {
      return NextResponse.json({
        exists: true,
        hasAuth: true,
        message: "This email already has an account. Please sign in instead."
      });
    }

    // Email exists but no auth account
    return NextResponse.json({
      exists: true,
      hasAuth: false,
      user: {
        id: user.id,
        email: user.email,
        business_id: user.business_id,
        program_id: user.program_id || null
      }
    });

  } catch (error) {
    console.error("Unexpected error in check-email API:", error);
    return NextResponse.json(
      { 
        error: "An unexpected error occurred", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}





