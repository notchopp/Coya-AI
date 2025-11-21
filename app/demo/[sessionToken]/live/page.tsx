"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Phone, Clock, Calendar, MessageSquare, Loader2 } from "lucide-react";

type Call = {
  id: string;
  started_at: string;
  patient_name: string | null;
  last_intent: string | null;
  schedule: any;
  status: string | null;
};

type Booking = {
  id: string;
  schedule: any;
  started_at: string;
  patient_name: string | null;
};

export default function DemoLive() {
  const params = useParams();
  const router = useRouter();
  const sessionToken = params?.sessionToken as string;
  
  const [session, setSession] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!sessionToken) return;

    async function loadSession() {
      try {
        const response = await fetch(`/api/demo/${sessionToken}`);
        const data = await response.json();
        
        if (data.error || data.session?.isExpired) {
          router.push("/demo/expired");
          return;
        }

        setSession(data.session);
        setBusiness(data.session.demo_business);
        setRemainingSeconds(data.session.remainingSeconds);
        setLoading(false);
      } catch (error) {
        console.error("Error loading session:", error);
        setLoading(false);
      }
    }

    loadSession();
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [sessionToken, router]);

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) {
      router.push("/demo/expired");
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          router.push("/demo/expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, router]);

  // Load calls and bookings in real-time
  useEffect(() => {
    if (!business?.id) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`demo-live-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newCall = payload.new as Call;
            setCalls((prev) => [newCall, ...prev]);
            if (newCall.schedule) {
              setBookings((prev) => [{
                id: newCall.id,
                schedule: newCall.schedule,
                started_at: newCall.started_at,
                patient_name: newCall.patient_name,
              }, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedCall = payload.new as Call;
            setCalls((prev) =>
              prev.map((call) =>
                call.id === updatedCall.id ? updatedCall : call
              )
            );
            if (updatedCall.schedule) {
              setBookings((prev) => {
                const existing = prev.find(b => b.id === updatedCall.id);
                if (existing) {
                  return prev.map(b => b.id === updatedCall.id ? {
                    id: updatedCall.id,
                    schedule: updatedCall.schedule,
                    started_at: updatedCall.started_at,
                    patient_name: updatedCall.patient_name,
                  } : b);
                } else {
                  return [{
                    id: updatedCall.id,
                    schedule: updatedCall.schedule,
                    started_at: updatedCall.started_at,
                    patient_name: updatedCall.patient_name,
                  }, ...prev];
                }
              });
            }
          }
        }
      )
      .subscribe();

    // Load existing calls
    supabase
      .from("calls")
      .select("*")
      .eq("business_id", business.id)
      .order("started_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          const callsData = data as Call[];
          setCalls(callsData);
          setBookings(callsData.filter(c => c.schedule).map(c => ({
            id: c.id,
            schedule: c.schedule,
            started_at: c.started_at,
            patient_name: c.patient_name,
          })));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBookingTime = (schedule: any) => {
    if (!schedule || !schedule.date || !schedule.time) return "N/A";
    return `${schedule.date} at ${schedule.time}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{business?.name || "Your Business"}</h1>
            <p className="text-white/60">Live Demo Experience</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <Clock className="h-5 w-5 text-red-400" />
            <span className="text-xl font-bold">{formatTime(remainingSeconds)}</span>
          </div>
        </div>

        {/* Demo Phone Number */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 rounded-xl bg-black border border-yellow-500/30"
        >
          <div className="flex items-center gap-4">
            <Phone className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-white/60 mb-1">Call This Number</p>
              <p className="text-3xl font-bold">+1 (215) 986 2752</p>
              <p className="text-sm text-white/60 mt-1">Experience your AI receptionist live</p>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar Bookings */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-bold">Bookings</h2>
            </div>
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="p-8 rounded-xl bg-black border border-white/10 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <p className="text-white/60">No bookings yet. Call the number to make an appointment!</p>
                </div>
              ) : (
                bookings.map((booking) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-black border border-green-500/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{booking.patient_name || "Anonymous"}</span>
                      <span className="text-xs text-white/60">
                        {new Date(booking.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-white/80">
                      {formatBookingTime(booking.schedule)}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Call Log */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-bold">Call Log</h2>
            </div>
            <div className="space-y-3">
              {calls.length === 0 ? (
                <div className="p-8 rounded-xl bg-black border border-white/10 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <p className="text-white/60">No calls yet. Call the demo number to get started!</p>
                </div>
              ) : (
                calls.map((call) => (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-black border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{call.patient_name || "Anonymous"}</span>
                      <span className="text-xs text-white/60">
                        {new Date(call.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {call.last_intent && (
                      <p className="text-sm text-white/80">{call.last_intent}</p>
                    )}
                    {call.schedule && (
                      <div className="mt-2 p-2 rounded bg-green-500/20 border border-green-500/30 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs">Booked</span>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

