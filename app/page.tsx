"use client";

import { useEffect, useState } from "react";
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
  type: "booking" | "achievement" | "streak";
  message: string;
  timestamp: Date;
  patientName?: string;
};

export default function Dashboard() {
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
  const [userName, setUserName] = useState<string>("");
  const [funFact, setFunFact] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function loadBusinessName() {
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
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    async function loadUserData() {
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
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    async function loadDashboardData() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = weekStart;
      const monthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = monthStart;

      // Get all calls for this business
      const { data: allCallsData, error: callsError } = await supabase
        .from("calls")
        .select("id, started_at, ended_at, status, schedule, success, last_intent, patient_name")
        .eq("business_id", businessId)
        .order("started_at", { ascending: false })
        .limit(1000);

      if (callsError) {
        console.error("Error loading calls:", callsError);
        setLoading(false);
        return;
      }

      const allCalls = (allCallsData || []) as DashboardCall[];

      if (!allCalls || allCalls.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate performance metrics
      const totalCallsHandled = allCalls.filter(c => c.status === "ended" || c.ended_at).length;
      const handledCalls = allCalls.filter(c => c.status === "ended" || c.ended_at).length;
      const missedCalls = allCalls.filter(c => c.status === "missed" || (c.success === false && c.ended_at && c.status !== "ended")).length;

      // Bookings this week
      const bookingsThisWeek = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= weekStart && c.schedule !== null;
      }).length;

      // Bookings last week
      const bookingsLastWeek = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= lastWeekStart && callDate < lastWeekEnd && c.schedule !== null;
      }).length;

      // Generate trend data for bookings (last 7 days)
      const bookingsTrend: number[] = [];
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

      // Conversion rate this month
      const thisMonthCalls = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= monthStart && (c.status === "ended" || c.ended_at);
      });
      const thisMonthBookings = thisMonthCalls.filter(c => c.schedule !== null).length;
      const conversionRate = thisMonthCalls.length > 0 
        ? (thisMonthBookings / thisMonthCalls.length) * 100 
        : 0;

      // Conversion rate last month
      const lastMonthCalls = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= lastMonthStart && callDate < lastMonthEnd && (c.status === "ended" || c.ended_at);
      });
      const lastMonthBookings = lastMonthCalls.filter(c => c.schedule !== null).length;
      const conversionRateLastMonth = lastMonthCalls.length > 0
        ? (lastMonthBookings / lastMonthCalls.length) * 100
        : 0;

      // Time saved (approximation: assume 3 minutes per call handled)
      const avgCallMinutes = 3;
      const timeSavedHours = (handledCalls * avgCallMinutes) / 60;

      // Estimated savings: $300 per patient booked
      const totalBookings = allCalls.filter(c => c.schedule !== null).length;
      const estimatedSavings = totalBookings * 300;

      setPerformance({
        totalCallsHandled,
        bookingsThisWeek,
        bookingsLastWeek,
        conversionRate,
        conversionRateLastMonth,
        timeSavedHours,
        handledCalls,
        missedCalls,
        newPatients,
        repeatPatients,
        estimatedSavings,
        bookingsThisWeekTrend: bookingsTrend,
      });

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

      // Generate activity feed
      const activities: ActivityItem[] = [];
      
      // Group bookings by patient name for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBookings = allCalls.filter(c => {
        const callDate = new Date(c.started_at);
        return callDate >= today && c.schedule !== null && c.patient_name;
      });

      // Group by patient name
      const bookingsByPatient: Record<string, number> = {};
      todayBookings.forEach(c => {
        const name = c.patient_name || "Unknown";
        bookingsByPatient[name] = (bookingsByPatient[name] || 0) + 1;
      });

      // Create activity items for patients with multiple bookings
      Object.entries(bookingsByPatient).forEach(([name, count]) => {
        if (count > 1) {
          activities.push({
            id: `patient-${name}`,
            type: "booking",
            message: `${name} booked ${count} new ${count === 1 ? "client" : "clients"} today.`,
            timestamp: new Date(),
            patientName: name,
          });
        }
      });

      // Recent bookings (individual)
      const recentBookings = allCalls
        .filter(c => c.schedule !== null)
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          type: "booking" as const,
          message: `${c.patient_name || "A patient"} booked an appointment`,
          timestamp: new Date(c.started_at),
          patientName: c.patient_name || undefined,
        }));
      
      // Add individual bookings if not already in grouped activities
      recentBookings.forEach(booking => {
        if (!activities.find(a => a.patientName === booking.patientName && a.type === "booking")) {
          activities.push(booking);
        }
      });

      // Success streak (consecutive successful calls this month)
      const thisMonthSuccessful = thisMonthCalls.filter(c => c.success === true);
      setSuccessStreak(thisMonthSuccessful.length);

      if (thisMonthSuccessful.length >= 10) {
        activities.push({
          id: "streak",
          type: "streak",
          message: `You've handled ${thisMonthSuccessful.length} calls this month flawlessly!`,
          timestamp: new Date(),
        });
      }

      setActivityFeed(activities.slice(0, 5));

      // Generate fun fact based on real data (changes every 24 hours)
      generateFunFact(allCalls, businessId);

      setLoading(false);
    }

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [mounted]);

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

  const conversionTrend = performance.conversionRate - performance.conversionRateLastMonth;
  const handledRatio = performance.handledCalls + performance.missedCalls > 0
    ? (performance.handledCalls / (performance.handledCalls + performance.missedCalls)) * 100
    : 100;

  const bookingsTrend = performance.bookingsThisWeek - performance.bookingsLastWeek;
  const bookingsTrendPercent = performance.bookingsLastWeek > 0
    ? ((bookingsTrend / performance.bookingsLastWeek) * 100)
    : 0;

  // Calculate total bookings for savings display (estimatedSavings / 300)
  const totalBookings = Math.round(performance.estimatedSavings / 300);

  // Humanize metrics
  const successfulBookings = Math.round(performance.conversionRate * performance.handledCalls / 100);
  const humanizedConversion = performance.handledCalls > 0
    ? `${successfulBookings} new patient${successfulBookings !== 1 ? 's' : ''} booked — ${performance.missedCalls} missed opportunity${performance.missedCalls !== 1 ? 'ies' : 'y'}`
    : "No calls yet";

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-white">Dashboard</h1>
            {businessName && (
              <span className="text-xl font-medium text-white/60">— {businessName}</span>
            )}
            <span className="beta-badge">Beta</span>
          </div>
        </div>
        {userName && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-end gap-1"
          >
            <div className="text-white/60 text-lg">
              Hey, <span className="text-white/80 font-medium">{userName.split(' ')[0]}</span>
            </div>
            {funFact && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white/50 text-sm italic"
              >
                {funFact}
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Performance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl glass-strong border border-white/10"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
            <Trophy className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Performance Overview</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl glass border border-white/10">
            <div className="text-xs text-white/60 mb-1">Total Calls Handled</div>
            <div className="text-2xl font-bold text-white">
              {loading ? "..." : performance.totalCallsHandled.toLocaleString()}
            </div>
          </div>

          <div className="p-4 rounded-xl glass border border-white/10 relative">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-white/60">Bookings This Week</div>
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
              {loading ? "..." : performance.bookingsThisWeek}
            </div>
            {performance.bookingsThisWeekTrend.length > 0 && (
              <div className="absolute bottom-3 right-3 opacity-60">
                <Sparkline 
                  data={performance.bookingsThisWeekTrend} 
                  width={50} 
              height={16}
                  color={bookingsTrend > 0 ? "#10b981" : bookingsTrend < 0 ? "#ef4444" : "#eab308"}
                />
              </div>
            )}
            <div className="text-xs text-white/40">
              vs {performance.bookingsLastWeek} last week
            </div>
          </div>

          <div className="p-4 rounded-xl glass border border-white/10">
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
              {loading ? "..." : humanizedConversion}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {performance.conversionRate.toFixed(1)}% rate
            </div>
          </div>

          <div className="p-4 rounded-xl glass border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 w-3 text-yellow-400" />
              <div className="text-xs text-white/60">Estimated Savings</div>
            </div>
            <div className="text-2xl font-bold text-white">
              {loading ? "..." : `$${performance.estimatedSavings.toFixed(0)}`}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {totalBookings} patient{totalBookings !== 1 ? 's' : ''} booked × $300
            </div>
          </div>

          <div className="p-4 rounded-xl glass border border-white/10">
            <div className="text-xs text-white/60 mb-1">Handled Ratio</div>
            <div className="text-2xl font-bold text-white">
              {loading ? "..." : `${handledRatio.toFixed(1)}%`}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {performance.missedCalls} missed
            </div>
          </div>
        </div>
      </motion.div>

      {/* Success Streak */}
      {successStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl glass-strong border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
              <Sparkles className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-white">
                Success Streak: {successStreak} calls handled flawlessly this month!
              </div>
              <div className="text-sm text-white/60 mt-1">
                Keep up the excellent work!
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contextual Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 p-6 rounded-2xl glass-strong border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
            </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Insights</h2>
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
                    className={`p-4 rounded-xl glass border flex items-start gap-3 ${
                      insight.actionable 
                        ? "border-yellow-500/30 bg-yellow-500/5" 
                        : "border-white/10"
                    }`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                      insight.actionable ? "text-yellow-400" : "text-yellow-400/70"
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm ${
                        insight.actionable 
                          ? "text-white font-medium" 
                          : "text-white/90"
                      }`}>
                        {insight.message}
                      </p>
                      {insight.actionable && (
                        <div className="mt-2 text-xs text-yellow-400/70 flex items-center gap-1">
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
          className="p-6 rounded-2xl glass-strong border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
              <Zap className="h-5 w-5 text-yellow-400" />
            </div>
          <div>
            <h2 className="text-xl font-bold text-white">Activity Feed</h2>
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
                    {activity.type === "streak" && (
                      <Trophy className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
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