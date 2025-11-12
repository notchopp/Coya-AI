import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logUserInvite, getClientIP, getUserAgent } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error("Failed to parse request body:", jsonError);
      return NextResponse.json(
        { error: "Invalid request body", details: "Request must be valid JSON" },
        { status: 400 }
      );
    }
    
    const { email, business_id, role, program_id } = body;

    // Validate input
    if (!email || !business_id) {
      return NextResponse.json(
        { error: "Email and business_id are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdminClient();
    } catch (adminError) {
      const errorMessage = adminError instanceof Error ? adminError.message : "Failed to initialize admin client";
      console.error("❌ Failed to create Supabase admin client:", errorMessage);
      console.error("Full error:", adminError);
      
      // Check if it's specifically about missing env vars
      if (errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY") || errorMessage.includes("Missing Supabase admin envs")) {
        return NextResponse.json(
          { 
            error: "Server configuration error", 
            details: "SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env.local file and restart your dev server. Get it from Supabase Dashboard → Settings → API → service_role key."
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          details: errorMessage
        },
        { status: 500 }
      );
    }

    // Step 1: Check if user already exists in users table
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, email, auth_user_id, business_id")
      .eq("email", email)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "not found" which is fine
      console.error("Error checking existing user:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing user", details: checkError.message },
        { status: 500 }
      );
    }

    let userId: string | null = null;

    if (existingUser) {
      // User exists in users table
      // Type assertion needed because Supabase types can be complex
      const user = existingUser as { id: string; email: string; auth_user_id: string | null; business_id: string; program_id: string | null };
      const hasAuthAccount = user.auth_user_id !== null && user.auth_user_id !== undefined;
      
      if (hasAuthAccount) {
        // User already has auth account
        return NextResponse.json(
          { error: "User already exists and has an account. They can sign in directly." },
          { status: 400 }
        );
      }
      // User exists but no auth_user_id - update program_id if provided
      userId = user.id;
      
      // Update program_id if provided and different from current
      if (program_id && user.program_id !== program_id) {
        const { error: updateError } = await (supabaseAdmin
          .from("users") as any)
          .update({ program_id: program_id })
          .eq("id", userId);
        
        if (updateError) {
          console.error("Error updating program_id:", updateError);
          // Don't fail - continue with invite
        }
      }
    } else {
      // Step 2: Create user record in users table (without auth_user_id initially)
      const userData: any = {
        email: email,
        business_id: business_id,
        is_active: true,
        role: role || "user",
      };
      
      // Add program_id if provided
      if (program_id) {
        userData.program_id = program_id;
      }
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert(userData)
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating user record:", createError);
        return NextResponse.json(
          { error: "Failed to create user record", details: createError.message },
          { status: 500 }
        );
      }

      userId = (newUser as { id: string }).id;
    }

    // Step 3: Invite the user via Supabase Auth with business_id in metadata
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/auth/callback`,
        data: {
          business_id: business_id,
          role: role || "user",
          program_id: program_id || null,
        }
      }
    );

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      
      // If invite fails, clean up the user record we created
      if (!existingUser) {
        await supabaseAdmin
          .from("users")
          .delete()
          .eq("id", userId);
      }
      
      return NextResponse.json(
        { error: "Failed to send invitation", details: inviteError.message },
        { status: 500 }
      );
    }

    // Step 4: Don't link auth_user_id yet - wait until user sets password
    // The signup page will link auth_user_id after password is created
    // This allows users to sign up even if they were invited (email exists in users table)

    // Log audit event for user invitation
    // Get inviter user ID from auth header or request
    const authHeader = request.headers.get("authorization");
    let inviterUserId: string | undefined;
    if (authHeader) {
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          const { data: userData } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          if (userData) {
            inviterUserId = (userData as any).id;
          }
        }
      } catch (e) {
        // If we can't get user, log without user_id
      }
    }
    
    await logUserInvite(
      inviterUserId || "system",
      business_id,
      email,
      role || "user",
      getClientIP(request as any),
      getUserAgent(request as any)
    );

    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully",
      user: {
        email: inviteData?.user?.email,
        id: inviteData?.user?.id,
      }
    });

  } catch (error) {
    console.error("Unexpected error in invite-user API:", error);
    
    // Check if it's a missing env variable error
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          details: "SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env.local file and Vercel environment variables." 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "An unexpected error occurred", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

