import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool: Reschedule Calendar Booking
 * Updates an existing calendar event to a new date/time
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
    let connectionQuery = (supabaseAdmin as any)
      .from("calendar_connections")
      .select("*")
      .eq("business_id", business_id);

    if (program_id) {
      connectionQuery = connectionQuery.eq("program_id", program_id);
    } else {
      connectionQuery = connectionQuery.is("program_id", null);
    }

    const { data: connectionData, error: connError } = await connectionQuery.maybeSingle();
    const connection = connectionData as any;

    if (connError || !connectionData) {
      return NextResponse.json(
        { error: "No calendar connection found for this business/program" },
        { status: 404 }
      );
    }

    // Check if token needs refresh
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    let accessToken = connection.access_token;

    if (expiresAt <= now) {
      // Refresh token
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshResponse.ok) {
        const tokenData = await refreshResponse.json();
        accessToken = tokenData.access_token;
        const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

        await (supabaseAdmin as any)
          .from("calendar_connections")
          .update({
            access_token: accessToken,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq("id", connection.id);
      }
    }

    // Get existing event first
    const getEventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${event_id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!getEventResponse.ok) {
      const errorData = await getEventResponse.json();
      return NextResponse.json(
        { error: "Event not found", details: errorData.error?.message },
        { status: 404 }
      );
    }

    const existingEvent = await getEventResponse.json();

    // Parse new date and time
    const newStartDateTime = new Date(`${new_date}T${new_time}`);
    const newEndDateTime = new Date(newStartDateTime.getTime() + duration_minutes * 60000);

    // Calculate duration from original event if not provided
    const originalStart = new Date(existingEvent.start.dateTime);
    const originalEnd = new Date(existingEvent.end.dateTime);
    const originalDuration = Math.round((originalEnd.getTime() - originalStart.getTime()) / 60000);
    const finalDuration = duration_minutes || originalDuration;

    // Update event
    const updateData = {
      ...existingEvent,
      start: {
        dateTime: newStartDateTime.toISOString(),
        timeZone: existingEvent.start.timeZone || "America/New_York",
      },
      end: {
        dateTime: new Date(newStartDateTime.getTime() + finalDuration * 60000).toISOString(),
        timeZone: existingEvent.end.timeZone || "America/New_York",
      },
    };

    const updateResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${event_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error("Google Calendar API error:", errorData);
      return NextResponse.json(
        { error: "Failed to reschedule event", details: errorData.error?.message },
        { status: 500 }
      );
    }

    const updatedEvent = await updateResponse.json();

    return NextResponse.json({
      success: true,
      event_id: updatedEvent.id,
      event_link: updatedEvent.htmlLink,
      new_start_time: updatedEvent.start.dateTime,
      new_end_time: updatedEvent.end.dateTime,
    });
  } catch (error) {
    console.error("Reschedule booking error:", error);
    return NextResponse.json(
      { error: "Failed to reschedule booking", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

