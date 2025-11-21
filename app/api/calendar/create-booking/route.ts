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

    // Parse and validate duration_minutes
    const duration = typeof duration_minutes === 'string' && duration_minutes.trim() === '' 
      ? 30 
      : parseInt(String(duration_minutes), 10) || 30;

    // Parse date and time with proper timezone handling
    let startDateTime: Date;
    let endDateTime: Date;
    try {
      // Parse as local time first (add seconds for proper parsing)
      const dateTimeString = `${date}T${time}:00`;
      startDateTime = new Date(dateTimeString);
      
      // Validate the date is valid
      if (isNaN(startDateTime.getTime())) {
        throw new Error(`Invalid date/time: ${dateTimeString}`);
      }
      
      // Validate date is not in the past
      const now = new Date();
      if (startDateTime < now) {
        throw new Error(`Cannot create booking for past date/time: ${date} ${time}`);
      }
      
      endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    } catch (error) {
      console.error("Date parsing error:", error, { date, time, duration_minutes });
      return NextResponse.json(
        { error: "Invalid date or time format", details: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      );
    }

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

