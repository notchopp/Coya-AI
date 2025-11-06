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
  to_number: string | null; // Business phone number
};

type CallTurn = {
  id: string;
  call_id: string;
  total_turns: number | null;
  duration_sec: number | null;
  transcript_json: any;
  created_at: string;
  updated_at: string | null;
  to_number: string | null; // Business phone number
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

      console.log("🔍 Loading active calls for business_id:", effectiveBusinessId);

      // First, check all calls for this business to see what statuses exist
      const { data: allCallsData } = await supabase
        .from("calls")
        .select("id,business_id,call_id,status,patient_name")
        .eq("business_id", effectiveBusinessId)
        .order("started_at", { ascending: false })
        .limit(20);
      
      console.log("🔍 All calls for this business:", allCallsData?.length || 0);
      console.log("🔍 Sample calls:", allCallsData?.slice(0, 5));
      console.log("🔍 Status values found:", allCallsData?.map(c => ({ call_id: c.call_id, status: c.status, patient_name: c.patient_name })));

      // Now query for active calls (try both exact match and case-insensitive)
      const { data: callsData, error: callsError } = await supabase
        .from("calls")
        .select("id,business_id,call_id,patient_id,status,phone,email,patient_name,last_summary,last_intent,success,started_at,ended_at,total_turns,to_number")
        .eq("business_id", effectiveBusinessId)
        .order("started_at", { ascending: false });

      if (!isMounted) return;
      if (callsError) {
        console.error("❌ Error loading calls:", callsError);
        return;
      }

      console.log("📞 Raw calls data:", callsData);
      console.log("📞 Total calls fetched:", callsData?.length || 0);

      // Filter for active calls (check multiple variations)
      const activeCalls = (callsData || []).filter(c => {
        const statusLower = c.status?.toLowerCase()?.trim();
        const isActive = statusLower === "active" || statusLower === "in-progress" || statusLower === "in_progress";
        console.log(`Call ${c.call_id}: status="${c.status}" (lowercase: "${statusLower}"), isActive=${isActive}, patient="${c.patient_name || 'N/A'}"`);
        return isActive;
      });

      console.log("✅ Active calls after filtering:", activeCalls.length);
      if (activeCalls.length > 0) {
        console.log("📋 Active call details:", activeCalls.map(c => ({
          call_id: c.call_id,
          status: c.status,
          patient_name: c.patient_name,
          business_id: c.business_id
        })));
      } else {
        console.warn("⚠️ No active calls found. Check:");
        console.warn("1. Is status exactly 'active'?");
        console.warn("2. Does business_id match?", effectiveBusinessId);
        console.warn("3. Are there any calls at all?", callsData?.length || 0);
      }
      
      // Load call turns for all active calls
      // Match by: call_id OR to_number (call_turns doesn't have business_id)
      if (activeCalls.length > 0) {
        const callIds = activeCalls.map(c => c.call_id).filter(Boolean);
        const toNumbers = activeCalls
          .map(c => c.to_number?.trim()) // Trim whitespace/newlines
          .filter((num): num is string => num !== null && num !== undefined && num !== "");
        
        console.log("🔄 Loading call turns for call_ids:", callIds);
        console.log("🔄 Using to_numbers:", toNumbers);
        
        // Query call_turns matching by call_id OR to_number (no business_id filter)
        // Try call_id first, then to_number as fallback
        let turnsData: CallTurn[] = [];
        let turnsError: any = null;
        
        if (callIds.length > 0) {
          // Try call_id first
          const { data, error } = await supabase
            .from("call_turns")
            .select("id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at,to_number")
            .in("call_id", callIds);
          
          turnsData = data || [];
          turnsError = error;
          
          console.log("📞 Queried by call_id, found:", turnsData.length);
        }
        
        // If no results by call_id and we have to_numbers, try to_number
        if (turnsData.length === 0 && toNumbers.length > 0 && !turnsError) {
          const { data, error } = await supabase
            .from("call_turns")
            .select("id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at,to_number")
            .in("to_number", toNumbers);
          
          if (!error && data) {
            turnsData = [...turnsData, ...data];
          }
          turnsError = error || turnsError;
          
          console.log("📞 Queried by to_number, found:", data?.length || 0);
        }

        if (turnsError) {
          console.error("❌ Error loading call turns:", turnsError);
          setCallTurns({});
        } else {
          console.log("✅ Loaded call turns:", turnsData?.length || 0, "turns");
          
          // Filter and match turns to active calls
          // Match by call_id OR to_number (normalized)
          const turnsByCallId: Record<string, CallTurn> = {};
          
          (turnsData || []).forEach((turn: CallTurn) => {
            // Find matching call by call_id first, then by to_number (trimmed)
            const matchingCall = activeCalls.find(call => {
              const callToNumber = call.to_number?.trim();
              const turnToNumber = turn.to_number?.trim();
              
              return (
                (call.call_id && turn.call_id && call.call_id === turn.call_id) ||
                (callToNumber && turnToNumber && callToNumber === turnToNumber)
              );
            });
            
            if (matchingCall && matchingCall.call_id) {
              turnsByCallId[matchingCall.call_id] = turn;
            }
          });
          
          console.log("📊 Mapped turns by call_id:", Object.keys(turnsByCallId));
          
          if (Object.keys(turnsByCallId).length > 0) {
            const firstTurn = turnsByCallId[Object.keys(turnsByCallId)[0]];
            console.log("Sample turn:", firstTurn);
            console.log("Sample transcript_json:", JSON.stringify(firstTurn.transcript_json, null, 2));
          }
          
          setCallTurns(turnsByCallId);
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
                // Update the call in state (this will trigger re-render with new patient_name, last_intent, etc.)
                setCalls((prev) => {
                  const existingIndex = prev.findIndex(c => c.id === call.id);
                  if (existingIndex >= 0) {
                    // Update existing call
                    const updated = [...prev];
                    updated[existingIndex] = call;
                    return updated;
                  } else {
                    // Add new call
                    return [call, ...prev];
                  }
                });
                
                // Always reload turn for this call when it updates (to get latest transcript_json)
                // Match by call_id OR to_number (no business_id)
                if (call.call_id) {
                  let query = supabase
                    .from("call_turns")
                    .select("id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at,to_number");
                  
                  // Try call_id first, fallback to to_number
                  const callToNumber = call.to_number?.trim();
                  if (call.call_id) {
                    query = query.eq("call_id", call.call_id);
                  } else if (callToNumber) {
                    query = query.eq("to_number", callToNumber);
                  } else {
                    return;
                  }
                  
                  query.maybeSingle().then(({ data: turnData, error: turnsError }) => {
                    if (!turnsError && turnData) {
                      // Verify match by call_id OR to_number
                      const callToNumberTrimmed = call.to_number?.trim();
                      const turnToNumberTrimmed = turnData.to_number?.trim();
                      const matches = 
                        (call.call_id && turnData.call_id === call.call_id) ||
                        (callToNumberTrimmed && turnToNumberTrimmed && callToNumberTrimmed === turnToNumberTrimmed);
                      
                      if (matches && call.call_id) {
                        console.log(`🔄 Reloaded turn for updated call ${call.call_id} (status: ${call.status}, to_number: ${callToNumberTrimmed || 'N/A'})`);
                        setCallTurns((prev) => ({
                          ...prev,
                          [call.call_id]: turnData,
                        }));
                      }
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

             // Subscribe to call_turns table changes - this will update transcripts as they come in
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
                   console.log("🔄 Turn details:", {
                     call_id: turn?.call_id,
                     to_number: turn?.to_number,
                     has_transcript_json: !!turn?.transcript_json,
                     total_turns: turn?.total_turns
                   });
                   
                   // Reload turn and verify it matches an active call
                   // Match by call_id OR to_number (no business_id)
                   if (turn?.call_id || turn?.to_number) {
                     let query = supabase
                       .from("call_turns")
                       .select("id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at,to_number");
                     
                     // Match by call_id or to_number
                     if (turn.call_id) {
                       query = query.eq("call_id", turn.call_id);
                     } else if (turn.to_number) {
                       query = query.eq("to_number", turn.to_number.trim());
                     } else {
                       return;
                     }
                     
                     const { data: turnData, error: turnsError } = await query.maybeSingle();

                     if (turnsError) {
                       console.error("❌ Error reloading turn:", turnsError);
                     } else if (turnData) {
                       console.log("✅ Reloaded turn data:", {
                         call_id: turnData.call_id,
                         transcript_json_length: turnData.transcript_json ? (Array.isArray(turnData.transcript_json) ? turnData.transcript_json.length : 'object') : 'null',
                         total_turns: turnData.total_turns
                       });
                       
                       // Find matching active call and update immediately
                       setCalls((currentCalls) => {
                         const matchingCall = currentCalls.find(call => {
                           const callToNumber = call.to_number?.trim();
                           const turnToNumber = turnData.to_number?.trim();
                           
                           return (
                             (call.call_id && turnData.call_id && call.call_id === turnData.call_id) ||
                             (callToNumber && turnToNumber && callToNumber === turnToNumber)
                           );
                         });
                         
                         if (matchingCall && matchingCall.call_id) {
                           console.log(`✅ Updating transcript for call ${matchingCall.call_id} in real-time`);
                           setCallTurns((prev) => ({
                             ...prev,
                             [matchingCall.call_id]: turnData,
                           }));
                         } else {
                           console.log("⚠️ No matching active call found for turn:", turnData.call_id);
                         }
                         return currentCalls;
                       });
                     }
                   }
                 }
               )
               .subscribe((status) => {
                 console.log("Call turns channel subscription status:", status);
               });
      
      channels.push(turnsChannel);

      // Poll for updates every 2 seconds to catch transcript changes
      // This ensures we catch any updates even if real-time subscription misses them
      const pollInterval = setInterval(() => {
        if (isMounted) {
          loadActiveCalls();
        }
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex-shrink-0">
                        <PhoneIncoming className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">
                          {call.patient_name || "Unknown Caller"}
                        </h3>
                        {call.phone && (
                          <p className="text-sm text-white/60 truncate">{call.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Small "Call in progress" badge */}
                      <motion.div
                        animate={{
                          opacity: [0.6, 1, 0.6],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                        <span className="text-xs font-medium text-yellow-400">Live</span>
                      </motion.div>
                      <div className="text-xs text-white/40">
                        {format(new Date(call.started_at), "h:mm a")}
                      </div>
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

                {/* Call Content - Transcript */}
                <div className="p-6">
                  {hasTranscriptContent && messages.length > 0 ? (
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
                  ) : (
                    <div className="text-center py-8 text-white/40 text-sm">
                      Waiting for transcript...
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
