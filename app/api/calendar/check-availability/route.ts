import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCalendarProvider, ensureFreshToken, type CalendarConnection } from "@/lib/calendar-providers";

/**
 * Normalizes date input to YYYY-MM-DD format
 * Handles: day names (Monday, Tuesday, etc.), relative dates, and various date formats
 */
function normalizeDate(dateInput: string): string {
  const dateStr = dateInput.trim();
  
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Map day names to day indices (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayNames: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };
  
  const dayNameLower = dateStr.toLowerCase();
  
  // If it's a day name, find the next occurrence
  if (dayNames.hasOwnProperty(dayNameLower)) {
    const targetDay = dayNames[dayNameLower];
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntilTarget = targetDay - currentDay;
    
    // If the target day has already passed this week, get next week's occurrence
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    
    // Format as YYYY-MM-DD
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Try to parse various date formats
  // Handle formats like "November 24th 2025", "Nov 24 2025", "11/24/2025", etc.
  let parsedDate: Date | null = null;
  
  // Try parsing as-is
  parsedDate = new Date(dateStr);
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // If all parsing fails, throw error
  throw new Error(`Unable to parse date: ${dateStr}`);
}

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

    // Parse and validate duration_minutes
    const duration = typeof duration_minutes === 'string' && duration_minutes.trim() === '' 
      ? 30 
      : parseInt(String(duration_minutes), 10) || 30;

    // Normalize date input (handles day names, relative dates, etc.)
    let normalizedDate: string;
    try {
      normalizedDate = normalizeDate(date);
    } catch (error) {
      console.error("Date normalization error:", error, { date, time });
      return NextResponse.json(
        { error: "Invalid date format", details: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      );
    }

    // Parse date and time with proper timezone handling
    // Date should now be in format YYYY-MM-DD, time in HH:MM
    let startDateTime: Date;
    try {
      // Parse as local time first (add seconds for proper parsing)
      const dateTimeString = `${normalizedDate}T${time}:00`;
      startDateTime = new Date(dateTimeString);
      
      // Validate the date is valid
      if (isNaN(startDateTime.getTime())) {
        throw new Error(`Invalid date/time: ${dateTimeString}`);
      }
      
      // Validate date is not in the past
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Reset to start of day for comparison
      const requestDate = new Date(startDateTime);
      requestDate.setHours(0, 0, 0, 0);
      
      if (requestDate < now) {
        throw new Error(`Cannot check availability for past date: ${normalizedDate}`);
      }
    } catch (error) {
      console.error("Date parsing error:", error, { originalDate: date, normalizedDate, time });
      return NextResponse.json(
        { error: "Invalid date or time format", details: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      );
    }
    
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

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
          const slotStart = new Date(`${dateStr}T${timeSlot}:00`);
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);
          
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
        date: normalizedDate,
        time,
        duration_minutes: duration,
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

