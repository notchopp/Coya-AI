import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCalendarProvider, ensureFreshToken, type CalendarConnection, type CalendarEvent } from "@/lib/calendar-providers";

/**
 * Vapi Tool: Reschedule Calendar Booking
 * Updates an existing calendar event to a new date/time (supports Google, Outlook, Calendly)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, program_id, event_id, new_date, new_time, duration_minutes = 30 } = body;

    if (!business_id || !event_id || !new_date || !new_time) {
      return NextResponse.json(
        { error: "business_id, event_id, new_date, and new_time are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Get calendar connection
    // Priority: 1) program-specific connection, 2) business-level connection (program_id = null)
    let connection: CalendarConnection | null = null;

    // First, try to find program-specific connection if program_id is provided
    if (program_id) {
      const { data: programConnection, error: programError } = await (supabaseAdmin as any)
        .from("calendar_connections")
        .select("*")
        .eq("business_id", business_id)
        .eq("program_id", program_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!programError && programConnection) {
        connection = programConnection as CalendarConnection;
      }
    }

    // If no program connection found, try business-level connection (program_id = null)
    if (!connection) {
      const { data: businessConnection, error: businessError } = await (supabaseAdmin as any)
        .from("calendar_connections")
        .select("*")
        .eq("business_id", business_id)
        .is("program_id", null)
        .eq("is_active", true)
        .maybeSingle();

      if (!businessError && businessConnection) {
        connection = businessConnection as CalendarConnection;
      }
    }

    if (!connection) {
      console.error("No calendar connection found:", {
        business_id,
        program_id,
        error: "No active calendar connection found for this business/program",
      });
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

    // Get existing event first
    let existingEvent: CalendarEvent;
    try {
      existingEvent = await adapter.getEvent(connection, event_id);
    } catch (error) {
      return NextResponse.json(
        { error: "Event not found", details: error instanceof Error ? error.message : String(error) },
        { status: 404 }
      );
    }

    // Parse new date and time
    const newStartDateTime = new Date(`${new_date}T${new_time}`);

    // Calculate duration from original event if not provided
    const originalStart = new Date(existingEvent.start.dateTime);
    const originalEnd = new Date(existingEvent.end.dateTime);
    const originalDuration = Math.round((originalEnd.getTime() - originalStart.getTime()) / 60000);
    const finalDuration = duration_minutes || originalDuration;
    const newEndDateTime = new Date(newStartDateTime.getTime() + finalDuration * 60000);

    // Update event
    const updateData: CalendarEvent = {
      ...existingEvent,
      start: {
        dateTime: newStartDateTime.toISOString(),
        timeZone: existingEvent.start.timeZone || "America/New_York",
      },
      end: {
        dateTime: newEndDateTime.toISOString(),
        timeZone: existingEvent.end.timeZone || "America/New_York",
      },
    };

    const updatedEvent = await adapter.updateEvent(connection, event_id, updateData);

    return NextResponse.json({
      success: true,
      event_id: updatedEvent.id,
      event_link: updatedEvent.htmlLink || `${connection.external_calendar_url || ""}`,
      new_start_time: updatedEvent.start.dateTime,
      new_end_time: updatedEvent.end.dateTime,
      provider: connection.provider,
    });
  } catch (error) {
    console.error("Reschedule booking error:", error);
    return NextResponse.json(
      { error: "Failed to reschedule booking", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

