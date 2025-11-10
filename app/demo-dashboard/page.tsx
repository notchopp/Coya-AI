"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import Sparkline from "@/components/Sparkline";
import { 
  Phone, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Zap,
  Lightbulb,
  Trophy,
  CheckCircle2,
  DollarSign,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

// Sample data - same structure as real dashboard
const samplePerformance = {
  totalCallsHandled: 127,
  bookingsThisWeek: 48,
  bookingsLastWeek: 32,
  conversionRate: 42.5,
  conversionRateLastMonth: 38.2,
  timeSavedHours: 24.5,
  handledCalls: 113,
  missedCalls: 14,
  newPatients: 35,
  repeatPatients: 13,
  estimatedSavings: 14400,
  bookingsThisWeekTrend: [3, 5, 7, 6, 8, 9, 10],
};

const sampleInsights = [
  {
    type: "actionable" as const,
    message: "12 PM handles 40% of your calls — schedule fewer manual appointments then to maximize AI capacity.",
    icon: Clock,
    actionable: true,
  },
  {
    type: "busiest_day" as const,
    message: "Your busiest day is Tuesday.",
    icon: Calendar,
  },
  {
    type: "busiest_hours" as const,
    message: "Patients most often call between 10 AM–2 PM.",
    icon: Clock,
  },
];

const sampleActivity = [
  {
    id: "1",
    type: "booking" as const,
    message: "Sarah Johnson booked an appointment",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    patientName: "Sarah Johnson",
  },
  {
    id: "2",
    type: "call" as const,
    message: "Michael Chen called",
    timestamp: new Date(Date.now() - 32 * 60 * 1000),
    patientName: "Michael Chen",
  },
  {
    id: "3",
    type: "booking" as const,
    message: "Emily Rodriguez booked an appointment",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    patientName: "Emily Rodriguez",
  },
  {
    id: "4",
    type: "call" as const,
    message: "David Kim called",
    timestamp: new Date(Date.now() - 58 * 60 * 1000),
    patientName: "David Kim",
  },
  {
    id: "5",
    type: "booking" as const,
    message: "Jessica Martinez booked an appointment",
    timestamp: new Date(Date.now() - 72 * 60 * 1000),
    patientName: "Jessica Martinez",
  },
];

const sampleCalls = [
  {
    id: "1",
    patient_name: "Sarah Johnson",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    schedule: { date: "2025-11-15", time: "10:00 AM" },
    last_intent: "book_appointment",
  },
  {
    id: "2",
    patient_name: "Michael Chen",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    schedule: null,
    last_intent: "general_inquiry",
  },
  {
    id: "3",
    patient_name: "Emily Rodriguez",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
    schedule: { date: "2025-11-16", time: "2:00 PM" },
    last_intent: "book_appointment",
  },
  {
    id: "4",
    patient_name: "David Kim",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 54 * 60 * 1000).toISOString(),
    schedule: null,
    last_intent: "hours_inquiry",
  },
  {
    id: "5",
    patient_name: "Jessica Martinez",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 68 * 60 * 1000).toISOString(),
    schedule: { date: "2025-11-17", time: "11:00 AM" },
    last_intent: "book_appointment",
  },
];

export default function DemoDashboard() {
  const { accentColor } = useAccentColor();
  const [mounted, setMounted] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [metricKey, setMetricKey] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const conversionTrend = useMemo(() => 
    samplePerformance.conversionRate - samplePerformance.conversionRateLastMonth,
    []
  );

  const handledRatio = useMemo(() => 
    samplePerformance.handledCalls + samplePerformance.missedCalls > 0
      ? (samplePerformance.handledCalls / (samplePerformance.handledCalls + samplePerformance.missedCalls)) * 100
      : 100,
    []
  );

  const bookingsTrend = useMemo(() => 
    samplePerformance.bookingsThisWeek - samplePerformance.bookingsLastWeek,
    []
  );

  const bookingsTrendPercent = useMemo(() => 
    samplePerformance.bookingsLastWeek > 0
      ? ((bookingsTrend / samplePerformance.bookingsLastWeek) * 100)
      : 0,
    [bookingsTrend]
  );

  const totalBookings = useMemo(() => 
    Math.round(samplePerformance.estimatedSavings / 300),
    []
  );

  const humanizedConversion = useMemo(() => {
    const successfulBookings = Math.round(samplePerformance.conversionRate * samplePerformance.handledCalls / 100);
    return samplePerformance.handledCalls > 0
      ? `${successfulBookings} new patient${successfulBookings !== 1 ? 's' : ''} booked — ${samplePerformance.missedCalls} missed opportunity${samplePerformance.missedCalls !== 1 ? 'ies' : 'y'}`
      : "No calls yet";
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Demo Dashboard</h1>
            <span className="text-base sm:text-lg lg:text-xl font-medium text-white/60">— Sample Business</span>
            <span className="beta-badge">Read Only</span>
          </div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xs font-medium"
            style={{ color: `${accentColor}CC`, textShadow: `0 0 6px ${accentColor}66` }}
          >
            #Demo Mode
          </motion.span>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0"
        >
          <div className="text-white/60 text-base sm:text-lg">
            Hey, <span className="font-medium" style={{ color: accentColor }}>Visitor</span>
          </div>
          <div className="text-white/50 text-xs sm:text-sm italic">
            This is a read-only demo with sample data
          </div>
        </motion.div>
      </motion.div>

      {/* Performance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl glass-strong border border-white/10"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div 
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border"
              style={{
                background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                borderColor: `${accentColor}4D`,
              }}
            >
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Performance Overview</h2>
            </div>
          </div>
          
          {/* Time Period Toggle */}
          <div className="flex items-center gap-1 sm:gap-2 p-0.5 sm:p-1 rounded-lg glass border border-white/10">
            {(["daily", "weekly", "monthly"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                aria-label={`Switch to ${period} view`}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all min-h-[44px] ${
                  timePeriod === period
                    ? "border"
                    : "text-white/60 hover:text-white/80"
                }`}
                style={timePeriod === period ? {
                  backgroundColor: `${accentColor}33`,
                  color: accentColor,
                  borderColor: `${accentColor}4D`,
                } : {}}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <motion.div 
            key={`totalCalls-${metricKey}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="p-3 sm:p-4 rounded-lg sm:rounded-xl glass border border-white/10"
          >
            <div className="text-xs text-white/60 mb-1">Total Calls Handled</div>
            <div className="text-xl sm:text-2xl font-bold text-white">
              {samplePerformance.totalCallsHandled.toLocaleString()}
            </div>
          </motion.div>

          <motion.div 
            key={`bookings-${metricKey}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="p-4 rounded-xl glass border border-white/10 relative"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-white/60">
                Bookings {timePeriod === "daily" ? "Today" : timePeriod === "weekly" ? "This Week" : "This Month"}
              </div>
              {bookingsTrend !== 0 && bookingsTrendPercent !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${
                  bookingsTrend > 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {bookingsTrend > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(bookingsTrendPercent).toFixed(0)}%
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {samplePerformance.bookingsThisWeek}
            </div>
            {samplePerformance.bookingsThisWeekTrend.length > 0 && (
              <div className="absolute bottom-3 right-3 opacity-60">
                <Sparkline 
                  data={samplePerformance.bookingsThisWeekTrend} 
                  width={50} 
                  height={16}
                  color={bookingsTrend > 0 ? "#10b981" : bookingsTrend < 0 ? "#ef4444" : accentColor}
                />
              </div>
            )}
            <div className="text-xs text-white/40">
              vs {samplePerformance.bookingsLastWeek} {timePeriod === "daily" ? "yesterday" : timePeriod === "weekly" ? "last week" : "last month"}
            </div>
          </motion.div>

          <motion.div 
            key={`conversion-${metricKey}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="p-4 rounded-xl glass border border-white/10"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-white/60">Conversion</div>
              {conversionTrend !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${
                  conversionTrend > 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {conversionTrend > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(conversionTrend).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-sm font-medium text-white/90 mb-1 line-clamp-2">
              {humanizedConversion}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {samplePerformance.conversionRate.toFixed(1)}% rate
            </div>
          </motion.div>

          <motion.div 
            key={`savings-${metricKey}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="p-4 rounded-xl glass border border-white/10"
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 w-3" style={{ color: accentColor }} />
              <div className="text-xs text-white/60">Estimated Savings</div>
            </div>
            <div className="text-2xl font-bold text-white">
              ${samplePerformance.estimatedSavings.toFixed(0)}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {totalBookings} patient{totalBookings !== 1 ? 's' : ''} booked × $300
            </div>
          </motion.div>

          <motion.div 
            key={`ratio-${metricKey}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="p-4 rounded-xl glass border border-white/10"
          >
            <div className="text-xs text-white/60 mb-1">Handled Ratio</div>
            <div className="text-2xl font-bold text-white">
              {handledRatio.toFixed(1)}%
            </div>
            <div className="text-xs text-white/40 mt-1">
              {samplePerformance.missedCalls} missed
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 p-4 sm:p-6 rounded-xl sm:rounded-2xl glass-strong border border-white/10"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div 
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border"
              style={{
                background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                borderColor: `${accentColor}4D`,
              }}
            >
              <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">AI Insights</h2>
            </div>
          </div>

          <div className="space-y-3">
            {sampleInsights.map((insight, index) => {
              const Icon = insight.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`p-3 sm:p-4 rounded-lg sm:rounded-xl glass border flex items-start gap-2 sm:gap-3 ${
                    insight.actionable 
                      ? "border" 
                      : "border-white/10"
                  }`}
                  style={insight.actionable ? {
                    borderColor: `${accentColor}4D`,
                    backgroundColor: `${accentColor}0D`,
                  } : {}}
                >
                  <Icon 
                    className="h-5 w-5 mt-0.5 flex-shrink-0" 
                    style={{ color: insight.actionable ? accentColor : `${accentColor}B3` }}
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${
                      insight.actionable 
                        ? "text-white font-medium" 
                        : "text-white/90"
                    }`}>
                      {insight.message}
                    </p>
                    {insight.actionable && (
                      <div className="mt-2 text-xs flex items-center gap-1" style={{ color: `${accentColor}B3` }}>
                        <Lightbulb className="h-3 w-3" />
                        <span>AI recommendation</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 sm:p-6 rounded-xl sm:rounded-2xl glass-strong border border-white/10"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div 
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border"
              style={{
                background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                borderColor: `${accentColor}4D`,
              }}
            >
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Activity Feed</h2>
            </div>
          </div>

          <div className="space-y-3">
            {sampleActivity.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="p-3 rounded-lg glass border border-white/10"
              >
                <div className="flex items-start gap-2">
                  {activity.type === "booking" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  )}
                  {activity.type === "call" && (
                    <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm">{activity.message}</p>
                    <p className="text-white/40 text-xs mt-1">
                      {format(activity.timestamp, "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Calls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-white mb-6">Recent Calls</h2>
        <div className="space-y-3">
          {sampleCalls.map((call, index) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.05 }}
              className="p-4 rounded-xl glass border border-white/10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg border flex-shrink-0"
                    style={{
                      backgroundColor: `${accentColor}33`,
                      borderColor: `${accentColor}4D`,
                    }}
                  >
                    <Phone className="h-4 w-4" style={{ color: accentColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold">{call.patient_name}</h3>
                      {call.schedule && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                          Booked
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm">
                      {format(new Date(call.started_at), "MMM d, h:mm a")}
                    </p>
                    {call.schedule && (
                      <p className="text-white/50 text-xs mt-1">
                        Appointment: {call.schedule.date} at {call.schedule.time}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {call.success && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

