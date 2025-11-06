"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { BadgeCheck, PhoneIncoming, Bot, UserCircle, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";

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
  total_turns: number | null;
};

type CallTurn = {
  id: string;
  call_id: string;
  turn_number: number;
  speaker: string;
  transcript_json: any;
  created_at: string;
};

type Message = {
  role: "user" | "bot";
  text: string;
};

function parseTranscriptJson(transcriptJson: any): Message[] {
  if (!transcriptJson) return [];
  
  // Handle different JSON structures
  // If it's an array of messages
  if (Array.isArray(transcriptJson)) {
    return transcriptJson.map((msg: any) => ({
      role: (msg.role || msg.speaker || "").toLowerCase().includes("user") ? "user" : "bot",
      text: msg.text || msg.content || msg.message || "",
    })).filter((msg: Message) => msg.text.trim().length > 0);
  }
  
  // If it's an object with messages array
  if (transcriptJson.messages && Array.isArray(transcriptJson.messages)) {
    return transcriptJson.messages.map((msg: any) => ({
      role: (msg.role || msg.speaker || "").toLowerCase().includes("user") ? "user" : "bot",
      text: msg.text || msg.content || msg.message || "",
    })).filter((msg: Message) => msg.text.trim().length > 0);
  }
  
  // If it's a string, try to parse it
  if (typeof transcriptJson === "string") {
    try {
      const parsed = JSON.parse(transcriptJson);
      return parseTranscriptJson(parsed);
    } catch {
      return [];
    }
  }
  
  return [];
}

export default function LiveCallsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callTurns, setCallTurns] = useState<Record<string, CallTurn[]>>({});
  const [connected, setConnected] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [endedCallId, setEndedCallId] = useState<string | null>(null);

  const effectiveBusinessId = useMemo(() => {
    if (mounted && typeof window !== "undefined") {
      return sessionStorage.getItem("business_id") || undefined;
    }
    return undefined;
  }, [mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let isMounted = true;

    async function loadActiveCalls() {
      if (!effectiveBusinessId) {
        console.warn("⚠️ No business_id found, cannot load calls");
        setCalls([]);
        return;
      }

      const { data: callsData, error: callsError } = await supabase
        .from("calls")
        .select("id,business_id,call_id,patient_id,status,phone,email,patient_name,last_summary,last_intent,success,started_at,ended_at,total_turns")
        .eq("business_id", effectiveBusinessId)
        .eq("status", "active")
        .order("started_at", { ascending: false });

      if (!isMounted) return;
      if (callsError) {
        console.error("❌ Error loading active calls:", callsError);
        return;
      }

      const activeCalls = (callsData || []).filter(c => c.status === "active");
      
      // Load call turns for all active calls
      if (activeCalls.length > 0) {
        const callIds = activeCalls.map(c => c.call_id);
        
        const { data: turnsData, error: turnsError } = await supabase
          .from("call_turns")
          .select("id,call_id,turn_number,speaker,transcript_json,created_at")
          .in("call_id", callIds)
          .order("turn_number", { ascending: true });

        if (!turnsError && turnsData) {
          // Group turns by call_id
          const turnsByCallId: Record<string, CallTurn[]> = {};
          turnsData.forEach((turn: CallTurn) => {
            if (!turnsByCallId[turn.call_id]) {
              turnsByCallId[turn.call_id] = [];
            }
            turnsByCallId[turn.call_id].push(turn);
          });
          setCallTurns(turnsByCallId);
        }
      }

      setCalls(activeCalls);

      // Check if any call just ended
      const previousCallIds = calls.map(c => c.id);
      const currentCallIds = activeCalls.map(c => c.id);
      const endedCalls = previousCallIds.filter(id => !currentCallIds.includes(id));
      
      if (endedCalls.length > 0 && calls.length > 0) {
        setEndedCallId(endedCalls[0]);
      }
    }

    loadActiveCalls();

    // Set up real-time subscription for calls
    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (effectiveBusinessId) {
      // Subscribe to calls table changes
      const callsChannel = supabase
        .channel(`live-calls:${effectiveBusinessId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "calls",
            filter: `business_id=eq.${effectiveBusinessId}`,
          },
          (payload) => {
            const call = payload.new as Call;
            const oldCall = payload.old as Call;

            // Handle INSERT (new active call)
            if (payload.eventType === "INSERT" && call.status === "active") {
              setCalls((prev) => {
                if (prev.find(c => c.id === call.id)) return prev;
                return [call, ...prev];
              });
            }
            // Handle UPDATE
            else if (payload.eventType === "UPDATE") {
              // If call just ended
              if (oldCall?.status === "active" && call.status === "ended") {
                setEndedCallId(call.id);
                setCalls((prev) => prev.filter((c) => c.id !== call.id));
              }
              // If call is still active, update it
              else if (call.status === "active") {
                setCalls((prev) => {
                  const updated = prev.map((c) => (c.id === call.id ? call : c));
                  // Also add if it wasn't in the list
                  if (!prev.find(c => c.id === call.id)) {
                    return [call, ...updated];
                  }
                  return updated;
                });
              }
              // Remove if no longer active
              else {
                setCalls((prev) => prev.filter((c) => c.id !== call.id));
              }
            }
            // Handle DELETE
            else if (payload.eventType === "DELETE") {
              setCalls((prev) => prev.filter((c) => c.id !== call.id));
            }
          }
        )
        .subscribe((status) => {
          console.log("Live calls channel status:", status);
          setConnected(status === "SUBSCRIBED");
        });
      
      channels.push(callsChannel);

      // Subscribe to call_turns table changes
      const turnsChannel = supabase
        .channel(`live-call-turns:${effectiveBusinessId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_turns",
          },
          async (payload) => {
            const turn = payload.new as CallTurn;
            
            // Reload turns for this call_id
            if (turn?.call_id) {
              const { data: turnsData } = await supabase
                .from("call_turns")
                .select("id,call_id,turn_number,speaker,transcript_json,created_at")
                .eq("call_id", turn.call_id)
                .order("turn_number", { ascending: true });

              if (turnsData) {
                setCallTurns((prev) => ({
                  ...prev,
                  [turn.call_id]: turnsData,
                }));
              }
            }
          }
        )
        .subscribe();
      
      channels.push(turnsChannel);

      // Poll for updates every 2 seconds to catch transcript changes
      const pollInterval = setInterval(() => {
        loadActiveCalls();
      }, 2000);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
        channels.forEach((channel) => {
          supabase.removeChannel(channel);
        });
      };
    }

    return () => {
      isMounted = false;
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, effectiveBusinessId, mounted, calls.length]);

  function handleViewFullLog(callId: string) {
    router.push(`/logs?callId=${callId}`);
    setEndedCallId(null);
  }

  function getMessagesForCall(call: Call): Message[] {
    const turns = callTurns[call.call_id] || [];
    const allMessages: Message[] = [];
    
    turns.forEach((turn) => {
      if (turn.transcript_json) {
        const parsed = parseTranscriptJson(turn.transcript_json);
        allMessages.push(...parsed);
      }
    });
    
    return allMessages;
  }

  function hasTranscript(call: Call): boolean {
    const turns = callTurns[call.call_id] || [];
    return turns.length > 0 && turns.some(t => t.transcript_json);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold text-white">Live Calls</h1>
          <span className="beta-badge">Beta</span>
        </div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xs font-medium text-yellow-400/80 drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]"
        >
          #Founders Program
        </motion.span>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm text-white/60 mb-6">
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

      {/* Call Ended Popup */}
      <AnimatePresence>
        {endedCallId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEndedCallId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl p-6 max-w-md w-full border border-yellow-500/30"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Call Ended</h3>
                <button
                  onClick={() => setEndedCallId(null)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <p className="text-white/80 mb-6">
                Do you want to see the full log?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleViewFullLog(endedCallId)}
                  className="flex-1 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Full Log
                </button>
                <button
                  onClick={() => setEndedCallId(null)}
                  className="px-4 py-2 rounded-lg glass border border-white/10 hover:bg-white/10 text-white/80 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Calls */}
      {calls.length === 0 ? (
        <div className="p-12 text-center text-white/40 rounded-2xl bg-white/5 border border-white/10">
          No active calls
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {calls.map((call, index) => {
            const hasTranscriptContent = hasTranscript(call);
            const messages = hasTranscriptContent ? getMessagesForCall(call) : [];

            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl glass-strong border border-white/10 overflow-hidden"
              >
                {/* Call Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
                        <PhoneIncoming className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {call.patient_name || "Unknown Caller"}
                        </h3>
                        {call.phone && (
                          <p className="text-sm text-white/60">{call.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-white/40">
                      {format(new Date(call.started_at), "h:mm a")}
                    </div>
                  </div>
                  {call.last_intent && (
                    <div className="mt-3">
                      <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium border border-yellow-500/30">
                        {call.last_intent}
                      </span>
                    </div>
                  )}
                </div>

                {/* Call Content */}
                <div className="p-6 relative">
                  {!hasTranscriptContent ? (
                    // Call in Progress Animation
                    <div className="flex flex-col items-center justify-center py-12">
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="mb-4"
                      >
                        <div className="p-4 rounded-full bg-yellow-500/20 border border-yellow-500/30">
                          <PhoneIncoming className="h-8 w-8 text-yellow-400" />
                        </div>
                      </motion.div>
                      <p className="text-white/60 text-sm font-medium">Call in progress...</p>
                      <p className="text-white/40 text-xs mt-1">Waiting for transcript</p>
                    </div>
                  ) : (
                    // Transcript Chat Bubbles
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {messages.map((message, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`flex items-start gap-2 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                            <div className={`p-1.5 rounded-full flex-shrink-0 ${
                              message.role === "user"
                                ? "bg-blue-500/20 border border-blue-500/30"
                                : "bg-yellow-500/20 border border-yellow-500/30"
                            }`}>
                              {message.role === "user" ? (
                                <UserCircle className="h-3.5 w-3.5 text-blue-400" />
                              ) : (
                                <Bot className="h-3.5 w-3.5 text-yellow-400" />
                              )}
                            </div>
                            <div className={`px-4 py-2.5 rounded-2xl ${
                              message.role === "user"
                                ? "bg-blue-500/20 border border-blue-500/30 text-white rounded-br-sm"
                                : "bg-white/5 border border-white/10 text-white/90 rounded-bl-sm"
                            }`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
