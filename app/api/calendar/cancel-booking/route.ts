import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCalendarProvider, ensureFreshToken, type CalendarConnection, type CalendarEvent } from "@/lib/calendar-providers";

/**
 * Vapi Tool: Cancel Calendar Booking
 * Cancels/deletes a calendar event (supports Google, Outlook, Calendly)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, program_id, event_id, reason } = body;

    if (!business_id || !event_id) {
      return NextResponse.json(
        { error: "business_id and event_id are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Get calendar connection
    let connectionQuery = (supabaseAdmin as any)
      .from("calendar_connections")
      .select("*")
      .eq("business_id", business_id)
      .eq("is_active", true);

    if (program_id) {
      connectionQuery = connectionQuery.eq("program_id", program_id);
    } else {
      connectionQuery = connectionQuery.is("program_id", null);
    }

    const { data: connectionData, error: connError } = await connectionQuery.maybeSingle();
    const connection = connectionData as CalendarConnection;

    if (connError || !connectionData) {
      return NextResponse.json(
        { error: "No active calendar connection found for this business/program" },
        { status: 404 }
      );
    }

    // Get provider adapter
    const adapter = getCalendarProvider(connection.provider);

    // Ensure token is fresh
    let accessToken = await ensureFreshToken(connection, adapter);
    
    // Update connection if token was refreshed
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      const newExpiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour default
      await (supabaseAdmin as any)
        .from("calendar_connections")
        .update({
          access_token: accessToken,
          token_expires_at: newExpiresAt.toISOString(),
        })
        .eq("id", connection.id);
      
      connection.access_token = accessToken;
    }

    // For Google and Outlook, try to mark as cancelled first (preserves history)
    // For Calendly, just delete/cancel
    if (connection.provider === "google" || connection.provider === "outlook") {
      try {
        // Get existing event first
        const existingEvent = await adapter.getEvent(connection, event_id);

        // Update event to mark as cancelled
        const updateData: CalendarEvent = {
          ...existingEvent,
          summary: `[CANCELLED] ${existingEvent.summary}`,
          description: `${existingEvent.description || ""}\n\n---\nCANCELLED${reason ? `: ${reason}` : ""}\nCancelled via AI Receptionist on ${new Date().toLocaleString()}`,
        };

        await adapter.updateEvent(connection, event_id, updateData);

        return NextResponse.json({
          success: true,
          event_id: event_id,
          cancelled: true,
          method: "marked_cancelled",
          provider: connection.provider,
        });
      } catch (updateError) {
        // If update fails, try delete instead
        console.warn("Failed to mark event as cancelled, trying delete:", updateError);
      }
    }

    // Delete event (for Calendly or if update failed)
    try {
      await adapter.deleteEvent(connection, event_id);
      return NextResponse.json({
        success: true,
        event_id: event_id,
        cancelled: true,
        method: "deleted",
        provider: connection.provider,
      });
    } catch (deleteError) {
      return NextResponse.json(
        { error: "Failed to cancel event", details: deleteError instanceof Error ? deleteError.message : String(deleteError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

