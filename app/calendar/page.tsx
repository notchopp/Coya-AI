"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Calendar from "react-calendar";
import { getSupabaseClient } from "@/lib/supabase";
import { format, isSameDay } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const { data, error } = await supabase
        .from("calls")
        .select("id,started_at,patient_name,last_summary,schedule")
        .eq("business_id", businessId!)
        .not("schedule", "is", null)
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
    if (!call.schedule) return null;
    
    const schedule = call.schedule;
    
    // Try various common date field names
    const dateFields = [
      schedule.date,
      schedule.appointment_date,
      schedule.datetime,
      schedule.appointment_datetime,
      schedule.time,
      schedule.scheduled_time,
      schedule.start_time,
      schedule.start_date,
    ].filter(Boolean);
    
    if (dateFields.length === 0) {
      // If no date field found, check if schedule is a string
      if (typeof schedule === "string") {
        try {
          return new Date(schedule);
        } catch {
          // Fallback to started_at if schedule string parsing fails
          return new Date(call.started_at);
        }
      }
      // If schedule object exists but no date field, use started_at as fallback
      return new Date(call.started_at);
    }
    
    try {
      return new Date(dateFields[0]);
    } catch {
      // Fallback to started_at if date parsing fails
      return new Date(call.started_at);
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
        return format(scheduleDate, "MMM d, yyyy 'at' h:mm a");
      } catch {
        return format(new Date(call.started_at), "MMM d, yyyy 'at' h:mm a");
      }
    }
    
    return format(new Date(call.started_at), "MMM d, yyyy 'at' h:mm a");
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold text-white">Calendar</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <div className="p-6 rounded-2xl glass-strong border border-white/10">
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
              selectedDateCalls.map((call) => (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                    className="p-4 rounded-xl glass border border-white/10 hover:border-yellow-500/50 transition-all"
                  >
                    <div className="mb-3">
                      <div className="font-semibold text-white text-base mb-1">
                        {call.patient_name || "Unknown"}
                      </div>
                      <div className="text-sm text-white/60">
                        {getBookingDate(call)}
                      </div>
                    </div>
                    {call.last_summary && (
                      <p className="text-white/70 text-sm line-clamp-3">
                        {call.last_summary}
                      </p>
                    )}
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
