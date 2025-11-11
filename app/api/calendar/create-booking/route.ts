import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool: Create Calendar Booking
 * Creates a new event in the connected Google Calendar
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, program_id, date, time, duration_minutes = 30, patient_name, service, phone, email, notes } = body;

    if (!business_id || !date || !time) {
      return NextResponse.json(
        { error: "business_id, date, and time are required" },
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

    // Parse date and time
    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + duration_minutes * 60000);

    // Build event description
    let description = "";
    if (patient_name) description += `Patient: ${patient_name}\n`;
    if (service) description += `Service: ${service}\n`;
    if (phone) description += `Phone: ${phone}\n`;
    if (email) description += `Email: ${email}\n`;
    if (notes) description += `Notes: ${notes}\n`;

    // Create calendar event
    const eventData = {
      summary: patient_name ? `Appointment: ${patient_name}` : "Appointment",
      description: description || "Appointment scheduled via AI Receptionist",
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "America/New_York", // TODO: Make timezone configurable per business
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "America/New_York",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 }, // 1 hour before
        ],
      },
    };

    const createResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error("Google Calendar API error:", errorData);
      return NextResponse.json(
        { error: "Failed to create calendar event", details: errorData.error?.message },
        { status: 500 }
      );
    }

    const event = await createResponse.json();

    return NextResponse.json({
      success: true,
      event_id: event.id,
      event_link: event.htmlLink,
      start_time: event.start.dateTime,
      end_time: event.end.dateTime,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return NextResponse.json(
      { error: "Failed to create booking", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

