import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCalendarProvider, ensureFreshToken, type CalendarConnection, type CalendarEvent } from "@/lib/calendar-providers";

/**
 * Normalizes date input to YYYY-MM-DD format
 * Handles: day names (Monday, Tuesday, etc.), relative dates, and various date formats
 * Also validates that dates are not in the past
 */
function normalizeDate(dateInput: string): string {
  const dateStr = dateInput.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // If already in YYYY-MM-DD format, validate it's not in the past
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parsedDate = new Date(dateStr);
    parsedDate.setHours(0, 0, 0, 0);
    
    // If the date is in the past, check if it's more than 30 days old
    // If so, it's likely a mistake (AI extracted wrong date from context)
    if (parsedDate < today) {
      const daysDiff = Math.floor((today.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 30) {
        // Date is more than 30 days in the past - likely a mistake
        // Check what day of the week it was and suggest the next occurrence
        const dayOfWeek = parsedDate.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dayOfWeek];
        
        // Calculate next occurrence of that day
        const currentDay = today.getDay();
        let daysUntilTarget = dayOfWeek - currentDay;
        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7;
        }
        
        const nextOccurrence = new Date(today);
        nextOccurrence.setDate(today.getDate() + daysUntilTarget);
        const year = nextOccurrence.getFullYear();
        const month = String(nextOccurrence.getMonth() + 1).padStart(2, '0');
        const day = String(nextOccurrence.getDate()).padStart(2, '0');
        const correctedDate = `${year}-${month}-${day}`;
        
        console.warn(`Date ${dateStr} is ${daysDiff} days in the past. Corrected to next ${dayName}: ${correctedDate}`);
        return correctedDate;
      } else {
        // Date is in the past but recent (within 30 days) - still reject but with better message
        throw new Error(`Date ${dateStr} is in the past. Please provide a future date.`);
      }
    }
    
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
    // Use the business timezone (defaulting to America/New_York)
    const timeZone = "America/New_York"; // TODO: Make timezone configurable per business
    
    let startDateTimeISO: string;
    let endDateTimeISO: string;
    let startDateTime: Date;
    let endDateTime: Date;
    try {
      // Parse date and time components
      const [year, month, day] = normalizedDate.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      
      // Get timezone offset for the target timezone on this specific date
      // Create a date object at the specified time, treating it as if it's in the target timezone
      // We'll use a helper to get the UTC offset for that timezone on this date
      const dateTimeString = `${normalizedDate}T${time}:00`;
      
      // Method: Create a date in UTC that represents the same "wall clock time" in the target timezone
      // Then get the offset by comparing
      const testDateStr = `${normalizedDate}T12:00:00`;
      
      // Get the offset by creating a date and formatting it in both UTC and target timezone
      const utcDate = new Date(testDateStr + 'Z'); // Noon UTC
      const tzDateStr = utcDate.toLocaleString('en-US', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      // Parse the timezone-formatted string to get the actual time in that timezone
      const tzParts = tzDateStr.match(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/);
      if (!tzParts) {
        throw new Error(`Failed to parse timezone date: ${tzDateStr}`);
      }
      const [, tzMonth, tzDay, tzYear, tzHour, tzMinute] = tzParts;
      const tzDate = new Date(`${tzYear}-${tzMonth.padStart(2, '0')}-${tzDay.padStart(2, '0')}T${tzHour.padStart(2, '0')}:${tzMinute.padStart(2, '0')}:00`);
      
      // Calculate offset: difference between UTC and timezone time
      const offsetMs = utcDate.getTime() - tzDate.getTime();
      const offsetHours = Math.floor(offsetMs / (1000 * 60 * 60));
      const offsetMinutes = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));
      const offsetSign = offsetHours >= 0 ? '+' : '-';
      const offsetStr = `${offsetSign}${String(Math.abs(offsetHours)).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
      
      // Construct ISO string with timezone offset
      // This represents the time in the target timezone
      startDateTimeISO = `${normalizedDate}T${time}:00${offsetStr}`;
      startDateTime = new Date(startDateTimeISO);
      
      // Validate the date is valid
      if (isNaN(startDateTime.getTime())) {
        throw new Error(`Invalid date/time: ${dateTimeString}`);
      }
      
      // Calculate end time (add duration in milliseconds)
      endDateTime = new Date(startDateTime.getTime() + duration * 60000);
      
      // Format end time in the same timezone
      // Get the end time components in the target timezone
      const endDateInTz = endDateTime.toLocaleString('en-US', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const endParts = endDateInTz.match(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/);
      if (!endParts) {
        throw new Error(`Failed to parse end time: ${endDateInTz}`);
      }
      const [, endMonth, endDay, endYear, endHour, endMinute, endSecond] = endParts;
      endDateTimeISO = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}T${endHour.padStart(2, '0')}:${endMinute.padStart(2, '0')}:${endSecond.padStart(2, '0')}${offsetStr}`;
      
      // Validate date is not in the past (with time consideration)
      const now = new Date();
      const requestDateTime = new Date(startDateTime);
      
      // If the date/time is in the past (even by a minute), reject it
      if (requestDateTime < now) {
        throw new Error(`Cannot create booking for past date/time: ${normalizedDate} ${time}`);
      }
    } catch (error) {
      console.error("Date parsing error:", error, { originalDate: date, normalizedDate, time, duration_minutes });
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
    // Use the ISO strings we constructed with the correct timezone offset
    const eventData: CalendarEvent = {
      id: "", // Will be set by provider
      summary: patient_name ? `Appointment: ${patient_name}` : "Appointment",
      description: description || "Appointment scheduled via AI Receptionist",
      start: {
        dateTime: startDateTimeISO,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTimeISO,
        timeZone: timeZone,
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

