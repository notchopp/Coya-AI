import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    const supabaseAdmin = getSupabaseAdminClient();

    // Check if demo is available
    const { data: availability, error: availError } = await supabaseAdmin.rpc('check_demo_availability');
    
    if (availError) {
      console.error("Error checking availability:", availError);
      // Check if function doesn't exist (migration not run)
      if (availError.message?.includes("function") || availError.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Demo system not initialized", 
            message: "Please run the database migration first. See supabase/migrations/add_demo_system.sql",
            details: availError.message 
          },
          { status: 500 }
        );
      }
      // Continue anyway - don't block demo creation
    }
    
    const availabilityData = availability as any;
    if (availabilityData && !availabilityData.available && availabilityData.next_available_in > 0) {
      return NextResponse.json({
        available: false,
        nextAvailableIn: availabilityData.next_available_in,
        message: `Demo in use. Next available in ${availabilityData.next_available_in} minutes.`
      }, { status: 429 });
    }

    // Demo business ID - all demo sessions use this same business
    const DEMO_BUSINESS_ID = "eea1f8b5-f4ed-4141-85c7-c381643ce9df";
    const DEMO_PHONE_NUMBER = "+12159862752"; // +1 (215) 986 2752

    // Verify demo business exists
    const { data: demoBusiness, error: businessCheckError } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("id", DEMO_BUSINESS_ID)
      .single();

    if (businessCheckError || !demoBusiness) {
      console.error("Demo business not found:", businessCheckError);
      return NextResponse.json(
        { error: "Demo business not configured", details: "Demo business ID not found in database" },
        { status: 500 }
      );
    }

    // Ensure demo business is marked as demo and has the demo phone number
    await (supabaseAdmin
      .from("businesses") as any)
      .update({
        is_demo: true,
        demo_phone_number: DEMO_PHONE_NUMBER,
        to_number: DEMO_PHONE_NUMBER,
      })
      .eq("id", DEMO_BUSINESS_ID);

    // Generate session token
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now

    // Create demo session linked to the demo business
    const { data: session, error: sessionError } = await (supabaseAdmin
      .from("demo_sessions") as any)
      .insert({
        session_token: sessionToken,
        email: email || null,
        phone: phone || null,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        demo_business_id: DEMO_BUSINESS_ID,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating demo session:", sessionError);
      // Check if table doesn't exist (migration not run)
      if (sessionError.message?.includes("relation") || sessionError.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Demo system not initialized", 
            message: "Please run the database migration first. See supabase/migrations/add_demo_system.sql",
            details: sessionError.message 
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create demo session", details: sessionError.message },
        { status: 500 }
      );
    }

    const sessionData = session as any;
    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      sessionToken: sessionToken,
      expiresAt: expiresAt.toISOString(),
      demoLink: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/demo/${sessionToken}`,
    });
  } catch (error) {
    console.error("Create demo error:", error);
    return NextResponse.json(
      { error: "Failed to create demo session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

