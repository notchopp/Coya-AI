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
  business_id: string;
  call_id: string;
  total_turns: number | null;
  duration_sec: number | null;
  transcript_json: any;
  created_at: string;
  updated_at: string | null;
};

type Message = {
  role: "user" | "bot";
  text: string;
};

function parseTranscriptJson(transcriptJson: any): Message[] {
  if (!transcriptJson) return [];
  
  console.log("🔍 Parsing transcript_json:", typeof transcriptJson, transcriptJson);
  
  // Handle different JSON structures
  // If it's an array of messages
  if (Array.isArray(transcriptJson)) {
    console.log("📝 Array detected with", transcriptJson.length, "items");
    console.log("📝 First item keys:", transcriptJson[0] ? Object.keys(transcriptJson[0]) : "no items");
    console.log("📝 First item:", transcriptJson[0]);
    
    const messages = transcriptJson.map((msg: any, idx: number) => {
      // Determine role from speaker field
      const speaker = (msg.speaker || msg.role || "").toLowerCase();
      const role = speaker.includes("user") || speaker.includes("caller") || speaker.includes("patient") ? "user" : "bot";
      
      // Try multiple possible text field names
      const text = msg.text || msg.content || msg.message || msg.transcript || msg.text_content || msg.utterance || "";
      
      console.log(`  Item ${idx}: speaker="${speaker}", role="${role}", text="${text.substring(0, 50)}..."`);
      
      return { role, text };
    }).filter((msg: Message) => {
      const hasText = msg.text.trim().length > 0;
      if (!hasText) {
        console.log(`  ⚠️ Filtered out message with no text:`, msg);
      }
      return hasText;
    });
    
    console.log("✅ Parsed array messages:", messages.length, "messages");
    if (messages.length > 0) {
      console.log("📋 Sample messages:", messages.slice(0, 3));
    }
    return messages;
  }
  
  // If it's an object with messages array
  if (transcriptJson.messages && Array.isArray(transcriptJson.messages)) {
    const messages = transcriptJson.messages.map((msg: any) => {
      const speaker = (msg.speaker || msg.role || "").toLowerCase();
      const role = speaker.includes("user") || speaker.includes("caller") || speaker.includes("patient") ? "user" : "bot";
      const text = msg.text || msg.content || msg.message || msg.transcript || msg.text_content || msg.utterance || "";
      return { role, text };
    }).filter((msg: Message) => msg.text.trim().length > 0);
    console.log("Parsed object.messages:", messages.length);
    return messages;
  }
  
  // If it's a string, try to parse it
  if (typeof transcriptJson === "string") {
    try {
      const parsed = JSON.parse(transcriptJson);
      return parseTranscriptJson(parsed);
    } catch (e) {
      console.log("Failed to parse string as JSON:", e);
      return [];
    }
  }
  
  // If transcript_json is an object with role/text directly
  if (transcriptJson.role || transcriptJson.speaker) {
    const speaker = (transcriptJson.role || transcriptJson.speaker || "").toLowerCase();
    const role = speaker.includes("user") || speaker.includes("caller") || speaker.includes("patient") ? "user" : "bot";
    const text = transcriptJson.text || transcriptJson.content || transcriptJson.message || transcriptJson.transcript || transcriptJson.text_content || transcriptJson.utterance || "";
    if (text.trim().length > 0) {
      console.log("Parsed single message object:", { role, text });
      return [{ role, text }];
    }
  }
  
  console.log("❌ No valid structure found in transcript_json");
  return [];
}

export default function LiveCallsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callTurns, setCallTurns] = useState<Record<string, CallTurn>>({}); // Store one turn record per call_id
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
      if (activeCalls.length > 0 && effectiveBusinessId) {
        const callIds = activeCalls.map(c => c.call_id);
        
        console.log("🔄 Loading call turns for call_ids:", callIds);
        
        const { data: turnsData, error: turnsError } = await supabase
          .from("call_turns")
          .select("id,business_id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at")
          .eq("business_id", effectiveBusinessId)
          .in("call_id", callIds);

        if (turnsError) {
          console.error("❌ Error loading call turns:", turnsError);
        } else {
          console.log("✅ Loaded call turns:", turnsData?.length || 0, "turns");
          if (turnsData && turnsData.length > 0) {
            console.log("Sample turn:", turnsData[0]);
            console.log("Sample transcript_json:", JSON.stringify(turnsData[0].transcript_json, null, 2));
          }
        }

        if (!turnsError && turnsData) {
          // Map turns by call_id (one row per call)
          const turnsByCallId: Record<string, CallTurn> = {};
          turnsData.forEach((turn: CallTurn) => {
            turnsByCallId[turn.call_id] = turn;
          });
          setCallTurns(turnsByCallId);
          console.log("📊 Mapped turns by call_id:", Object.keys(turnsByCallId));
        } else {
          // Clear turns if query failed or returned no data
          setCallTurns({});
        }
      } else {
        setCallTurns({});
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
                
                // Reload turn for this call when it updates (in case transcript_json was updated)
                if (call.call_id && effectiveBusinessId) {
                  supabase
                    .from("call_turns")
                    .select("id,business_id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at")
                    .eq("business_id", effectiveBusinessId)
                    .eq("call_id", call.call_id)
                    .maybeSingle()
                    .then(({ data: turnData, error: turnsError }) => {
                      if (!turnsError && turnData) {
                        console.log(`🔄 Reloaded turn for updated call ${call.call_id}`);
                        setCallTurns((prev) => ({
                          ...prev,
                          [call.call_id]: turnData,
                        }));
                      }
                    });
                }
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
                   
                   console.log("🔄 Call turn updated:", payload.eventType, turn);
                   
                   // Reload turn for this call_id
                   if (turn?.call_id && turn?.business_id === effectiveBusinessId) {
                     const { data: turnData, error: turnsError } = await supabase
                       .from("call_turns")
                       .select("id,business_id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at")
                       .eq("business_id", effectiveBusinessId)
                       .eq("call_id", turn.call_id)
                       .maybeSingle();

                     if (turnsError) {
                       console.error("❌ Error reloading turn:", turnsError);
                     } else if (turnData) {
                       console.log(`✅ Reloaded turn for call ${turn.call_id}`);
                       setCallTurns((prev) => ({
                         ...prev,
                         [turn.call_id]: turnData,
                       }));
                     }
                   }
                 }
               )
               .subscribe((status) => {
                 console.log("Call turns channel subscription status:", status);
               });
      
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
    const turn = callTurns[call.call_id];
    
    if (!turn) {
      console.log(`📋 No turn data found for call ${call.call_id}`);
      return [];
    }
    
    console.log(`📋 Getting messages for call ${call.call_id}:`, {
      total_turns: turn.total_turns,
      has_transcript_json: !!turn.transcript_json,
      transcript_json_type: typeof turn.transcript_json,
    });
    
    if (turn.transcript_json) {
      const parsed = parseTranscriptJson(turn.transcript_json);
      console.log(`Parsed ${parsed.length} messages from transcript_json`);
      return parsed;
    }
    
    console.log(`No transcript_json found for call ${call.call_id}`);
    return [];
  }

  function hasTranscript(call: Call): boolean {
    const turn = callTurns[call.call_id];
    const hasTranscriptData = !!turn && !!turn.transcript_json;
    console.log(`Has transcript check for call ${call.call_id}:`, {
      hasTurn: !!turn,
      hasTranscriptData,
      total_turns: turn?.total_turns || 0,
    });
    return hasTranscriptData;
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
