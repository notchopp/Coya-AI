import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, business_id, role } = body;

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

    const supabaseAdmin = getSupabaseAdminClient();

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
      const user = existingUser as { id: string; email: string; auth_user_id: string | null; business_id: string };
      const hasAuthAccount = user.auth_user_id !== null && user.auth_user_id !== undefined;
      
      if (hasAuthAccount) {
        // User already has auth account
        return NextResponse.json(
          { error: "User already exists and has an account. They can sign in directly." },
          { status: 400 }
        );
      }
      // User exists but no auth_user_id - we'll update it after invite
      userId = user.id;
    } else {
      // Step 2: Create user record in users table (without auth_user_id initially)
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          email: email,
          business_id: business_id,
          is_active: true,
          role: role || "user",
        } as any)
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

    // Step 4: If user was created, update it with auth_user_id
    if (inviteData?.user && userId) {
      const user = existingUser as { id: string; auth_user_id: string | null } | null;
      const needsAuthLink = !user || !user.auth_user_id;
      
      if (needsAuthLink) {
        const { error: updateError } = await (supabaseAdmin
          .from("users") as any)
          .update({ auth_user_id: inviteData.user.id })
          .eq("id", userId);

        if (updateError) {
          console.error("Error updating user auth_user_id:", updateError);
          // Don't fail the request, but log the error
          // The callback page will handle linking by email
        }
      }
    }

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

