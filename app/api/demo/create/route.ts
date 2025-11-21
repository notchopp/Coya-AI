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

    // Generate session token
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now

    // Create demo session
    const { data: session, error: sessionError } = await (supabaseAdmin
      .from("demo_sessions") as any)
      .insert({
        session_token: sessionToken,
        email: email || null,
        phone: phone || null,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating demo session:", sessionError);
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

