import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool: Cancel Calendar Booking
 * Cancels/deletes a calendar event
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

    // Option 1: Delete event (permanent)
    // Option 2: Update event with cancellation notice (preserves history)
    // We'll do Option 2 to preserve history

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

    // Update event to mark as cancelled
    const updateData = {
      ...existingEvent,
      summary: `[CANCELLED] ${existingEvent.summary}`,
      description: `${existingEvent.description || ""}\n\n---\nCANCELLED${reason ? `: ${reason}` : ""}\nCancelled via AI Receptionist on ${new Date().toLocaleString()}`,
      status: "cancelled",
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
      // If update fails, try delete instead
      const deleteResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${event_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        return NextResponse.json(
          { error: "Failed to cancel event", details: errorData.error?.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        event_id: event_id,
        cancelled: true,
        method: "deleted",
      });
    }

    return NextResponse.json({
      success: true,
      event_id: event_id,
      cancelled: true,
      method: "marked_cancelled",
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

