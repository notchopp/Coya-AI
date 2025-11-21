import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> | { sessionToken: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionToken } = resolvedParams;
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: session, error } = await supabaseAdmin
      .from("demo_sessions")
      .select(`
        *,
        demo_business:businesses!demo_sessions_demo_business_id_fkey(*)
      `)
      .eq("session_token", sessionToken)
      .single();

    if (error) {
      console.error("Error fetching demo session:", error);
      // Check if table doesn't exist (migration not run)
      if (error.message?.includes("relation") || error.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Demo system not initialized", 
            message: "Please run the database migration first. See supabase/migrations/add_demo_system.sql",
            details: error.message 
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Demo session not found", details: error.message },
        { status: 404 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "Demo session not found" },
        { status: 404 }
      );
    }

    // Check if expired
    const sessionData = session as any;
    const now = new Date();
    const expiresAt = new Date(sessionData.expires_at);
    const isExpired = expiresAt < now;
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    return NextResponse.json({
      session: {
        ...sessionData,
        isExpired,
        remainingSeconds,
        remainingMinutes: Math.floor(remainingSeconds / 60),
      },
    });
  } catch (error) {
    console.error("Get demo session error:", error);
    return NextResponse.json(
      { error: "Failed to get demo session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> | { sessionToken: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionToken } = resolvedParams;
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await (supabaseAdmin
      .from("demo_sessions") as any)
      .update(body)
      .eq("session_token", sessionToken)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update session", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error("Update demo session error:", error);
    return NextResponse.json(
      { error: "Failed to update session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

