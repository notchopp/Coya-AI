import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Get patients for demo business
 * Uses admin client to bypass RLS since demo doesn't require authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> | { sessionToken: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionToken } = resolvedParams;
    const DEMO_BUSINESS_ID = "eea1f8b5-f4ed-4141-85c7-c381643ce9df";
    const supabaseAdmin = getSupabaseAdminClient();

    // Verify session exists
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("demo_sessions")
      .select("id, demo_business_id")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Demo session not found" },
        { status: 404 }
      );
    }

    // Load patients for demo business using admin client (bypasses RLS)
    const { data: patientsData, error: patientsError } = await (supabaseAdmin as any)
      .from("patients")
      .select("*")
      .eq("business_id", DEMO_BUSINESS_ID)
      .order("last_call_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5);

    if (patientsError) {
      console.error("Error loading demo patients:", patientsError);
      return NextResponse.json(
        { error: "Failed to load patients", details: patientsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patients: patientsData || [],
      count: patientsData?.length || 0,
    });
  } catch (error) {
    console.error("Demo patients error:", error);
    return NextResponse.json(
      { error: "Failed to load patients", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

