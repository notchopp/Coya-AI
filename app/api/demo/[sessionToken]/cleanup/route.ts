import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Cleanup demo data when session expires
 * Deletes calls, patients, and call_turns for the demo business
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> | { sessionToken: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionToken } = resolvedParams;
    const DEMO_BUSINESS_ID = "eea1f8b5-f4ed-4141-85c7-c381643ce9df";
    const supabaseAdmin = getSupabaseAdminClient();

    // Verify session exists and is expired
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("demo_sessions")
      .select("id, expires_at, is_active")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Demo session not found" },
        { status: 404 }
      );
    }

    const sessionData = session as any;
    const now = new Date();
    const expiresAt = new Date(sessionData.expires_at);

    // Only allow cleanup if session is expired or inactive
    if (sessionData.is_active && expiresAt > now) {
      return NextResponse.json(
        { error: "Session is still active. Cannot cleanup until expired." },
        { status: 400 }
      );
    }

    console.log("🧹 Starting demo cleanup for business:", DEMO_BUSINESS_ID);

    // 1. Get all call IDs for this business (needed for call_turns cleanup)
    const { data: calls, error: callsError } = await (supabaseAdmin as any)
      .from("calls")
      .select("id, call_id")
      .eq("business_id", DEMO_BUSINESS_ID);

    if (callsError) {
      console.error("Error fetching calls for cleanup:", callsError);
    }

    const callIds = calls?.map((c: any) => c.id) || [];
    const callCallIds = calls?.map((c: any) => c.call_id).filter(Boolean) || [];

    // 2. Delete call_turns for demo calls
    if (callCallIds.length > 0) {
      const { error: turnsError } = await (supabaseAdmin as any)
        .from("call_turns")
        .delete()
        .in("call_id", callCallIds);

      if (turnsError) {
        console.error("Error deleting call_turns:", turnsError);
      } else {
        console.log(`✅ Deleted call_turns for ${callCallIds.length} calls`);
      }
    }

    // 3. Delete calls for demo business
    const { error: deleteCallsError } = await (supabaseAdmin as any)
      .from("calls")
      .delete()
      .eq("business_id", DEMO_BUSINESS_ID);

    if (deleteCallsError) {
      console.error("Error deleting calls:", deleteCallsError);
      return NextResponse.json(
        { error: "Failed to delete calls", details: deleteCallsError.message },
        { status: 500 }
      );
    }
    console.log(`✅ Deleted ${callIds.length} calls`);

    // 4. Delete patients for demo business
    const { error: deletePatientsError } = await (supabaseAdmin as any)
      .from("patients")
      .delete()
      .eq("business_id", DEMO_BUSINESS_ID);

    if (deletePatientsError) {
      console.error("Error deleting patients:", deletePatientsError);
      return NextResponse.json(
        { error: "Failed to delete patients", details: deletePatientsError.message },
        { status: 500 }
      );
    }
    console.log("✅ Deleted all patients for demo business");

    // 5. Mark session as cleaned up (optional - add a cleaned_up field if needed)
    await (supabaseAdmin as any)
      .from("demo_sessions")
      .update({ is_active: false })
      .eq("session_token", sessionToken);

    return NextResponse.json({
      success: true,
      deleted: {
        calls: callIds.length,
        patients: "all",
        call_turns: callCallIds.length,
      },
      message: "Demo data cleaned up successfully",
    });
  } catch (error) {
    console.error("Demo cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup demo data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

