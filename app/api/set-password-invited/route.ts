import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const supabase = getSupabaseClient();

    // Check if email exists in users table without auth_user_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, auth_user_id, business_id, program_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (userError) {
      return NextResponse.json(
        { error: "Failed to check user", details: userError.message },
        { status: 500 }
      );
    }

    if (!userData) {
      return NextResponse.json(
        { error: "This email is not registered. Please contact your administrator." },
        { status: 400 }
      );
    }

    const user = userData as { id: string; email: string; auth_user_id: string | null; business_id: string; program_id: string | null };

    if (user.auth_user_id) {
      return NextResponse.json(
        { error: "This email already has an account. Please sign in instead." },
        { status: 400 }
      );
    }

    // Find the auth user by email (created by invite)
    // Use listUsers with page size to find the user
    let authUser = null;
    let page = 1;
    const pageSize = 1000; // Max page size
    
    while (!authUser) {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: page,
        perPage: pageSize,
      });
      
      if (listError) {
        return NextResponse.json(
          { error: "Failed to find user account", details: listError.message },
          { status: 500 }
        );
      }

      authUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      // If we found the user or there are no more pages, break
      if (authUser || authUsers.users.length === 0 || !authUsers.users.length) {
        break;
      }

      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 10) {
        break;
      }
    }

    if (!authUser) {
      // Auth user doesn't exist - this shouldn't happen if they were invited
      // But allow regular signup flow
      return NextResponse.json(
        { error: "No account found. Please use the signup form or check your invitation email." },
        { status: 400 }
      );
    }

    // Update the auth user's password using admin API
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: password }
    );

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to set password", details: updateError.message },
        { status: 500 }
      );
    }

    // Link auth_user_id to users table
    const { error: linkError } = await (supabaseAdmin
      .from("users") as any)
      .update({ auth_user_id: authUser.id })
      .eq("id", user.id);

    if (linkError) {
      console.error("Error linking auth_user_id:", linkError);
      // Don't fail - the password is set, linking can happen later
    }

    // Sign in the user to create a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    });

    if (signInError) {
      return NextResponse.json(
        { 
          success: true, 
          message: "Password set successfully. Please sign in.",
          error: "Failed to sign in automatically"
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password set successfully",
      user: {
        id: signInData.user?.id,
        email: signInData.user?.email,
      },
      business_id: user.business_id,
      program_id: user.program_id,
      session: signInData.session ? "created" : null,
    });

  } catch (error) {
    console.error("Unexpected error in set-password-invited API:", error);
    return NextResponse.json(
      { 
        error: "An unexpected error occurred", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

