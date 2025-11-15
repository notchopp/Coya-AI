import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { user_id, auth_user_id } = await request.json();

    if (!user_id || !auth_user_id) {
      return NextResponse.json(
        { error: "user_id and auth_user_id are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Link auth_user_id to users table using admin client (bypasses RLS)
    const { error: updateError } = await (supabaseAdmin
      .from("users") as any)
      .update({ auth_user_id: auth_user_id })
      .eq("id", user_id);

    if (updateError) {
      console.error("Error linking auth_user_id:", updateError);
      return NextResponse.json(
        { error: "Failed to link auth user", details: updateError.message },
        { status: 500 }
      );
    }

    // Also confirm the email in auth (in case it's not confirmed)
    try {
      await supabaseAdmin.auth.admin.updateUserById(auth_user_id, {
        email_confirm: true,
      });
    } catch (confirmError) {
      // Not critical if this fails
      console.log("Could not confirm email (may already be confirmed):", confirmError);
    }

    return NextResponse.json({
      success: true,
      message: "Auth user linked successfully",
    });

  } catch (error) {
    console.error("Unexpected error in link-auth-user API:", error);
    return NextResponse.json(
      { 
        error: "An unexpected error occurred", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}



