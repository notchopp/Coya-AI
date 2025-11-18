import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cookies } from "next/headers";

/**
 * Create Business API Endpoint (Super Admin Only)
 * Creates a new business and owner user account
 */
export async function POST(request: NextRequest) {
  try {
    // Verify super admin - get session from cookies or auth header
    const supabaseAdmin = getSupabaseAdminClient();
    let isSuperAdmin = false;
    
    // Try to get token from cookies first
    const cookieStore = await cookies();
    let token: string | null = null;
    
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.includes("access-token") || cookie.name.includes("auth-token") || cookie.name.includes("supabase")) {
        try {
          const parsed = JSON.parse(cookie.value);
          token = parsed?.access_token || parsed?.token || cookie.value;
          break;
        } catch {
          token = cookie.value;
          break;
        }
      }
    }
    
    // If no token from cookies, check auth header
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader) {
        token = authHeader.replace("Bearer ", "");
      }
    }
    
    // Verify user if we have a token
    if (token) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (!authError && user) {
        const userEmail = user.email?.toLowerCase();
        const userId = user.id;
        isSuperAdmin = userEmail === "whochoppa@gmail.com" || userId === "9c0e8c58-8a36-47e9-aa68-909b22b4443f";
      }
    }
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, to_number, vertical, email, owner_name } = body;

    // Validate required fields
    if (!name || !to_number || !email) {
      return NextResponse.json(
        { error: "Missing required fields: name, to_number, email" },
        { status: 400 }
      );
    }

    // Check if phone number already exists
    const { data: existingBusiness } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("to_number", to_number)
      .maybeSingle();

    if (existingBusiness) {
      return NextResponse.json(
        { error: "A business with this phone number already exists" },
        { status: 400 }
      );
    }

    // Check if email already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Create business
    const businessResult = await (supabaseAdmin
      .from("businesses") as any)
      .insert({
        name: name.trim(),
        to_number: to_number.trim(),
        vertical: vertical || null,
        onboarding_step: 0,
        is_active: false,
      })
      .select("id, name, to_number")
      .single();

    const business = businessResult.data as { id: string; name: string; to_number: string } | null;
    const businessError = businessResult.error;

    if (businessError || !business) {
      console.error("Error creating business:", businessError);
      return NextResponse.json(
        { 
          error: "Failed to create business", 
          details: businessError ? (businessError as any).message || String(businessError) : "Unknown error" 
        },
        { status: 500 }
      );
    }

    // Create user record first (without auth_user_id - will be linked when they accept invite)
    const { data: newUser, error: userError } = await (supabaseAdmin
      .from("users") as any)
      .insert({
        business_id: business.id,
        email: email.toLowerCase(),
        full_name: owner_name || name || "Business Owner",
        role: "owner",
        owner_onboarding_completed: false,
        is_active: true,
      })
      .select("id")
      .single();

    if (userError || !newUser) {
      console.error("Error creating user record:", userError);
      // Rollback business creation
      await supabaseAdmin.from("businesses").delete().eq("id", business.id);
      return NextResponse.json(
        { error: "Failed to create user record", details: userError?.message },
        { status: 500 }
      );
    }

    // Send invitation email to the owner
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/auth/callback`,
        data: {
          business_id: business.id,
          role: "owner",
          program_id: null,
          full_name: owner_name || name || "Business Owner",
        }
      }
    );

    if (inviteError) {
      console.error("Error sending invitation:", inviteError);
      // Rollback: delete user record and business
      await supabaseAdmin.from("users").delete().eq("id", (newUser as { id: string }).id);
      await supabaseAdmin.from("businesses").delete().eq("id", business.id);
      return NextResponse.json(
        { error: "Failed to send invitation email", details: inviteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        to_number: business.to_number,
      },
      user: {
        email: email.toLowerCase(),
      },
      message: "Business created successfully. Invitation email sent to owner. They will need to set their password and complete onboarding.",
    });

  } catch (error) {
    console.error("Error in ops-create-business API:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

