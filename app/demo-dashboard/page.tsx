"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import RealtimeCalls from "@/components/RealtimeCalls";
import LiveContextRibbon from "@/components/LiveContextRibbon";
import Sparkline from "@/components/Sparkline";
import { getSupabaseClient } from "@/lib/supabase";
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
  Lock
} from "lucide-react";
import { format, startOfWeek, startOfMonth, subMonths, subWeeks } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

// Demo business ID - set this to a real business ID for demo purposes
const DEMO_BUSINESS_ID = process.env.NEXT_PUBLIC_DEMO_BUSINESS_ID || "";

type DashboardCall = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  schedule: any;
  success: boolean | null;
  last_intent: string | null;
  patient_name: string | null;
};

type PerformanceMetrics = {
  totalCallsHandled: number;
  bookingsThisWeek: number;
  bookingsLastWeek: number;
  conversionRate: number;
  conversionRateLastMonth: number;
  timeSavedHours: number;
  handledCalls: number;
  missedCalls: number;
  newPatients: number;
  repeatPatients: number;
  estimatedSavings: number;
  bookingsThisWeekTrend: number[];
};

type Insight = {
  type: "busiest_day" | "busiest_hours" | "common_intent" | "actionable";
  message: string;
  icon: React.ElementType;
  actionable?: boolean;
};

type ActivityItem = {
  id: string;
  type: "booking" | "call" | "achievement" | "streak";
  message: string;
  timestamp: Date;
  patientName?: string;
};

export default function DemoDashboard() {
  const { accentColor } = useAccentColor();
  const [mounted, setMounted] = useState(false);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    totalCallsHandled: 0,
    bookingsThisWeek: 0,
    bookingsLastWeek: 0,
    conversionRate: 0,
    conversionRateLastMonth: 0,
    timeSavedHours: 0,
    handledCalls: 0,
    missedCalls: 0,
    newPatients: 0,
    repeatPatients: 0,
    estimatedSavings: 0,
    bookingsThisWeekTrend: [],
  });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [successStreak, setSuccessStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [metricKey, setMetricKey] = useState(0);

  const [demoBusinessId, setDemoBusinessId] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    
    async function getDemoBusinessId() {
      const supabase = getSupabaseClient();
      
      // Use configured demo business ID, or get the first business from database
      if (DEMO_BUSINESS_ID) {
        setDemoBusinessId(DEMO_BUSINESS_ID);
        sessionStorage.setItem("business_id", DEMO_BUSINESS_ID);
      } else {
        // Get first business from database for demo
        const { data: businesses } = await supabase
          .from("businesses")
          .select("id, name")
          .limit(1)
          .order("created_at", { ascending: false });
        
        if (businesses && businesses.length > 0) {
          const firstBusiness = businesses[0];
          setDemoBusinessId(firstBusiness.id);
          sessionStorage.setItem("business_id", firstBusiness.id);
        }
      }
    }
    
    getDemoBusinessId();
  }, []);

  useEffect(() => {
    if (!mounted || !demoBusinessId) {
      setLoading(false);
      return;
    }

    async function loadBusinessName() {
      const supabase = getSupabaseClient();
      const { data: businessDataRaw } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", demoBusinessId)
        .maybeSingle();
      
      if (businessDataRaw && (businessDataRaw as any).name) {
        setBusinessName((businessDataRaw as any).name);
      }
    }

    loadBusinessName();
  }, [mounted, demoBusinessId]);

  useEffect(() => {
    if (!mounted || !demoBusinessId) return;

    async function loadDashboardData() {
      const supabase = getSupabaseClient();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Calculate date ranges based on selected time period
      let periodStart: Date;
      let periodEnd: Date = now;
      let comparePeriodStart: Date;
      let comparePeriodEnd: Date;
      
      if (timePeriod === "daily") {
        periodStart = new Date(now);
        periodStart.setHours(now.getHours() - 24);
        comparePeriodStart = new Date(periodStart);
        comparePeriodStart.setHours(comparePeriodStart.getHours() - 24);
        comparePeriodEnd = periodStart;
      } else if (timePeriod === "weekly") {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
        comparePeriodStart = new Date(periodStart);
        comparePeriodStart.setDate(comparePeriodStart.getDate() - 7);
        comparePeriodEnd = periodStart;
      } else {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 30);
        comparePeriodStart = new Date(periodStart);
        comparePeriodStart.setDate(comparePeriodStart.getDate() - 30);
        comparePeriodEnd = periodStart;
      }

      const { data: allCallsData, error: callsError } = await supabase
        .from("calls")
        .select("id, started_at, ended_at, status, schedule, success, last_intent, patient_name")
        .eq("business_id", demoBusinessId)
        .order("started_at", { ascending: false })
        .limit(1000);

      if (callsError) {
        console.error("Error loading calls:", callsError);
        setError("Failed to load dashboard data. Please refresh the page.");
        setLoading(false);
        return;
      }
      
      setError(null);
      const allCalls = (allCallsData || []) as DashboardCall[];
      setLoading(false);

      if (!allCalls || allCalls.length === 0) {
        setInsights([]);
        setActivityFeed([]);
        setPerformance({
          totalCallsHandled: 0,
          bookingsThisWeek: 0,
          bookingsLastWeek: 0,
          conversionRate: 0,
          conversionRateLastMonth: 0,
          timeSavedHours: 0,
          handledCalls: 0,
          missedCalls: 0,
          newPatients: 0,
          repeatPatients: 0,
          estimatedSavings: 0,
          bookingsThisWeekTrend: [],
        });
        return;
      }

      // Calculate performance metrics
      const totalCallsInPeriod = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= periodStart && callDate <= periodEnd;
      }).length;
      
      const periodCalls = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= periodStart && callDate <= periodEnd && (c.status === "ended" || c.ended_at);
      });
      
      const comparePeriodCalls = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= comparePeriodStart && callDate < comparePeriodEnd && (c.status === "ended" || c.ended_at);
      });

      const totalCallsHandled = totalCallsInPeriod;
      const handledCalls = periodCalls.length;
      const missedCalls = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= periodStart && callDate <= periodEnd && 
               (c.status === "missed" || (c.success === false && c.ended_at && c.status !== "ended"));
      }).length;

      const bookingsThisPeriod = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= periodStart && callDate <= periodEnd && c.schedule !== null;
      }).length;
      
      const bookingsLastPeriod = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= comparePeriodStart && callDate < comparePeriodEnd && c.schedule !== null;
      }).length;

      // Generate trend data
      const bookingsTrend: number[] = [];
      if (timePeriod === "daily") {
        for (let i = 23; i >= 0; i--) {
          const hourStart = new Date(now);
          hourStart.setHours(now.getHours() - i, 0, 0, 0);
          const hourEnd = new Date(hourStart);
          hourEnd.setHours(hourEnd.getHours() + 1, 0, 0, 0);
          
          const hourBookings = allCalls.filter(c => {
            const callDate = new Date(c.started_at);
            return callDate >= hourStart && callDate < hourEnd && c.schedule !== null;
          }).length;
          bookingsTrend.push(hourBookings);
        }
      } else if (timePeriod === "weekly") {
        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(now);
          dayStart.setDate(dayStart.getDate() - i);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayBookings = allCalls.filter(c => {
            const callDate = new Date(c.started_at);
            return callDate >= dayStart && callDate <= dayEnd && c.schedule !== null;
          }).length;
          bookingsTrend.push(dayBookings);
        }
      } else {
        for (let i = 29; i >= 0; i--) {
          const dayStart = new Date(now);
          dayStart.setDate(dayStart.getDate() - i);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayBookings = allCalls.filter(c => {
            const callDate = new Date(c.started_at);
            return callDate >= dayStart && callDate <= dayEnd && c.schedule !== null;
          }).length;
          bookingsTrend.push(dayBookings);
        }
      }

      // New vs repeat patients
      const patientNames = new Set<string>();
      const patientCallCounts: Record<string, number> = {};
      allCalls.forEach(call => {
        if (call.patient_name) {
          patientNames.add(call.patient_name);
          patientCallCounts[call.patient_name] = (patientCallCounts[call.patient_name] || 0) + 1;
        }
      });
      const newPatients = Object.values(patientCallCounts).filter(count => count === 1).length;
      const repeatPatients = Object.values(patientCallCounts).filter(count => count > 1).length;

      const conversionRate = periodCalls.length > 0 
        ? (bookingsThisPeriod / periodCalls.length) * 100 
        : 0;

      const conversionRateLastPeriod = comparePeriodCalls.length > 0
        ? (bookingsLastPeriod / comparePeriodCalls.length) * 100
        : 0;

      const avgCallMinutes = 3;
      const timeSavedHours = (handledCalls * avgCallMinutes) / 60;
      const estimatedSavings = bookingsThisPeriod * 300;

      setPerformance({
        totalCallsHandled,
        bookingsThisWeek: bookingsThisPeriod,
        bookingsLastWeek: bookingsLastPeriod,
        conversionRate,
        conversionRateLastMonth: conversionRateLastPeriod,
        timeSavedHours,
        handledCalls,
        missedCalls,
        newPatients,
        repeatPatients,
        estimatedSavings,
        bookingsThisWeekTrend: bookingsTrend,
      });
      
      setMetricKey(prev => prev + 1);

      // Generate insights (simplified version)
      const newInsights: Insight[] = [];
      const dayCounts: Record<string, number> = {};
      allCalls.forEach(call => {
        const day = format(new Date(call.started_at), "EEEE");
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      const busiestDay = Object.entries(dayCounts).reduce((a, b) => 
        dayCounts[a[0]] > dayCounts[b[0]] ? a : b
      );
      if (busiestDay) {
        newInsights.push({
          type: "busiest_day",
          message: `Your busiest day is ${busiestDay[0]}.`,
          icon: Calendar,
        });
      }

      const hourCounts: Record<number, number> = {};
      allCalls.forEach(call => {
        const hour = new Date(call.started_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const sortedHours = Object.entries(hourCounts)
        .map(([h, c]) => ({ hour: parseInt(h), count: c }))
        .sort((a, b) => b.count - a.count);
      
      if (sortedHours.length >= 2) {
        const topHours = sortedHours.slice(0, 3).map(h => {
          const period = h.hour >= 12 ? `${h.hour === 12 ? 12 : h.hour - 12} PM` : `${h.hour === 0 ? 12 : h.hour} AM`;
          return period;
        });
        if (topHours.length > 0) {
          newInsights.push({
            type: "busiest_hours",
            message: `Patients most often call between ${topHours[0]}–${topHours[topHours.length - 1]}.`,
            icon: Clock,
          });
        }
      }

      // Activity feed
      const activities: ActivityItem[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayCalls = allCalls
        .filter(c => {
          const callDate = new Date(c.started_at);
          return callDate >= today;
        })
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 10);
      
      todayCalls.forEach(c => {
        if (c.schedule !== null) {
          activities.push({
            id: `booking-${c.id}`,
            type: "booking",
            message: `${c.patient_name || "Unknown caller"} booked an appointment`,
            timestamp: new Date(c.started_at),
            patientName: c.patient_name || undefined,
          });
        } else {
          activities.push({
            id: `call-${c.id}`,
            type: "call",
            message: `${c.patient_name || "Unknown caller"} called`,
            timestamp: new Date(c.started_at),
            patientName: c.patient_name || undefined,
          });
        }
      });

      const periodSuccessful = periodCalls.filter(c => c.success === true);
      setSuccessStreak(periodSuccessful.length);

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivityFeed(activities.slice(0, 5));
    }

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [mounted, timePeriod, demoBusinessId]);

  const conversionTrend = useMemo(() => 
    performance.conversionRate - performance.conversionRateLastMonth,
    [performance.conversionRate, performance.conversionRateLastMonth]
  );

  const handledRatio = useMemo(() => 
    performance.handledCalls + performance.missedCalls > 0
      ? (performance.handledCalls / (performance.handledCalls + performance.missedCalls)) * 100
      : 100,
    [performance.handledCalls, performance.missedCalls]
  );

  const bookingsTrend = useMemo(() => 
    performance.bookingsThisWeek - performance.bookingsLastWeek,
    [performance.bookingsThisWeek, performance.bookingsLastWeek]
  );

  const bookingsTrendPercent = useMemo(() => 
    performance.bookingsLastWeek > 0
      ? ((bookingsTrend / performance.bookingsLastWeek) * 100)
      : 0,
    [bookingsTrend, performance.bookingsLastWeek]
  );

  const totalBookings = useMemo(() => 
    Math.round(performance.estimatedSavings / 300),
    [performance.estimatedSavings]
  );

  const humanizedConversion = useMemo(() => {
    const successfulBookings = Math.round(performance.conversionRate * performance.handledCalls / 100);
    return performance.handledCalls > 0
      ? `${successfulBookings} new patient${successfulBookings !== 1 ? 's' : ''} booked — ${performance.missedCalls} missed opportunity${performance.missedCalls !== 1 ? 'ies' : 'y'}`
      : "No calls yet";
  }, [performance.conversionRate, performance.handledCalls, performance.missedCalls]);

  if (!mounted) return null;

  if (!demoBusinessId && !loading) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="p-6 rounded-xl glass-strong border border-red-500/30 text-center">
          <Lock className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Business Data Available</h2>
          <p className="text-white/60">
            No businesses found in the database. Please add a business to enable the demo dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Read-Only Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 sm:p-4 rounded-xl glass-strong border border-yellow-500/30 bg-yellow-500/10"
      >
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-white font-medium text-sm sm:text-base">
              Read-Only Demo Mode
            </p>
            <p className="text-white/60 text-xs sm:text-sm">
              You can view live data, call logs, and details, but all actions are disabled.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Live Demo Dashboard</h1>
            {businessName && (
              <span className="text-base sm:text-lg lg:text-xl font-medium text-white/60">— {businessName}</span>
            )}
            <span className="beta-badge">Read Only</span>
          </div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xs font-medium"
            style={{ color: `${accentColor}CC`, textShadow: `0 0 6px ${accentColor}66` }}
          >
            #Live Demo Mode
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
            Viewing live data in read-only mode
          </div>
        </motion.div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400"
        >
          <span>{error}</span>
        </motion.div>
      )}

      {/* Performance Overview - Same as real dashboard */}
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
            <motion.div 
              key={`totalCalls-value-${metricKey}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xl sm:text-2xl font-bold text-white"
            >
              {loading ? "..." : performance.totalCallsHandled.toLocaleString()}
            </motion.div>
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
            <motion.div 
              key={`bookings-value-${metricKey}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-bold text-white mb-2"
            >
              {loading ? "..." : performance.bookingsThisWeek}
            </motion.div>
            {performance.bookingsThisWeekTrend.length > 0 && (
              <div className="absolute bottom-3 right-3 opacity-60">
                <Sparkline 
                  data={performance.bookingsThisWeekTrend} 
                  width={50} 
                  height={16}
                  color={bookingsTrend > 0 ? "#10b981" : bookingsTrend < 0 ? "#ef4444" : accentColor}
                />
              </div>
            )}
            <div className="text-xs text-white/40">
              vs {performance.bookingsLastWeek} {timePeriod === "daily" ? "yesterday" : timePeriod === "weekly" ? "last week" : "last month"}
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
            <motion.div 
              key={`conversion-value-${metricKey}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium text-white/90 mb-1 line-clamp-2"
            >
              {loading ? "..." : humanizedConversion}
            </motion.div>
            <div className="text-xs text-white/40 mt-1">
              {performance.conversionRate.toFixed(1)}% rate
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
            <motion.div 
              key={`savings-value-${metricKey}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-bold text-white"
            >
              {loading ? "..." : `$${performance.estimatedSavings.toFixed(0)}`}
            </motion.div>
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
            <motion.div 
              key={`ratio-value-${metricKey}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-bold text-white"
            >
              {loading ? "..." : `${handledRatio.toFixed(1)}%`}
            </motion.div>
            <div className="text-xs text-white/40 mt-1">
              {performance.missedCalls} missed
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Success Streak */}
      {successStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-4 sm:p-6 rounded-xl sm:rounded-2xl glass-strong border"
          style={{
            borderColor: `${accentColor}4D`,
            background: `linear-gradient(to right, ${accentColor}1A, ${accentColor}33)`,
          }}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div 
              className="p-2 sm:p-3 rounded-lg sm:rounded-xl border flex-shrink-0"
              style={{
                backgroundColor: `${accentColor}33`,
                borderColor: `${accentColor}4D`,
              }}
            >
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg font-bold text-white">
                Success Streak: {successStreak} calls handled flawlessly this month!
              </div>
              <div className="text-xs sm:text-sm text-white/60 mt-1">
                Keep up the excellent work!
              </div>
            </div>
          </div>
        </motion.div>
      )}

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
            {loading ? (
              <div className="text-white/40 text-center py-8">Loading insights...</div>
            ) : insights.length === 0 ? (
              <div className="text-white/40 text-center py-8">No insights available yet</div>
            ) : (
              insights.map((insight, index) => {
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
              })
            )}
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
            {loading ? (
              <div className="text-white/40 text-center py-8">Loading activity...</div>
            ) : activityFeed.length === 0 ? (
              <div className="text-white/40 text-center py-8">No recent activity</div>
            ) : (
              activityFeed.map((activity, index) => (
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
                    {activity.type === "streak" && (
                      <Trophy className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm">{activity.message}</p>
                      <p className="text-white/40 text-xs mt-1">
                        {format(activity.timestamp, "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Calls - Using Real Component */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-white mb-6">Recent Calls</h2>
        <RealtimeCalls businessId={demoBusinessId} readOnly={true} />
      </motion.div>

      {/* Live Context Ribbon */}
      <LiveContextRibbon businessId={demoBusinessId} />
    </div>
  );
}
