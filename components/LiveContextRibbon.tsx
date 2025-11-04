"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Phone, CheckCircle2, TrendingUp } from "lucide-react";

type LiveContextRibbonProps = {
  businessId?: string;
};

export default function LiveContextRibbon({ businessId }: LiveContextRibbonProps) {
  const [mounted, setMounted] = useState(false);
  const [liveStats, setLiveStats] = useState({
    activeCalls: 0,
    todayBookings: 0,
    bookingSuccessRate: 0,
  });

  const effectiveBusinessId = useMemo(() => {
    if (businessId) return businessId;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("business_id") || undefined;
    }
    return undefined;
  }, [businessId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !effectiveBusinessId) return;

    async function loadLiveStats() {
      const supabase = getSupabaseClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Active calls
      const { count: activeCount } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("business_id", effectiveBusinessId)
        .eq("status", "active");

      // Today's bookings
      const { data: todayCalls } = await supabase
        .from("calls")
        .select("schedule, success")
        .eq("business_id", effectiveBusinessId)
        .gte("started_at", today.toISOString());

      const bookings = todayCalls?.filter(c => c.schedule !== null).length || 0;
      const successfulCalls = todayCalls?.filter(c => c.success === true).length || 0;
      const totalCalls = todayCalls?.length || 0;
      const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

      setLiveStats({
        activeCalls: activeCount || 0,
        todayBookings: bookings,
        bookingSuccessRate: successRate,
      });
    }

    loadLiveStats();
    const interval = setInterval(loadLiveStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [mounted, effectiveBusinessId]);

  if (!mounted) return null;

  const messages: string[] = [];

  if (liveStats.activeCalls > 0) {
    messages.push(`📞 ${liveStats.activeCalls} call${liveStats.activeCalls !== 1 ? 's' : ''} in progress`);
  }

  if (liveStats.todayBookings > 0) {
    messages.push(`${liveStats.todayBookings} booking${liveStats.todayBookings !== 1 ? 's' : ''} today`);
  }

  if (liveStats.bookingSuccessRate > 0) {
    messages.push(`${liveStats.bookingSuccessRate}% success rate today`);
  }

  if (messages.length === 0) {
    messages.push("Nia is ready — monitoring for new calls");
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-yellow-500/20 glass-strong">
      <div className="max-w-7xl mx-auto px-6 py-2">
        <div className="flex items-center justify-between text-xs">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4 text-white/70"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-yellow-400"
              />
              <span className="font-medium">Nia is live</span>
            </div>
            <AnimatePresence mode="wait">
              {messages.map((msg, index) => (
                <motion.span
                  key={`${msg}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  {index > 0 && <span className="text-white/30">|</span>}
                  {msg}
                </motion.span>
              ))}
            </AnimatePresence>
          </motion.div>
          <div className="flex items-center gap-2 text-white/50">
            <TrendingUp className="h-3 w-3" />
            <span>Real-time updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
