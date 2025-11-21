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

    // If session is in queue, get active session info for timer sync
    const sessionData = session as any;
    let activeSessionInfo = null;
    if (sessionData && !sessionData.is_active) {
      const { data: activeSession } = await supabaseAdmin
        .from("demo_sessions")
        .select("id, expires_at, created_at")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession) {
        activeSessionInfo = activeSession;
      }

      // Get queue position
      const { data: allWaiting } = await supabaseAdmin
        .from("demo_sessions")
        .select("id, created_at")
        .eq("is_active", false)
        .order("created_at", { ascending: true });

      const queuePosition = allWaiting ? allWaiting.findIndex((s: any) => s.id === sessionData.id) + 1 : 0;
      sessionData.queuePosition = queuePosition;
    }

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
    const now = new Date();
    
    // If in queue, use active session's expiration for timer sync
    let expiresAt: Date;
    if (!sessionData.is_active && activeSessionInfo) {
      expiresAt = new Date((activeSessionInfo as any).expires_at);
    } else {
      expiresAt = new Date(sessionData.expires_at);
    }
    
    const isExpired = expiresAt < now;
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    return NextResponse.json({
      session: {
        ...sessionData,
        isExpired,
        remainingSeconds,
        remainingMinutes: Math.floor(remainingSeconds / 60),
        activeSessionExpiresAt: activeSessionInfo ? (activeSessionInfo as any).expires_at : null,
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

