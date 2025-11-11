import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool: Check Calendar Availability
 * Checks if a time slot is available in the connected Google Calendar
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, program_id, date, time, duration_minutes = 30 } = body;

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

        // Update stored token
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

    // Format for Google Calendar API (RFC3339)
    const timeMin = startDateTime.toISOString();
    const timeMax = endDateTime.toISOString();

    // Check for existing events in this time slot
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!calendarResponse.ok) {
      const errorData = await calendarResponse.json();
      console.error("Google Calendar API error:", errorData);
      return NextResponse.json(
        { error: "Failed to check calendar availability", details: errorData.error?.message },
        { status: 500 }
      );
    }

    const calendarData = await calendarResponse.json();
    const existingEvents = calendarData.items || [];

    // Check if slot is available
    const isAvailable = existingEvents.length === 0;

    // If not available, find next available slots
    let nextAvailableSlots: Array<{ date: string; time: string }> = [];
    if (!isAvailable) {
      // Check next 7 days for available slots
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = new Date(startDateTime);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const dateStr = checkDate.toISOString().split("T")[0];

        // Check common time slots (9am, 10am, 11am, 1pm, 2pm, 3pm, 4pm)
        const timeSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
        
        for (const timeSlot of timeSlots) {
          const slotStart = new Date(`${dateStr}T${timeSlot}`);
          const slotEnd = new Date(slotStart.getTime() + duration_minutes * 60000);
          
          const slotResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events?` +
            `timeMin=${encodeURIComponent(slotStart.toISOString())}&` +
            `timeMax=${encodeURIComponent(slotEnd.toISOString())}&` +
            `singleEvents=true`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (slotResponse.ok) {
            const slotData = await slotResponse.json();
            if ((slotData.items || []).length === 0) {
              nextAvailableSlots.push({
                date: dateStr,
                time: timeSlot,
              });
              if (nextAvailableSlots.length >= 3) break;
            }
          }
        }
        if (nextAvailableSlots.length >= 3) break;
      }
    }

    return NextResponse.json({
      available: isAvailable,
      requested_slot: {
        date,
        time,
        duration_minutes,
      },
      next_available_slots: nextAvailableSlots,
    });
  } catch (error) {
    console.error("Check availability error:", error);
    return NextResponse.json(
      { error: "Failed to check availability", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

