"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import Calendar from "react-calendar";
import { getSupabaseClient } from "@/lib/supabase";
import { format, isSameDay } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useProgram } from "@/components/ProgramProvider";
import { X, Calendar as CalendarIcon } from "lucide-react";
import "react-calendar/dist/Calendar.css";

type Call = {
  id: string;
  started_at: string;
  patient_name: string | null;
  last_summary: string | null;
  schedule: any;
};

export default function CalendarPage() {
  const { accentColor } = useAccentColor();
  const { programId } = useProgram();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [highlightedCallId, setHighlightedCallId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Call | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const highlightedCallRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle date and callId query parameters from call log navigation
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const callIdParam = searchParams.get("callId");
    
    if (dateParam) {
      try {
        // Parse date string (YYYY-MM-DD)
        const [year, month, day] = dateParam.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          console.log("📅 Setting calendar date to:", date);
          setSelectedDate(date);
        }
      } catch (e) {
        console.error("Invalid date parameter:", dateParam, e);
      }
    }
    
    if (callIdParam) {
      console.log("🎯 Highlighting call:", callIdParam);
      setHighlightedCallId(callIdParam);
      // Scroll to highlighted booking after a short delay
      setTimeout(() => {
        if (highlightedCallRef.current) {
          highlightedCallRef.current.scrollIntoView({ 
            behavior: "smooth", 
            block: "center" 
          });
        }
      }, 300);
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedCallId(null);
        console.log("✨ Cleared highlight");
      }, 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!mounted) return;

    async function loadCalls() {
      const supabase = getSupabaseClient();
      
      // Get business_id from sessionStorage
      const businessId = sessionStorage.getItem("business_id");
      
      if (!businessId) {
        console.error("⚠️ No business_id found in sessionStorage");
        setLoading(false);
        return;
      }

      console.log("🔄 Loading calendar calls for business_id:", businessId);

      // Only get calls with schedule (booked appointments) for this business
      let calendarQuery = supabase
        .from("calls")
        .select("id,started_at,patient_name,last_summary,schedule")
        .eq("business_id", businessId!)
        .not("schedule", "is", null);
      
      // Filter by program_id if program is selected
      if (programId) {
        calendarQuery = calendarQuery.eq("program_id", programId);
      }
      
      const { data, error } = await calendarQuery
        .order("started_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("❌ Error loading calendar calls:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        setLoading(false);
        return;
      }

      console.log("✅ Loaded calls with schedule:", data?.length);
      if (data && data.length > 0) {
        console.log("Sample schedule structure:", (data[0] as Call)?.schedule);
      }

      setCalls((data as Call[]) ?? []);
      setLoading(false);
    }

    loadCalls();
  }, [mounted]);

  // Extract date from schedule JSONB - handle various structures
  function getScheduleDate(call: Call): Date | null {
    if (!call.schedule) {
      console.log("⚠️ No schedule data for call:", call.id);
      return null;
    }
    
    const schedule = call.schedule;
    console.log("📋 Schedule for call:", call.id, schedule);
    
    // Try various common date field names - prioritize "start" field first (most common in booking systems)
    const dateFields = [
      schedule.start, // Most common - booking start time
      schedule.startDateTime, // Full datetime with time
      schedule.endDateTime,
      schedule.end, // End time (fallback if start not available)
      schedule.appointment_datetime,
      schedule.datetime,
      schedule.scheduled_time,
      schedule.start_time,
      schedule.time,
      schedule.date, // Date only (will use time from datetime if available)
      schedule.appointment_date,
      schedule.start_date,
      schedule.appointmentDate,
      schedule.appointmentTime,
    ].filter(Boolean);
    
    console.log("📅 Found date fields:", dateFields);
    
    if (dateFields.length === 0) {
      // If no date field found, check if schedule is a string
      if (typeof schedule === "string") {
        try {
          const date = new Date(schedule);
          if (!isNaN(date.getTime())) {
            console.log("✅ Parsed string date:", date);
            return date;
          }
        } catch (e) {
          console.error("❌ Failed to parse string date:", e);
        }
      }
      // If it's an object, try to iterate through all keys to find date-like values
      try {
        for (const key in schedule) {
          if (schedule[key] && (typeof schedule[key] === "string" || schedule[key] instanceof Date)) {
            try {
              const date = new Date(schedule[key]);
              if (!isNaN(date.getTime())) {
                console.log("✅ Found date in key:", key, date);
                return date;
              }
            } catch (e) {
              // Continue searching
            }
          }
        }
      } catch (e) {
        console.error("❌ Failed to parse schedule object:", e);
      }
      // DO NOT fallback to started_at - return null if no date found in schedule
      console.error("❌ No valid date found in schedule, returning null");
      return null;
    }
    
    try {
      // Try to find a datetime field first (includes time), otherwise use date
      // Prioritize "start" or "startDateTime" fields as they contain the booking time
      let dateValue = dateFields.find(field => {
        const str = String(field);
        // Check if it includes time indicators (T, :, AM/PM, etc.)
        return str.includes('T') || str.includes(':') || str.includes('AM') || str.includes('PM') || str.includes('am') || str.includes('pm');
      }) || dateFields[0];
      
      // Check if schedule has "start" field specifically (common in booking systems)
      if (schedule.start) {
        dateValue = schedule.start;
        console.log("📅 Using 'start' field from schedule:", dateValue);
      }
      
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        console.error("❌ Invalid date:", dateValue);
        return null;
      }
      
      // If the date string ends with 'Z' (UTC), we need to preserve the UTC time
      // by creating a date that represents the same UTC time but doesn't convert to local
      // However, we'll format it to show the UTC time as-is
      const dateStr = String(dateValue);
      if (dateStr.endsWith('Z') || dateStr.includes('T')) {
        // Parse the UTC components directly to avoid timezone conversion
        const utcMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (utcMatch) {
          const [, year, month, day, hour, minute, second] = utcMatch;
          // Create date in UTC to preserve the original time
          const utcDate = new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          ));
          console.log("✅ Parsed UTC date from field:", utcDate, "Original UTC value:", dateValue, "UTC time:", `${hour}:${minute}`);
          return utcDate;
        }
      }
      
      console.log("✅ Parsed date from field:", date, "Original value:", dateValue);
      return date;
    } catch (e) {
      console.error("❌ Failed to parse date:", e);
      // DO NOT fallback to started_at - return null if parsing fails
      return null;
    }
  }

  // Only show scheduled appointments
  const selectedDateCalls = calls.filter((call) => {
    if (!call.schedule) return false;
    const scheduleDate = getScheduleDate(call);
    if (!scheduleDate) return false;
    return isSameDay(scheduleDate, selectedDate);
  });

  const tileContent = ({ date }: { date: Date }) => {
    const dayCalls = calls.filter((call) => {
      if (!call.schedule) return false;
      const scheduleDate = getScheduleDate(call);
      if (!scheduleDate) return false;
      return isSameDay(scheduleDate, date);
    });
    
    if (dayCalls.length === 0) return null;

    return (
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
        {dayCalls.slice(0, 3).map((_, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        ))}
        {dayCalls.length > 3 && (
          <div className="text-[8px]" style={{ color: accentColor }}>+{dayCalls.length - 3}</div>
        )}
      </div>
    );
  };

  function getBookingDate(call: Call): string {
    const scheduleDate = getScheduleDate(call);
    if (scheduleDate) {
      try {
        // Format using UTC methods to preserve the original booking time
        // This ensures the time shown matches what was booked, not converted to local timezone
        const year = scheduleDate.getUTCFullYear();
        const month = scheduleDate.getUTCMonth();
        const day = scheduleDate.getUTCDate();
        const hours = scheduleDate.getUTCHours();
        const minutes = scheduleDate.getUTCMinutes();
        
        // Create a date object in local timezone but with UTC values
        // This way format() will show the correct time
        const localDate = new Date(year, month, day, hours, minutes);
        
        return format(localDate, "MMM d, yyyy 'at' h:mm a");
      } catch (e) {
        console.error("❌ Failed to format schedule date:", e);
        return "Date unavailable";
      }
    }
    
    // If no schedule date found, show that instead of call time
    return "Date unavailable";
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Calendar</h1>
          <span className="beta-badge">Beta</span>
        </div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xs font-medium"
          style={{ color: `${accentColor}CC`, textShadow: `0 0 6px ${accentColor}66` }}
        >
          #Founders Program
        </motion.span>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <div className="p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-black border border-white/10">
            <style jsx global>{`
              :root {
                --calendar-accent: ${accentColor};
              }
              .react-calendar {
                background: transparent;
                border: none;
                font-family: inherit;
                width: 100%;
              }
              .react-calendar__navigation {
                display: flex;
                height: 44px;
                margin-bottom: 1em;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 1em;
              }
              .light .react-calendar__navigation {
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
              }
              .react-calendar__navigation button {
                color: white;
                min-width: 44px;
                background: none;
                font-size: 16px;
                font-weight: 500;
                border: none;
                padding: 0.5em;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s;
              }
              .light .react-calendar__navigation button {
                color: #1a1a1a;
              }
              .react-calendar__navigation button:hover {
                background: rgba(255, 255, 255, 0.1);
              }
              .light .react-calendar__navigation button:hover {
                background: rgba(0, 0, 0, 0.05);
              }
              .react-calendar__navigation button:enabled:hover,
              .react-calendar__navigation button:enabled:focus {
                background: rgba(255, 255, 255, 0.1);
              }
              .light .react-calendar__navigation button:enabled:hover,
              .light .react-calendar__navigation button:enabled:focus {
                background: rgba(0, 0, 0, 0.05);
              }
              .react-calendar__month-view__weekdays {
                text-align: center;
                text-transform: uppercase;
                font-weight: 600;
                font-size: 0.75em;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 1em;
              }
              .light .react-calendar__month-view__weekdays {
                color: rgba(26, 26, 26, 0.5);
              }
              .react-calendar__month-view__weekdays__weekday {
                padding: 0.5em;
              }
              .react-calendar__tile {
                max-width: 100%;
                padding: 1em 0.5em;
                background: none;
                text-align: center;
                line-height: 16px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
                border-radius: 8px;
                position: relative;
                min-height: 60px;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 0.5em;
              }
              .light .react-calendar__tile {
                color: rgba(26, 26, 26, 0.7);
              }
              .react-calendar__tile:enabled:hover,
              .react-calendar__tile:enabled:focus {
                background: color-mix(in srgb, var(--calendar-accent) 20%, transparent);
                color: white;
              }
              .light .react-calendar__tile:enabled:hover,
              .light .react-calendar__tile:enabled:focus {
                background: color-mix(in srgb, var(--calendar-accent) 15%, transparent);
                color: #1a1a1a;
              }
              .react-calendar__tile--now {
                background: color-mix(in srgb, var(--calendar-accent) 30%, transparent);
                color: white;
                font-weight: 600;
              }
              .light .react-calendar__tile--now {
                background: color-mix(in srgb, var(--calendar-accent) 20%, transparent);
                color: #1a1a1a;
              }
              .react-calendar__tile--active {
                background: color-mix(in srgb, var(--calendar-accent) 40%, transparent);
                color: white;
                font-weight: 600;
              }
              .light .react-calendar__tile--active {
                background: color-mix(in srgb, var(--calendar-accent) 30%, transparent);
                color: #1a1a1a;
              }
              .react-calendar__tile--active:enabled:hover,
              .react-calendar__tile--active:enabled:focus {
                background: color-mix(in srgb, var(--calendar-accent) 50%, transparent);
              }
              .light .react-calendar__tile--active:enabled:hover,
              .light .react-calendar__tile--active:enabled:focus {
                background: color-mix(in srgb, var(--calendar-accent) 40%, transparent);
              }
            `}</style>
            <Calendar
              onChange={(value) => setSelectedDate(value as Date)}
              value={selectedDate}
              tileContent={tileContent}
              className="text-white"
            />
          </div>
        </motion.div>

        {/* Selected Date Bookings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div>
            <h2 className="text-xl font-bold text-white mb-2">
              {format(selectedDate, "MMMM d, yyyy")}
            </h2>
            <p className="text-sm text-white/60">
              {selectedDateCalls.length} booking{selectedDateCalls.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-white/40 text-center py-8">Loading...</div>
            ) : selectedDateCalls.length === 0 ? (
              <div className="text-white/40 text-center py-8">No bookings on this date</div>
            ) : (
              selectedDateCalls.map((call) => {
                const isHighlighted = highlightedCallId === call.id;
                return (
                <motion.div
                  key={call.id}
                  ref={isHighlighted ? highlightedCallRef : null}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    scale: isHighlighted ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                  className={`p-3 sm:p-4 rounded-lg sm:rounded-xl bg-black transition-all ${
                    isHighlighted
                      ? ""
                      : "border border-white/10 hover:border-yellow-500/50"
                  }`}
                  style={isHighlighted ? {
                    border: `2px solid ${accentColor}`,
                    backgroundColor: `${accentColor}15`,
                    boxShadow: `0 0 0 2px ${accentColor}40, 0 4px 12px ${accentColor}30`,
                  } : {}}
                >
                    <div className="mb-2 sm:mb-3">
                      <div className="font-semibold text-white text-sm sm:text-base mb-1">
                        {call.patient_name || "Unknown"}
                      </div>
                      <div className="text-xs sm:text-sm text-white/60">
                        {getBookingDate(call)}
                      </div>
                    </div>
                    {call.last_summary && (
                      <p 
                        className="text-white/70 text-xs sm:text-sm line-clamp-3 cursor-pointer hover:text-white transition-colors"
                        onClick={() => {
                          setSelectedBooking(call);
                          setIsBookingModalOpen(true);
                        }}
                      >
                        {call.last_summary}
                      </p>
                    )}
                </motion.div>
              );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Booking Summary Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isBookingModalOpen && selectedBooking && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setIsBookingModalOpen(false);
                    setSelectedBooking(null);
                  }}
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                  <div
                    className="bg-black rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-xl border"
                          style={{
                            background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                            borderColor: `${accentColor}4D`,
                          }}
                        >
                          <CalendarIcon className="h-6 w-6" style={{ color: accentColor }} />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            {selectedBooking.patient_name || "Unknown"}
                          </h2>
                          <p className="text-sm text-white/60 mt-1">
                            {getBookingDate(selectedBooking)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsBookingModalOpen(false);
                          setSelectedBooking(null);
                        }}
                        className="p-2 rounded-xl hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors"
                      >
                        <X className="h-5 w-5 text-white/60" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {selectedBooking.last_summary && (
                        <div>
                          <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">
                            Summary
                          </div>
                          <p className="text-white leading-relaxed">
                            {selectedBooking.last_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
