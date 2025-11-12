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
  Users
} from "lucide-react";
import { format, startOfWeek, startOfMonth, subMonths, subWeeks } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useProgram } from "@/components/ProgramProvider";
import { useUserRole } from "@/lib/useUserRole";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";
import ProgramSelector from "@/components/ProgramSelector";

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

type BusinessData = {
  name: string | null;
  vertical: string | null;
  services: string | null;
};

type UserData = {
  full_name: string | null;
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

export default function Dashboard() {
  const { accentColor } = useAccentColor();
  const { program, programId } = useProgram();
  const { role: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
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
  const [userName, setUserName] = useState<string>("");
  const [funFact, setFunFact] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [metricKey, setMetricKey] = useState(0); // Key for re-animating metrics

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load business name immediately - don't wait for mounted
  useEffect(() => {
    async function loadBusinessName() {
      if (typeof window === "undefined") return;
      
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");
      
      if (businessId) {
        const { data: businessDataRaw } = await supabase
          .from("businesses")
          .select("name")
          .eq("id", businessId)
          .maybeSingle();
        
        const businessData = businessDataRaw as { name: string | null } | null;
        
        if (businessData && businessData.name) {
          setBusinessName(businessData.name);
        }
      }
    }

    loadBusinessName();
    // Refresh business name every 30 seconds to catch updates
    const interval = setInterval(loadBusinessName, 30000);
    return () => clearInterval(interval);
  }, []); // Remove mounted dependency - load immediately

  // Load user data immediately - don't wait for mounted
  useEffect(() => {
    async function loadUserData() {
      if (typeof window === "undefined") return;
      
      const supabase = getSupabaseClient();
      const authUserId = (await supabase.auth.getUser()).data.user?.id;
      
      if (authUserId) {
        const { data: userDataRaw } = await supabase
          .from("users")
          .select("full_name")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        
        const userData = userDataRaw as UserData | null;
        
        if (userData && userData.full_name) {
          setUserName(userData.full_name);
        }
      }
    }

    loadUserData();

    // Listen for user name updates from settings page
    const handleUserNameUpdate = (event: CustomEvent) => {
      if (event.detail?.full_name) {
        setUserName(event.detail.full_name);
      }
    };

    window.addEventListener("userNameUpdated", handleUserNameUpdate as EventListener);
    
    return () => {
      window.removeEventListener("userNameUpdated", handleUserNameUpdate as EventListener);
    };
  }, []); // Remove mounted dependency - load immediately

  useEffect(() => {
    // Load data immediately - don't wait for mounted
    async function loadDashboardData() {
      if (typeof window === "undefined") return;
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        setLoading(false);
        return;
      }

      // Get user's program_id if they have one assigned (for non-admins)
      let userProgramId: string | null = null;
      if (!isAdmin) {
        const authUserId = (await supabase.auth.getUser()).data.user?.id;
        if (authUserId) {
          const { data: userData } = await supabase
            .from("users")
            .select("program_id")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          
          if (userData && (userData as any).program_id) {
            userProgramId = (userData as any).program_id;
          }
        }
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Calculate date ranges based on selected time period
      let periodStart: Date;
      let periodEnd: Date = now;
      let comparePeriodStart: Date;
      let comparePeriodEnd: Date;
      
      if (timePeriod === "daily") {
        // Last 24 hours
        periodStart = new Date(now);
        periodStart.setHours(now.getHours() - 24);
        
        comparePeriodStart = new Date(periodStart);
        comparePeriodStart.setHours(comparePeriodStart.getHours() - 24);
        comparePeriodEnd = periodStart;
      } else if (timePeriod === "weekly") {
        // Last 7 days
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
        
        comparePeriodStart = new Date(periodStart);
        comparePeriodStart.setDate(comparePeriodStart.getDate() - 7);
        comparePeriodEnd = periodStart;
      } else {
        // Last 30 days (monthly)
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 30);
        
        comparePeriodStart = new Date(periodStart);
        comparePeriodStart.setDate(comparePeriodStart.getDate() - 30);
        comparePeriodEnd = periodStart;
      }

      // Build query - filter by program_id
      // For non-admins with assigned program_id, use that
      // For admins or users without assigned program_id, use selected programId
      let callsQuery = supabase
        .from("calls")
        .select("id, started_at, ended_at, status, schedule, success, last_intent, patient_name, program_id")
        .eq("business_id", businessId!);
      
      // Filter by program_id:
      // - If user has assigned program_id (non-admin), use that
      // - Otherwise, if program is selected, use that
      // - Admins without selected program see all calls
      const filterProgramId = userProgramId || programId;
      if (filterProgramId) {
        callsQuery = callsQuery.eq("program_id", filterProgramId);
      }
      
      const { data: allCallsData, error: callsError } = await callsQuery
        .order("started_at", { ascending: false })
        .limit(1000);

      if (callsError) {
        console.error("Error loading calls:", callsError);
        setError("Failed to load dashboard data. Please refresh the page.");
        setLoading(false);
        setInsights([]);
        setActivityFeed([]);
        // Set error state for UI display
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
      
      // Clear any previous errors
      setError(null);

      const allCalls = ((allCallsData || []) as any[]) as DashboardCall[];

      // Always set loading to false, even if no calls
      setLoading(false);

      if (!allCalls || allCalls.length === 0) {
        // Set empty states for insights and activity feed
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

      // Calculate performance metrics based on selected period
      // Total calls in period (all calls, not just ended)
      const totalCallsInPeriod = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= periodStart && callDate <= periodEnd;
      }).length;
      
      // Ended calls in period (for handled calls metric)
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

      // Bookings in current period (count ALL calls with schedule, not just ended ones)
      const bookingsThisPeriod = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= periodStart && callDate <= periodEnd && c.schedule !== null;
      }).length;
      
      const bookingsLastPeriod = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= comparePeriodStart && callDate < comparePeriodEnd && c.schedule !== null;
      }).length;

      // Generate trend data based on period
      const bookingsTrend: number[] = [];
      if (timePeriod === "daily") {
        // Last 24 hours by hour
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
        // Last 7 days
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
        // Last 30 days by day
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

      // Conversion rate for current period
      const conversionRate = periodCalls.length > 0 
        ? (bookingsThisPeriod / periodCalls.length) * 100 
        : 0;

      // Conversion rate for comparison period
      const conversionRateLastPeriod = comparePeriodCalls.length > 0
        ? (bookingsLastPeriod / comparePeriodCalls.length) * 100
        : 0;

      // Time saved (approximation: assume 3 minutes per call handled)
      const avgCallMinutes = 3;
      const timeSavedHours = (handledCalls * avgCallMinutes) / 60;

      // Estimated savings: $300 per patient booked (for current period)
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
      
      // Trigger animation by updating key
      setMetricKey(prev => prev + 1);

      // Generate insights
      const newInsights: Insight[] = [];

      // Busiest day
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

      // Busiest hours
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

      // Most common intent
      const intentCounts: Record<string, number> = {};
      allCalls.forEach(call => {
        if (call.last_intent) {
          intentCounts[call.last_intent] = (intentCounts[call.last_intent] || 0) + 1;
        }
      });
      const totalWithIntents = Object.values(intentCounts).reduce((a, b) => a + b, 0);
      if (totalWithIntents > 0) {
        const topIntent = Object.entries(intentCounts).reduce((a, b) => 
          intentCounts[a[0]] > intentCounts[b[0]] ? a : b
        );
        const percentage = Math.round((topIntent[1] / totalWithIntents) * 100);
        newInsights.push({
          type: "common_intent",
          message: `${percentage}% of calls were about ${topIntent[0].replace(/_/g, " ")}.`,
          icon: Target,
        });
      }

      // Smart actionable insights - only show if data supports them
      
      // 1. Peak hour optimization (schedule fewer manual appointments during peak)
      if (sortedHours.length > 0) {
        const peakHour = sortedHours[0];
        const peakHourPercent = (peakHour.count / allCalls.length) * 100;
        if (peakHourPercent >= 20) {
          const peakPeriod = peakHour.hour >= 12 
            ? `${peakHour.hour === 12 ? 12 : peakHour.hour - 12} PM` 
            : `${peakHour.hour === 0 ? 12 : peakHour.hour} AM`;
          newInsights.push({
            type: "actionable",
            message: `${peakPeriod} handles ${peakHourPercent.toFixed(0)}% of your calls — schedule fewer manual appointments then to maximize AI capacity.`,
            icon: Clock,
            actionable: true,
          });
        }
      }

      // 2. Conversion rate by time of day (morning vs afternoon)
      if (sortedHours.length >= 2) {
        const morningCalls = allCalls.filter(c => {
          const hour = new Date(c.started_at).getHours();
          return hour >= 8 && hour < 12;
        });
        const afternoonCalls = allCalls.filter(c => {
          const hour = new Date(c.started_at).getHours();
          return hour >= 12 && hour < 17;
        });
        
        const morningBookings = morningCalls.filter(c => c.schedule !== null).length;
        const afternoonBookings = afternoonCalls.filter(c => c.schedule !== null).length;
        
        const morningRate = morningCalls.length > 0 ? (morningBookings / morningCalls.length) * 100 : 0;
        const afternoonRate = afternoonCalls.length > 0 ? (afternoonBookings / afternoonCalls.length) * 100 : 0;
        
        if (morningCalls.length >= 5 && afternoonCalls.length >= 5) {
          if (morningRate > afternoonRate * 1.3) {
            const diff = ((morningRate - afternoonRate) / afternoonRate * 100).toFixed(0);
            newInsights.push({
              type: "actionable",
              message: `Booking conversion is ${diff}% higher in the morning (${morningRate.toFixed(0)}% vs ${afternoonRate.toFixed(0)}%) — send reminder texts earlier in the day.`,
              icon: Target,
              actionable: true,
            });
          } else if (afternoonRate > morningRate * 1.3) {
            const diff = ((afternoonRate - morningRate) / morningRate * 100).toFixed(0);
            newInsights.push({
              type: "actionable",
              message: `Afternoon calls convert ${diff}% better — consider scheduling follow-up calls then.`,
              icon: Target,
              actionable: true,
            });
          }
        }
      }

      // 3. Repeat callers analysis (automated follow-up)
      if (repeatPatients >= 3) {
        const repeatCallerRate = (repeatPatients / patientNames.size) * 100;
        if (repeatCallerRate >= 15) {
          newInsights.push({
            type: "actionable",
            message: `${repeatPatients} repeat callers (${repeatCallerRate.toFixed(0)}% of patients) — set up automated follow-up SMS after appointments to reduce call volume.`,
            icon: Users,
            actionable: true,
          });
        }
      }

      // 4. Day of week patterns (pre-booking strategy)
      if (Object.keys(dayCounts).length >= 3 && busiestDay) {
        const avgCallsPerDay = allCalls.length / Object.keys(dayCounts).length;
        const busiestDayCount = busiestDay[1];
        if (busiestDayCount >= avgCallsPerDay * 1.5) {
          newInsights.push({
            type: "actionable",
            message: `${busiestDay[0]} calls are ${((busiestDayCount / avgCallsPerDay - 1) * 100).toFixed(0)}% above average — pre-book common requests via SMS the day before.`,
            icon: Calendar,
            actionable: true,
          });
        }
      }

      // 5. FAQ intent analysis (website optimization)
      if (totalWithIntents > 0) {
        const faqIntents = Object.entries(intentCounts).filter(([intent]) => 
          intent.toLowerCase().includes('faq') || 
          intent.toLowerCase().includes('question') || 
          intent.toLowerCase().includes('info') ||
          intent.toLowerCase().includes('information')
        );
        const faqCount = faqIntents.reduce((sum, [, count]) => sum + count, 0);
        const faqPercent = (faqCount / totalWithIntents) * 100;
        
        if (faqPercent >= 40) {
          newInsights.push({
            type: "actionable",
            message: `${faqPercent.toFixed(0)}% of calls are FAQs — your website FAQ page could answer these automatically, saving ${Math.round(faqCount * 3 / 60)} hours/week.`,
            icon: Lightbulb,
            actionable: true,
          });
        }
      }

      // 6. Missed call patterns by time (capacity management)
      if (handledCalls > 0 && missedCalls > 0) {
        const missRate = (missedCalls / (handledCalls + missedCalls)) * 100;
        if (missRate > 10) {
          // Find which hour has most missed calls
          const missedCallsByHour: Record<number, number> = {};
          const totalCallsByHour: Record<number, number> = {};
          
          allCalls.forEach(call => {
            const hour = new Date(call.started_at).getHours();
            totalCallsByHour[hour] = (totalCallsByHour[hour] || 0) + 1;
            if (call.status === "missed" || (call.success === false && call.ended_at && call.status !== "ended")) {
              missedCallsByHour[hour] = (missedCallsByHour[hour] || 0) + 1;
            }
          });
          
          const worstHour = Object.entries(missedCallsByHour)
            .map(([h, missed]) => ({ 
              hour: parseInt(h), 
              missed, 
              rate: (missed / (totalCallsByHour[parseInt(h)] || 1)) * 100 
            }))
            .sort((a, b) => b.rate - a.rate)[0];
          
          if (worstHour && worstHour.rate > missRate * 1.5) {
            const worstPeriod = worstHour.hour >= 12 
              ? `${worstHour.hour === 12 ? 12 : worstHour.hour - 12} PM` 
              : `${worstHour.hour === 0 ? 12 : worstHour.hour} AM`;
            newInsights.push({
              type: "actionable",
              message: `Missed calls spike at ${worstPeriod} (${worstHour.rate.toFixed(0)}% miss rate) — that's when AI is handling ${totalCallsByHour[worstHour.hour]} calls/hour. Consider staggering appointment confirmations.`,
              icon: Phone,
              actionable: true,
            });
          } else {
            newInsights.push({
              type: "actionable",
              message: `${missRate.toFixed(0)}% of calls are missed — Nia is already handling ${handledCalls} calls successfully. Consider enabling missed call text-back.`,
              icon: Phone,
              actionable: true,
            });
          }
        }
      }

      // 7. Low conversion rate warning (optimization opportunity)
      if (conversionRate < 30 && handledCalls >= 10) {
        const avgCallsPerDay = handledCalls / Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)));
        if (avgCallsPerDay >= 2) {
          newInsights.push({
            type: "actionable",
            message: `Conversion rate is ${conversionRate.toFixed(0)}% — with ${Math.round(avgCallsPerDay)} calls/day, optimizing to 50% would add ${Math.round(avgCallsPerDay * 0.2 * 30)} bookings/month.`,
            icon: TrendingUp,
            actionable: true,
          });
        }
      }

      // Only keep one actionable insight (prioritize the most important one)
      const actionableInsights = newInsights.filter(i => i.actionable);
      const regularInsights = newInsights.filter(i => !i.actionable);
      
      // If we have actionable insights, only show the first one
      if (actionableInsights.length > 0) {
        setInsights([actionableInsights[0], ...regularInsights.slice(0, 2)]);
      } else {
        setInsights(regularInsights.slice(0, 3));
      }

      // Generate activity feed - include ALL recent activity
      const activities: ActivityItem[] = [];
      
      // Get all recent calls from today - include ALL calls (bookings and regular calls)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get all calls from today, sorted by most recent first
      const todayCalls = allCalls
        .filter(c => {
          const callDate = new Date(c.started_at);
          return callDate >= today;
        })
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 10); // Get last 10 calls from today
      
      console.log("📋 Today's calls for activity feed:", todayCalls.length);
      console.log("📋 Sample calls:", todayCalls.slice(0, 3).map(c => ({
        call_id: c.id,
        patient_name: c.patient_name || "Unknown",
        has_schedule: !!c.schedule,
        started_at: c.started_at
      })));
      
      // Create activity items for each call
      todayCalls.forEach(c => {
        if (c.schedule !== null) {
          // Booking
          activities.push({
            id: `booking-${c.id}`,
            type: "booking",
            message: `${c.patient_name || "Unknown caller"} booked an appointment`,
            timestamp: new Date(c.started_at),
            patientName: c.patient_name || undefined,
          });
        } else {
          // Just a call, no booking
          activities.push({
            id: `call-${c.id}`,
            type: "call",
            message: `${c.patient_name || "Unknown caller"} called`,
            timestamp: new Date(c.started_at),
            patientName: c.patient_name || undefined,
          });
        }
      });

      // Success streak (consecutive successful calls in current period)
      const periodSuccessful = periodCalls.filter(c => c.success === true);
      setSuccessStreak(periodSuccessful.length);

      if (periodSuccessful.length >= 10) {
        activities.push({
          id: "streak",
          type: "streak",
          message: `You've handled ${periodSuccessful.length} calls ${timePeriod === "daily" ? "today" : timePeriod === "weekly" ? "this week" : "this month"} flawlessly!`,
          timestamp: new Date(),
        });
      }

      // Sort by timestamp (most recent first) and limit to 5
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      console.log("✅ Final activity feed items:", activities.length);
      console.log("✅ Activity items:", activities.map(a => ({
        type: a.type,
        message: a.message,
        timestamp: format(a.timestamp, "h:mm a")
      })));
      setActivityFeed(activities.slice(0, 5));

      // Generate fun fact based on real data (changes every 24 hours)
      generateFunFact(allCalls, businessId);
    }

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timePeriod, programId, isAdmin]); // Remove mounted dependency, add isAdmin

  async function generateFunFact(calls: any[], businessId: string) {
    if (!calls || calls.length === 0) {
      setFunFact("");
      return;
    }

    const supabase = getSupabaseClient();
    
    // Get business info for context
    const { data: businessDataRaw } = await supabase
      .from("businesses")
      .select("name, vertical, services")
      .eq("id", businessId)
      .maybeSingle();
    
    const businessData = businessDataRaw as BusinessData | null;

    // Calculate various metrics for fun facts
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === "ended" || c.ended_at !== null).length;
    const successRate = completedCalls > 0 
      ? (calls.filter(c => c.success === true).length / completedCalls) * 100 
      : 0;
    
    // Day of week analysis
    const dayCounts: { [key: string]: number } = {};
    calls.forEach(call => {
      const day = format(new Date(call.started_at), "EEEE");
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const busiestDay = Object.keys(dayCounts).reduce((a, b) => 
      dayCounts[a] > dayCounts[b] ? a : b, 
      Object.keys(dayCounts)[0] || ""
    );

    // Hour analysis
    const hourCounts: { [key: number]: number } = {};
    calls.forEach(call => {
      const hour = new Date(call.started_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const busiestHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b, 
      Object.keys(hourCounts)[0] || ""
    );
    const busiestHourFormatted = busiestHour 
      ? `${parseInt(busiestHour) % 12 === 0 ? 12 : parseInt(busiestHour) % 12}${parseInt(busiestHour) >= 12 ? "PM" : "AM"}`
      : "";

    // Intent analysis
    const intentCounts: { [key: string]: number } = {};
    calls.forEach(call => {
      if (call.last_intent) {
        intentCounts[call.last_intent] = (intentCounts[call.last_intent] || 0) + 1;
      }
    });
    const mostCommonIntent = Object.keys(intentCounts).reduce((a, b) => 
      intentCounts[a] > intentCounts[b] ? a : b, 
      Object.keys(intentCounts)[0] || ""
    );

    // Booking rate
    const bookings = calls.filter(c => c.schedule !== null).length;
    const bookingRate = totalCalls > 0 ? (bookings / totalCalls) * 100 : 0;

    // Time saved approximation
    const timeSavedHours = Math.round((completedCalls * 3) / 60);

    // Get array of possible facts based on available data
    const facts: string[] = [];

    if (totalCalls > 0) {
      facts.push(`You've handled ${totalCalls} call${totalCalls !== 1 ? "s" : ""} total`);
    }

    if (successRate > 0) {
      facts.push(`${successRate.toFixed(0)}% of your calls are successful`);
    }

    if (busiestDay) {
      facts.push(`${busiestDay} is your busiest day`);
    }

    if (busiestHourFormatted) {
      facts.push(`Most calls come in around ${busiestHourFormatted}`);
    }

    if (mostCommonIntent) {
      facts.push(`Most calls are about ${mostCommonIntent.toLowerCase()}`);
    }

    if (bookingRate > 0) {
      facts.push(`${bookingRate.toFixed(0)}% of calls result in bookings`);
    }

    if (timeSavedHours > 0) {
      facts.push(`You've saved approximately ${timeSavedHours} hour${timeSavedHours !== 1 ? "s" : ""} this month`);
    }

    if (businessData?.vertical) {
      facts.push(`You're in the ${businessData.vertical.toLowerCase()} industry`);
    }

    if (bookings > 0) {
      facts.push(`You've booked ${bookings} appointment${bookings !== 1 ? "s" : ""} total`);
    }

    if (facts.length === 0) {
      setFunFact("");
      return;
    }

    // Use date-based selection to rotate facts every 24 hours
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const factIndex = dayOfYear % facts.length;
    
    setFunFact(facts[factIndex]);
  }

  // Memoize expensive calculations
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

  // Calculate total bookings for savings display (estimatedSavings / 300)
  const totalBookings = useMemo(() => 
    Math.round(performance.estimatedSavings / 300),
    [performance.estimatedSavings]
  );

  // Humanize metrics
  const humanizedConversion = useMemo(() => {
    const successfulBookings = Math.round(performance.conversionRate * performance.handledCalls / 100);
    return performance.handledCalls > 0
      ? `${successfulBookings} new patient${successfulBookings !== 1 ? 's' : ''} booked — ${performance.missedCalls} missed opportunity${performance.missedCalls !== 1 ? 'ies' : 'y'}`
      : "No calls yet";
  }, [performance.conversionRate, performance.handledCalls, performance.missedCalls]);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Welcome Onboarding Modal */}
      <WelcomeOnboarding />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-1 mb-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Dashboard</h1>
              {businessName && (
                <span className="text-base sm:text-lg lg:text-xl font-medium text-white/60">— {businessName}</span>
              )}
              <span className="beta-badge">Beta</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {program?.name && !isAdmin && (
                <span className="text-sm sm:text-base font-medium text-white/40">{program.name}</span>
              )}
              {isAdmin && <ProgramSelector />}
            </div>
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
        </div>
        {userName && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0"
          >
            <div className="text-white/60 text-base sm:text-lg">
              Hey, <span className="font-medium" style={{ color: accentColor }}>{userName.split(' ')[0]}</span>
            </div>
            {funFact && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white/50 text-xs sm:text-sm italic max-w-[200px] sm:max-w-none"
              >
                {funFact}
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-between"
          role="alert"
          aria-live="polite"
        >
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              // Force reload by toggling timePeriod (will immediately toggle back)
              const currentPeriod = timePeriod;
              setTimePeriod(currentPeriod === "daily" ? "weekly" : "daily");
              setTimeout(() => setTimePeriod(currentPeriod), 10);
            }}
            className="px-3 py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/40 transition-colors text-sm font-medium"
            aria-label="Retry"
          >
            Retry
          </button>
        </motion.div>
      )}

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

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isAdmin ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-3 sm:gap-4`}>
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
                <motion.div 
                  key={`trend-${metricKey}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-1 text-xs ${
                    bookingsTrend > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {bookingsTrend > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(bookingsTrendPercent).toFixed(0)}%
                </motion.div>
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
                <motion.div 
                  key={`conversion-trend-${metricKey}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-1 text-xs ${
                    conversionTrend > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {conversionTrend > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(conversionTrend).toFixed(1)}%
                </motion.div>
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

          {/* Only show savings/revenue for admins */}
          {isAdmin && (
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
          )}

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
        {/* Contextual Insights - Only show for admins */}
        {isAdmin && (
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
        )}

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
                    {activity.type === "achievement" && (
                      <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
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

      {/* Recent Calls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-white mb-6">Recent Calls</h2>
        <RealtimeCalls />
      </motion.div>

      {/* Live Context Ribbon */}
      <LiveContextRibbon />
    </div>
  );
}