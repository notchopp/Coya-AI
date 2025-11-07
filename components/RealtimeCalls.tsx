"use client";

import { useEffect, useMemo, useState, memo } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { BadgeCheck, PhoneIncoming, PhoneOff, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CallDetailsModal from "./CallDetailsModal";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

type Call = {
  id: string;
  business_id: string;
  call_id: string;
  patient_id: string | null;
  status: string | null;
  phone: string | null;
  email: string | null;
  patient_name: string | null;
  last_summary: string | null;
  last_intent: string | null;
  success: boolean | null;
  started_at: string;
  ended_at: string | null;
  transcript: string | null;
  escalate: boolean | null;
  upsell: boolean | null;
  schedule: any;
  context: any;
  total_turns: number | null;
};

type Props = {
  businessId?: string;
};

function RealtimeCalls({ businessId }: Props) {
  const { accentColor } = useAccentColor();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [calls, setCalls] = useState<Call[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Get business_id from props or sessionStorage for multi-tenant
  // Use mounted state to avoid hydration mismatch
  const effectiveBusinessId = useMemo(() => {
    if (businessId) return businessId;
    if (mounted && typeof window !== "undefined") {
      return sessionStorage.getItem("business_id") || undefined;
    }
    return undefined;
  }, [businessId, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Don't run until mounted to avoid hydration issues
    if (!mounted) return;

    let isMounted = true;

    async function loadInitial() {
      // Always filter by business_id if available
      if (!effectiveBusinessId) {
        console.warn("⚠️ No business_id found, cannot load calls");
        setCalls([]);
        return;
      }

      console.log("🔄 Loading calls for business_id:", effectiveBusinessId);

            const { data, error } = await supabase
              .from("calls")
              .select("id,business_id,call_id,patient_id,status,phone,email,patient_name,last_summary,last_intent,success,started_at,ended_at,transcript,escalate,upsell,schedule,context,total_turns")
              .eq("business_id", effectiveBusinessId)
              .order("started_at", { ascending: false })
              .limit(5); // Show last 5 calls

      if (!isMounted) return;
      if (error) {
        console.error("❌ Initial load error", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Business ID used:", effectiveBusinessId);
        console.error("Query attempted:", effectiveBusinessId ? `business_id = ${effectiveBusinessId}` : "all calls");
        return;
      }
      console.log("✅ Loaded calls:", data?.length || 0, "Business ID:", effectiveBusinessId);
      if (data && data.length > 0) {
        console.log("Sample call:", data[0]);
      } else {
        console.warn("⚠️ No calls found. Check:");
        console.warn("1. Do you have calls in the database?");
        console.warn("2. Is RLS blocking the query?");
        console.warn("3. Does business_id match?", effectiveBusinessId);
      }
      // Show last 5 calls regardless of status
      setCalls(data || []);
    }

    loadInitial();

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (effectiveBusinessId) {
      const channel = supabase
        .channel(`business:CALLS:${effectiveBusinessId}`, { config: { private: true } })
        .on("broadcast", { event: "changes" }, (payload) => {
          console.log("Broadcast received:", payload);
          const eventData = payload.payload;
          if (!eventData) return;

          let callData: Call | null = null;
          let eventType = "UPDATE";

          if (eventData.data) {
            callData = eventData.data as Call;
            eventType = eventData.eventType || eventData.operation || "UPDATE";
          } else if (eventData.new) {
            callData = eventData.new as Call;
            eventType = "INSERT";
          } else if (eventData.old) {
            callData = eventData.old as Call;
            eventType = "DELETE";
          } else {
            callData = eventData as Call;
          }

          if (!callData) return;

                if (eventType === "INSERT" || eventType === "insert") {
                  // Refresh last 5 calls
                  loadInitial();
                } else if (eventType === "UPDATE" || eventType === "update") {
                  // Refresh last 5 calls
                  loadInitial();
                } else if (eventType === "DELETE" || eventType === "delete") {
                  setCalls((prev) => prev.filter((c) => c.id !== callData!.id));
                }
        })
        .subscribe((status) => {
          console.log("Channel subscription status:", status);
          setConnected(status === "SUBSCRIBED");
        });
      channels.push(channel);
    } else {
      const channel = supabase
        .channel("realtime:calls")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
          },
          (payload) => {
            const newCall = payload.new as Call;
            // Refresh last 5 calls
            loadInitial();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
          },
          (payload) => {
            const updatedCall = payload.new as Call;
            // Refresh last 5 calls
            loadInitial();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "calls",
          },
          (payload) => {
            setCalls((prev) => prev.filter((c) => c.id !== (payload.old as Call).id));
          }
        )
        .subscribe((status) => {
          setConnected(status === "SUBSCRIBED");
        });
      channels.push(channel);
    }

    // Set connected to true after a short delay if subscription succeeds
    // This prevents "Connecting..." from showing indefinitely
    const timeout = setTimeout(() => {
      if (isMounted && channels.length > 0) {
        setConnected(true);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, effectiveBusinessId, mounted]);

  function handleCallClick(call: Call) {
    setSelectedCall(call);
    setIsModalOpen(true);
  }

  return (
    <>
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/60">
            {connected ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                <BadgeCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Live</span>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-2"
              >
                <BadgeCheck className="h-4 w-4 text-white/40" />
                <span>Connecting...</span>
              </motion.div>
            )}
          </div>
          <span className="beta-badge">Beta</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {calls.length === 0 && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full p-12 text-center text-white/40 rounded-2xl bg-white/5 border border-white/10"
              >
                No calls yet.
              </motion.div>
            )}
            {calls.map((c, index) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ 
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 25
                }}
                whileHover={{ scale: 1.01, y: -2 }}
                onClick={() => handleCallClick(c)}
                className="group cursor-pointer p-5 rounded-2xl glass border border-white/10 hover:bg-white/10"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  transition: "border-color 0.2s ease, background-color 0.2s ease",
                }}
                onHoverStart={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  if (target) {
                    target.style.borderColor = `${accentColor}80`;
                  }
                }}
                onHoverEnd={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  if (target) {
                    target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {c.status === "active" ? (
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
                        {c.patient_name ?? "Unknown"}
                      </div>
                      {c.phone && (
                        <div className="text-white/60 text-sm truncate">{c.phone}</div>
                      )}
                    </div>
                  </div>
                  <ChevronRight 
                    className="h-5 w-5 text-white/40 transition-colors flex-shrink-0" 
                    style={{ color: "rgba(255, 255, 255, 0.4)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = accentColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
                    }}
                  />
                </div>

                {c.last_intent && (
                  <div className="mb-3">
                    <span 
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                      style={{
                        backgroundColor: `${accentColor}33`,
                        color: accentColor,
                        borderColor: `${accentColor}4D`,
                      }}
                    >
                      {c.last_intent}
                    </span>
                  </div>
                )}

                {c.last_summary && (
                  <p className="text-white/70 text-sm line-clamp-2 mb-3">
                    {c.last_summary}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>{format(new Date(c.started_at), "MMM d, h:mm a")}</span>
                  <div className="flex items-center gap-2">
                    {c.success !== null && (
                      <span className={c.success ? "text-emerald-400" : "text-red-400"}>
                        {c.success ? "✓" : "✗"}
                      </span>
                    )}
                    {c.escalate && (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs border border-red-500/30">
                        Escalated
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <CallDetailsModal
        call={selectedCall}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCall(null);
        }}
      />
    </>
  );
}

export default memo(RealtimeCalls);


