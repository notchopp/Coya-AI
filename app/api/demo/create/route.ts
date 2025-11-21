import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    const supabaseAdmin = getSupabaseAdminClient();

    // Check if demo is available - STRICT: Only 1 session at a time
    const { data: activeSessions, error: sessionCheckError } = await supabaseAdmin
      .from("demo_sessions")
      .select("id, expires_at, created_at")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (sessionCheckError) {
      console.error("Error checking active sessions:", sessionCheckError);
      // Check if table doesn't exist (migration not run)
      if (sessionCheckError.message?.includes("relation") || sessionCheckError.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Demo system not initialized", 
            message: "Please run the database migration first. See supabase/migrations/add_demo_system.sql",
            details: sessionCheckError.message 
          },
          { status: 500 }
        );
      }
    }

    // If there's an active session, calculate wait time
    if (activeSessions && activeSessions.length > 0) {
      const activeSession = activeSessions[0] as any;
      const expiresAt = new Date(activeSession.expires_at);
      const now = new Date();
      const waitTimeMs = expiresAt.getTime() - now.getTime();
      const waitTimeMinutes = Math.ceil(waitTimeMs / (1000 * 60));
      const waitTimeSeconds = Math.ceil(waitTimeMs / 1000);

      return NextResponse.json({
        available: false,
        nextAvailableIn: waitTimeMinutes,
        nextAvailableInSeconds: waitTimeSeconds,
        message: `Demo session in progress. Next available in ${waitTimeMinutes} minute${waitTimeMinutes !== 1 ? 's' : ''}.`,
        expiresAt: activeSession.expires_at,
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
    
    // Use the request origin to build the correct URL
    const origin = request.headers.get("origin") || 
                   request.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
                   process.env.NEXT_PUBLIC_SITE_URL || 
                   "https://app.getcoya.ai";
    
    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      sessionToken: sessionToken,
      expiresAt: expiresAt.toISOString(),
      demoLink: `${origin}/demo/${sessionToken}`,
    });
  } catch (error) {
    console.error("Create demo error:", error);
    return NextResponse.json(
      { error: "Failed to create demo session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

