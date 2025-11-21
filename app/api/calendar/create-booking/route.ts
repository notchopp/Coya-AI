import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCalendarProvider, ensureFreshToken, type CalendarConnection, type CalendarEvent } from "@/lib/calendar-providers";

/**
 * Vapi Tool: Create Calendar Booking
 * Creates a new event in the connected calendar (supports Google, Outlook, Calendly)
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
      // Token was refreshed, update in database
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

    // Create calendar event (provider-agnostic format)
    const eventData: CalendarEvent = {
      id: "", // Will be set by provider
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
    };

    // Create event using provider adapter
    const event = await adapter.createEvent(connection, eventData);

    return NextResponse.json({
      success: true,
      event_id: event.id,
      event_link: event.htmlLink || `${connection.external_calendar_url || ""}`,
      start_time: event.start.dateTime,
      end_time: event.end.dateTime,
      provider: connection.provider,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return NextResponse.json(
      { error: "Failed to create booking", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

