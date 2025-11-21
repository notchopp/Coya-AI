import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCalendarProvider, ensureFreshToken, type CalendarConnection } from "@/lib/calendar-providers";

/**
 * Vapi Tool: Check Calendar Availability
 * Checks if a time slot is available in the connected calendar (supports Google, Outlook, Calendly)
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

    // Parse date and time
    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + duration_minutes * 60000);

    // Check availability using provider adapter
    const availability = await adapter.checkAvailability(connection, startDateTime, endDateTime);
    const isAvailable = availability.available;

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
          
          const slotAvailability = await adapter.checkAvailability(connection, slotStart, slotEnd);
          if (slotAvailability.available) {
            nextAvailableSlots.push({
              date: dateStr,
              time: timeSlot,
            });
            if (nextAvailableSlots.length >= 3) break;
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
      provider: connection.provider,
    });
  } catch (error) {
    console.error("Check availability error:", error);
    return NextResponse.json(
      { error: "Failed to check availability", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

