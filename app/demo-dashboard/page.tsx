"use client";

import { useState, useMemo } from "react";
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
  Users,
  Lock,
  PhoneIncoming,
  PhoneOff,
  BadgeCheck,
  Bot,
  UserCircle,
  FileText,
  MessageSquare,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

// Static dummy data
const dummyPerformance = {
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

const dummyInsights = [
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

const dummyActivity = [
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

const dummyCalls = [
  {
    id: "1",
    patient_name: "Sarah Johnson",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    schedule: { date: "2025-11-15", time: "10:00 AM" },
    last_intent: "book_appointment",
    phone: "+1 (555) 123-4567",
    last_summary: "Patient called to book a cleaning appointment for next week.",
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
    phone: "+1 (555) 234-5678",
    last_summary: "Inquired about office hours and services offered.",
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
    phone: "+1 (555) 345-6789",
    last_summary: "Booked a consultation appointment for next week.",
  },
  {
    id: "4",
    patient_name: "David Kim",
    status: "active",
    success: null,
    started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    ended_at: null,
    schedule: null,
    last_intent: "hours_inquiry",
    phone: "+1 (555) 456-7890",
    last_summary: "Currently on call...",
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
    phone: "+1 (555) 567-8901",
    last_summary: "Scheduled a follow-up appointment.",
  },
  {
    id: "6",
    patient_name: "Robert Williams",
    status: "ended",
    success: false,
    started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    schedule: null,
    last_intent: "general_inquiry",
    phone: "+1 (555) 678-9012",
    last_summary: "Call ended without booking.",
  },
];

const dummyCallLogs = [
  {
    id: "1",
    patient_name: "Sarah Johnson",
    phone: "+1 (555) 123-4567",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    duration: 180,
    last_intent: "book_appointment",
    schedule: { date: "2025-11-15", time: "10:00 AM" },
    transcript: "User: Hi, I'd like to book an appointment\nBot: I'd be happy to help you book an appointment. What type of service are you looking for?\nUser: I need a cleaning\nBot: Great! I can help you with that. When would you like to schedule?\nUser: Next week if possible\nBot: I have availability next Monday at 10 AM. Would that work?\nUser: Yes, that's perfect\nBot: Perfect! I've booked you for Monday, November 15th at 10:00 AM.",
  },
  {
    id: "2",
    patient_name: "Michael Chen",
    phone: "+1 (555) 234-5678",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    duration: 240,
    last_intent: "general_inquiry",
    schedule: null,
    transcript: "User: What are your hours?\nBot: We're open Monday through Friday from 9 AM to 5 PM, and Saturday from 10 AM to 2 PM. We're closed on Sundays.\nUser: What services do you offer?\nBot: We offer a wide range of services including consultations, cleanings, and follow-up appointments. Would you like to schedule something?\nUser: Not right now, thanks\nBot: No problem! Feel free to call back anytime.",
  },
  {
    id: "3",
    patient_name: "Emily Rodriguez",
    phone: "+1 (555) 345-6789",
    status: "ended",
    success: true,
    started_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    ended_at: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
    duration: 240,
    last_intent: "book_appointment",
    schedule: { date: "2025-11-16", time: "2:00 PM" },
    transcript: "User: I need to schedule a consultation\nBot: I'd be happy to help you schedule a consultation. When would you like to come in?\nUser: Next Tuesday afternoon\nBot: I have availability next Tuesday at 2 PM. Does that work for you?\nUser: Yes, that works\nBot: Perfect! I've scheduled your consultation for Tuesday, November 16th at 2:00 PM.",
  },
];

export default function DemoDashboard() {
  const { accentColor } = useAccentColor();
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  const conversionTrend = useMemo(() => 
    dummyPerformance.conversionRate - dummyPerformance.conversionRateLastMonth,
    []
  );

  const handledRatio = useMemo(() => 
    dummyPerformance.handledCalls + dummyPerformance.missedCalls > 0
      ? (dummyPerformance.handledCalls / (dummyPerformance.handledCalls + dummyPerformance.missedCalls)) * 100
      : 100,
    []
  );

  const bookingsTrend = useMemo(() => 
    dummyPerformance.bookingsThisWeek - dummyPerformance.bookingsLastWeek,
    []
  );

  const bookingsTrendPercent = useMemo(() => 
    dummyPerformance.bookingsLastWeek > 0
      ? ((bookingsTrend / dummyPerformance.bookingsLastWeek) * 100)
      : 0,
    [bookingsTrend]
  );

  const totalBookings = useMemo(() => 
    Math.round(dummyPerformance.estimatedSavings / 300),
    []
  );

  const humanizedConversion = useMemo(() => {
    const successfulBookings = Math.round(dummyPerformance.conversionRate * dummyPerformance.handledCalls / 100);
    return dummyPerformance.handledCalls > 0
      ? `${successfulBookings} new patient${successfulBookings !== 1 ? 's' : ''} booked — ${dummyPerformance.missedCalls} missed opportunity${dummyPerformance.missedCalls !== 1 ? 'ies' : 'y'}`
      : "No calls yet";
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Read-Only Banner with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 p-3 sm:p-4 glass-strong border-b border-yellow-500/30 bg-yellow-500/10"
      >
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Link
            href="https://coya-website.vercel.app"
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass border border-white/20 hover:border-accent/50 transition-all duration-200 text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Website</span>
          </Link>
          <div className="flex-1 flex items-center gap-3">
            <Lock className="h-5 w-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium text-sm sm:text-base">
                Read-Only Demo Mode
              </p>
              <p className="text-white/60 text-xs sm:text-sm">
                Scroll down to explore different sections of the dashboard
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Scrollable Sections Container */}
      <div className="space-y-0">
        {/* Section 1: Main Dashboard */}
        <section className="min-h-screen flex items-start justify-center py-8 px-4 sm:px-6">
          <div className="w-full max-w-7xl space-y-4 sm:space-y-6 lg:space-y-8">
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
                
                <div className="flex items-center gap-1 sm:gap-2 p-0.5 sm:p-1 rounded-lg glass border border-white/10">
                  {(["daily", "weekly", "monthly"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setTimePeriod(period)}
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
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 sm:p-4 rounded-lg sm:rounded-xl glass border border-white/10"
                >
                  <div className="text-xs text-white/60 mb-1">Total Calls Handled</div>
                  <div className="text-xl sm:text-2xl font-bold text-white">
                    {dummyPerformance.totalCallsHandled.toLocaleString()}
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
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
                    {dummyPerformance.bookingsThisWeek}
                  </div>
                  {dummyPerformance.bookingsThisWeekTrend.length > 0 && (
                    <div className="absolute bottom-3 right-3 opacity-60">
                      <Sparkline 
                        data={dummyPerformance.bookingsThisWeekTrend} 
                        width={50} 
                        height={16}
                        color={bookingsTrend > 0 ? "#10b981" : bookingsTrend < 0 ? "#ef4444" : accentColor}
                      />
                    </div>
                  )}
                  <div className="text-xs text-white/40">
                    vs {dummyPerformance.bookingsLastWeek} {timePeriod === "daily" ? "yesterday" : timePeriod === "weekly" ? "last week" : "last month"}
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
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
                    {dummyPerformance.conversionRate.toFixed(1)}% rate
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-xl glass border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-3 w-3" style={{ color: accentColor }} />
                    <div className="text-xs text-white/60">Estimated Savings</div>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    ${dummyPerformance.estimatedSavings.toFixed(0)}
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {totalBookings} patient{totalBookings !== 1 ? 's' : ''} booked × $300
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-xl glass border border-white/10"
                >
                  <div className="text-xs text-white/60 mb-1">Handled Ratio</div>
                  <div className="text-2xl font-bold text-white">
                    {handledRatio.toFixed(1)}%
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {dummyPerformance.missedCalls} missed
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
                  {dummyInsights.map((insight, index) => {
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
                  {dummyActivity.map((activity, index) => (
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
          </div>
        </section>

        {/* Section 2: Live Calls View */}
        <section className="min-h-screen flex items-start justify-center py-8 px-4 sm:px-6 bg-gradient-to-b from-transparent to-black/20">
          <div className="w-full max-w-7xl space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Live Calls</h2>
                  <p className="text-white/60">Real-time call monitoring and status</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <BadgeCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Live</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dummyCalls.map((call, index) => (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="group p-5 rounded-2xl glass border border-white/10 hover:bg-white/10 cursor-pointer"
                    style={{
                      borderColor: call.status === "active" ? `${accentColor}80` : "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {call.status === "active" ? (
                          <div 
                            className="p-2 rounded-xl border"
                            style={{
                              backgroundColor: `${accentColor}33`,
                              borderColor: `${accentColor}4D`,
                            }}
                          >
                            <PhoneIncoming className="h-5 w-5" style={{ color: accentColor }} />
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-white/10">
                            <PhoneOff className="h-5 w-5 text-white/60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold truncate">
                            {call.patient_name}
                          </div>
                          {call.phone && (
                            <div className="text-white/60 text-sm truncate">{call.phone}</div>
                          )}
                        </div>
                      </div>
                      {call.success && call.status === "ended" && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-white/60 text-xs">
                        {format(new Date(call.started_at), "MMM d, h:mm a")}
                      </div>
                      {call.schedule && (
                        <div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium inline-block">
                          Booked: {call.schedule.date} at {call.schedule.time}
                        </div>
                      )}
                      {call.last_summary && (
                        <div className="text-white/70 text-sm line-clamp-2">
                          {call.last_summary}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 3: Call Logs */}
        <section className="min-h-screen flex items-start justify-center py-8 px-4 sm:px-6">
          <div className="w-full max-w-7xl space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">Call Logs</h2>
                <p className="text-white/60">Complete call history with transcripts</p>
              </div>

              <div className="space-y-4">
                {dummyCallLogs.map((call, index) => (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="p-6 rounded-xl glass border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div 
                          className="p-3 rounded-xl border flex-shrink-0"
                          style={{
                            backgroundColor: `${accentColor}33`,
                            borderColor: `${accentColor}4D`,
                          }}
                        >
                          <Phone className="h-6 w-6" style={{ color: accentColor }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-semibold text-lg">{call.patient_name}</h3>
                            {call.success && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            )}
                            {call.schedule && (
                              <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                                Booked
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-3">
                            <span>{call.phone}</span>
                            <span>•</span>
                            <span>{format(new Date(call.started_at), "MMM d, yyyy 'at' h:mm a")}</span>
                            <span>•</span>
                            <span>{call.duration}s duration</span>
                            {call.last_intent && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{call.last_intent.replace(/_/g, " ")}</span>
                              </>
                            )}
                          </div>
                          {call.transcript && (
                            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
                              <div className="flex items-center gap-2 mb-3">
                                <FileText className="h-4 w-4 text-white/60" />
                                <span className="text-sm font-medium text-white/80">Transcript</span>
                              </div>
                              <div className="space-y-2 text-sm text-white/70">
                                {call.transcript.split('\n').map((line, i) => {
                                  const isUser = line.startsWith('User:');
                                  const isBot = line.startsWith('Bot:');
                                  return (
                                    <div key={i} className={`flex items-start gap-2 ${isUser ? 'justify-end' : ''}`}>
                                      {isBot && <Bot className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />}
                                      <div className={`px-3 py-2 rounded-lg max-w-[80%] ${
                                        isUser 
                                          ? 'bg-white/10 text-white' 
                                          : isBot 
                                            ? 'bg-white/5 text-white/80'
                                            : 'text-white/60'
                                      }`}>
                                        {line.replace(/^(User|Bot):\s*/, '')}
                                      </div>
                                      {isUser && <UserCircle className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
