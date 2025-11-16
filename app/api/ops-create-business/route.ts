import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * Create Business API Endpoint (Super Admin Only)
 * Creates a new business and owner user account
 */
export async function POST(request: NextRequest) {
  try {
    // Verify super admin
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email?.toLowerCase();
    const userId = session.user.id;
    const isSuperAdmin = userEmail === "whochoppa@gmail.com" || userId === "9c0e8c58-8a36-47e9-aa68-909b22b4443f";

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
    const { data: existingBusiness } = await supabase
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
    const { data: existingUser } = await supabase
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
    const businessResult = await supabase
      .from("businesses")
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

    // Create Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true,
      user_metadata: {
        full_name: owner_name || name,
      },
    });

    if (authError || !authUser) {
      console.error("Error creating auth user:", authError);
      // Rollback business creation
      await supabase.from("businesses").delete().eq("id", business.id);
      return NextResponse.json(
        { error: "Failed to create user account", details: authError?.message },
        { status: 500 }
      );
    }

    // Create user record
    const { error: userError } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUser.user.id,
        business_id: business.id,
        email: email.toLowerCase(),
        full_name: owner_name || name || "Business Owner",
        role: "owner",
        is_active: true,
      });

    if (userError) {
      console.error("Error creating user record:", userError);
      // Rollback: delete auth user and business
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from("businesses").delete().eq("id", business.id);
      return NextResponse.json(
        { error: "Failed to create user record", details: userError.message },
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
        id: authUser.user.id,
        email: authUser.user.email,
      },
      message: "Business and owner account created successfully. Owner will need to set their password via email invite.",
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

