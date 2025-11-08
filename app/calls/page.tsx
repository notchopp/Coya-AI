"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { BadgeCheck, PhoneIncoming, Bot, UserCircle, X, ExternalLink } from "lucide-react";
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
  transcript?: string | null;
  total_turns: number | null;
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

// Helper function to check if a message is a tool call
function isToolCall(msg: any): boolean {
  if (!msg || typeof msg !== "object") return false;
  
  const role = (msg.role || msg.speaker || "").toLowerCase();
  const msgType = (msg.type || "").toLowerCase();
  
  // Check for tool/function indicators
  return (
    role === "tool" || 
    role === "function" ||
    role === "function_call" ||
    msgType === "tool" ||
    msgType === "function" ||
    !!msg.function || // Function call object (like n8n calls)
    !!msg.function_call ||
    !!msg.tool_calls ||
    !!msg.tool_call_id ||
    (msg.content && typeof msg.content === "object" && (msg.content.type === "tool" || msg.content.type === "function")) ||
    // Check if it's a JSON string that represents a tool call
    (typeof msg === "string" && msg.trim().startsWith("{") && (
      msg.includes('"type":"function"') ||
      msg.includes('"type":"tool"') ||
      msg.includes('"function":{') ||
      msg.includes('"function_call"')
    ))
  );
}

// Helper function to filter tool calls from a string transcript
function filterToolCallsFromString(transcript: string): string {
  if (!transcript || typeof transcript !== "string") return transcript;
  
  let filtered = transcript;
  
  // More comprehensive pattern to match nested JSON tool calls
  // Matches: {"id":"...","type":"function","function":{...}}
  // This pattern handles nested objects and escaped quotes
  const nestedToolCallPattern = /\{[^{}]*"type"\s*:\s*"(function|tool)"[^{}]*"function"\s*:\s*\{[^}]*\}[^{}]*\}/g;
  
  // Pattern for simple tool calls: {"id":"...","type":"function",...}
  const simpleToolCallPattern = /\{[^{}]*"type"\s*:\s*"(function|tool)"[^{}]*\}/g;
  
  // Pattern for function calls: {"id":"...","function":{...}}
  const functionCallPattern = /\{[^{}]*"function"\s*:\s*\{[^}]*\}[^{}]*\}/g;
  
  // Pattern for tool calls with id and type at start: {"id":"...","type":"function"
  const idTypePattern = /\{\s*"id"\s*:\s*"[^"]+"\s*,\s*"type"\s*:\s*"(function|tool)"[^}]*\}/g;
  
  // Remove tool call JSON objects (try multiple times to catch nested/overlapping patterns)
  let previousLength = filtered.length;
  let iterations = 0;
  while (iterations < 5) {
    filtered = filtered.replace(nestedToolCallPattern, "");
    filtered = filtered.replace(simpleToolCallPattern, "");
    filtered = filtered.replace(functionCallPattern, "");
    filtered = filtered.replace(idTypePattern, "");
    
    // If no changes, we're done
    if (filtered.length === previousLength) break;
    previousLength = filtered.length;
    iterations++;
  }
  
  // Clean up any double newlines or extra whitespace left behind
  filtered = filtered.replace(/\n\s*\n\s*\n/g, "\n\n");
  filtered = filtered.replace(/^\s*\n+/, ""); // Remove leading newlines
  filtered = filtered.replace(/\n+\s*$/, ""); // Remove trailing newlines
  filtered = filtered.trim();
  
  return filtered;
}

function parseTranscriptJson(transcriptJson: any): Message[] {
  if (!transcriptJson) return [];
  
  console.log("🔍 Parsing transcript_json:", typeof transcriptJson, transcriptJson);
  
  // Handle different JSON structures
  // If it's an array of messages
  if (Array.isArray(transcriptJson)) {
    console.log("📝 Array detected with", transcriptJson.length, "items");
    console.log("📝 First item keys:", transcriptJson[0] ? Object.keys(transcriptJson[0]) : "no items");
    console.log("📝 First item:", transcriptJson[0]);
    
    const messages = transcriptJson
      .filter((msg: any) => {
        // Filter out tool calls
        if (isToolCall(msg)) {
          console.log("🚫 Filtered out tool call:", msg);
          return false;
        }
        return true;
      })
      .map((msg: any, idx: number) => {
        // Skip if this is a tool call (double check)
        if (isToolCall(msg)) {
          console.log(`  🚫 Skipping tool call at index ${idx}:`, msg);
          return null;
        }
        
        // Determine role from speaker field
        const speaker = (msg.speaker || msg.role || "").toLowerCase();
        const role: "user" | "bot" = speaker.includes("user") || speaker.includes("caller") || speaker.includes("patient") ? "user" : "bot";
        
        // Try multiple possible text field names
        let text = msg.text || msg.content || msg.message || msg.transcript || msg.text_content || msg.utterance || "";
        
        // If content is an object, try to extract text from it
        if (typeof text === "object" && text !== null) {
          text = text.text || text.content || text.message || JSON.stringify(text);
        }
        
        // If text is a string, filter out any embedded tool call JSON objects
        let finalText = typeof text === "string" ? filterToolCallsFromString(text) : text;
        
        // Skip if text is empty or only whitespace after filtering
        if (!finalText || typeof finalText !== "string" || finalText.trim().length === 0) {
          console.log(`  ⚠️ Skipping empty message at index ${idx} after filtering`);
          return null;
        }
        
        console.log(`  Item ${idx}: speaker="${speaker}", role="${role}", text="${finalText.substring(0, 50)}..."`);
        
        return { role, text: finalText };
      })
      .filter((msg): msg is Message => !!msg)
      .filter((msg: Message) => {
        const hasText = msg.text.trim().length > 0;
        if (!hasText) {
          console.log(`  ⚠️ Filtered out message with no text:`, msg);
        }
        return hasText;
      });
    
    console.log("✅ Parsed array messages:", messages.length, "messages (tool calls filtered out)");
    if (messages.length > 0) {
      console.log("📋 Sample messages:", messages.slice(0, 3));
    }
    return messages;
  }
  
  // If it's an object with messages array
  if (transcriptJson.messages && Array.isArray(transcriptJson.messages)) {
    const messages = transcriptJson.messages
      .filter((msg: any) => {
        if (isToolCall(msg)) {
          console.log("🚫 Filtered out tool call from messages array:", msg);
          return false;
        }
        return true;
      })
      .map((msg: any) => {
        const speaker = (msg.speaker || msg.role || "").toLowerCase();
        const role: "user" | "bot" = speaker.includes("user") || speaker.includes("caller") || speaker.includes("patient") ? "user" : "bot";
        let text = msg.text || msg.content || msg.message || msg.transcript || msg.text_content || msg.utterance || "";
        if (typeof text === "object" && text !== null) {
          text = text.text || text.content || text.message || JSON.stringify(text);
        }
        // Filter tool calls from text string
        text = typeof text === "string" ? filterToolCallsFromString(text) : text;
        return { role, text };
      })
      .filter((msg: Message) => msg.text.trim().length > 0);
    console.log("Parsed object.messages:", messages.length, "(tool calls filtered out)");
    return messages;
  }
  
  // If it's a string, filter tool calls first, then try to parse it
  if (typeof transcriptJson === "string") {
    // Filter out tool call JSON objects from the string
    const filteredString = filterToolCallsFromString(transcriptJson);
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(filteredString);
      return parseTranscriptJson(parsed);
    } catch (e) {
      // If it's not valid JSON, treat it as plain text and split by lines
      // Filter out lines that look like tool calls
      const lines = filteredString.split("\n").filter((line: string) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length === 0) return false;
        
        // Skip lines that are JSON tool calls - more comprehensive check
        if (trimmed.startsWith("{")) {
          // Check for various tool call patterns
          const isToolCallLine = 
            trimmed.includes('"type":"function"') ||
            trimmed.includes('"type":"tool"') ||
            trimmed.includes('"function":{') ||
            trimmed.includes('"function": {') ||
            (trimmed.includes('"id"') && trimmed.includes('"type"') && (trimmed.includes('"function"') || trimmed.includes('function'))) ||
            trimmed.match(/^\s*\{\s*"id"\s*:\s*"[^"]+"\s*,\s*"type"\s*:\s*"(function|tool)"/);
          
          if (isToolCallLine) {
            console.log("🚫 Filtered out tool call line:", trimmed.substring(0, 100));
            return false;
          }
        }
        return true;
      });
      
      // If we have lines, try to determine role and create messages
      if (lines.length > 0) {
        // Simple heuristic: alternate between user and bot, or check for keywords
        const messages: Message[] = [];
        let currentRole: "user" | "bot" = "bot";
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Try to detect role from content
          const lower = trimmed.toLowerCase();
          if (lower.includes("thanks for calling") || 
              lower.includes("what can i do") ||
              lower.includes("i can help") ||
              lower.includes("we're open") ||
              lower.includes("we have")) {
            currentRole = "bot";
          } else if (lower.startsWith("hey") || 
                     lower.startsWith("hi") ||
                     lower.includes("i was") ||
                     lower.includes("can you") ||
                     lower.includes("i would")) {
            currentRole = "user";
          }
          
          messages.push({ role: currentRole, text: trimmed });
          // Alternate for next message
          currentRole = currentRole === "user" ? "bot" : "user";
        }
        
        console.log("✅ Parsed string as plain text:", messages.length, "messages");
        return messages;
      }
      
      console.log("❌ Failed to parse string as JSON or text:", e);
      return [];
    }
  }
  
  // If transcript_json is an object with role/text directly
  if (transcriptJson.role || transcriptJson.speaker) {
    if (isToolCall(transcriptJson)) {
      console.log("🚫 Filtered out tool call object");
      return [];
    }
    
    const speaker = (transcriptJson.role || transcriptJson.speaker || "").toLowerCase();
    const role: "user" | "bot" = speaker.includes("user") || speaker.includes("caller") || speaker.includes("patient") ? "user" : "bot";
    let text = transcriptJson.text || transcriptJson.content || transcriptJson.message || transcriptJson.transcript || transcriptJson.text_content || transcriptJson.utterance || "";
    if (typeof text === "object" && text !== null) {
      text = text.text || text.content || text.message || JSON.stringify(text);
    }
    // Filter tool calls from text string
    text = typeof text === "string" ? filterToolCallsFromString(text) : text;
    if (text.trim().length > 0) {
      console.log("Parsed single message object:", { role, text });
      return [{ role, text }];
    }
  }
  
  console.log("❌ No valid structure found in transcript_json");
  return [];
}

export default function LiveCallsPage() {
  const { accentColor } = useAccentColor();
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
        .select("id,business_id,call_id,patient_id,status,phone,email,patient_name,last_summary,last_intent,success,started_at,ended_at,total_turns")
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
      // Also include calls that are updating (might have null/undefined status temporarily)
      const activeCalls = (callsData || []).filter(c => {
        const statusLower = c.status?.toLowerCase()?.trim();
        const isActive = statusLower === "active" || 
                        statusLower === "in-progress" || 
                        statusLower === "in_progress" ||
                        (!statusLower && c.started_at && !c.ended_at); // Include calls that are in progress but status might be updating
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
      // Match by: call_id (call_turns doesn't have business_id)
      if (activeCalls.length > 0) {
        const callIds = activeCalls.map(c => c.call_id).filter(Boolean);
        
        console.log("🔄 Loading call turns for call_ids:", callIds);
        
        // Query call_turns matching by call_id
        let turnsData: CallTurn[] = [];
        let turnsError: any = null;
        
        if (callIds.length > 0) {
          // Query by call_id
          const { data, error } = await supabase
            .from("call_turns" as any)
            .select("id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at,to_number")
            .in("call_id", callIds);
          
          turnsData = (data as unknown as CallTurn[]) || [];
          turnsError = error;
          
          console.log("📞 Queried by call_id, found:", turnsData.length);
        }

        if (turnsError) {
          console.error("❌ Error loading call turns:", turnsError);
          setCallTurns({});
        } else {
          console.log("✅ Loaded call turns:", turnsData?.length || 0, "turns");
          
          // Filter and match turns to active calls
          // Match by call_id
          const turnsByCallId: Record<string, CallTurn> = {};
          
          (turnsData || []).forEach((turn: CallTurn) => {
            // Find matching call by call_id
            const matchingCall = activeCalls.find(call => {
              return call.call_id && turn.call_id && call.call_id === turn.call_id;
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

      // Only update calls if we have active calls OR if we previously had calls (to handle transitions smoothly)
      // This prevents flickering when status updates temporarily
      if (activeCalls.length > 0 || calls.length > 0) {
        setCalls(activeCalls);
      }

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
                    .from("call_turns" as any)
                    .select("id,call_id,total_turns,duration_sec,transcript_json,created_at,updated_at,to_number");
                  
                  // Try call_id first, fallback to to_number
                  if (call.call_id) {
                    query = query.eq("call_id", call.call_id);
                  } else {
                    return;
                  }
                  
                  query.maybeSingle().then(({ data: turnData, error: turnsError }) => {
                    if (!turnsError && turnData) {
                      const typedTurnData = turnData as unknown as CallTurn;
                      // Verify match by call_id
                      const matches = call.call_id && typedTurnData.call_id === call.call_id;
                      
                      if (matches && call.call_id) {
                        console.log(`🔄 Reloaded turn for updated call ${call.call_id} (status: ${call.status})`);
                        setCallTurns((prev) => ({
                          ...prev,
                          [call.call_id]: typedTurnData,
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
                       .from("call_turns" as any)
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
                       const typedTurnData = turnData as unknown as CallTurn;
                       console.log("✅ Reloaded turn data:", {
                         call_id: typedTurnData.call_id,
                         transcript_json_length: typedTurnData.transcript_json ? (Array.isArray(typedTurnData.transcript_json) ? typedTurnData.transcript_json.length : 'object') : 'null',
                         total_turns: typedTurnData.total_turns
                       });
                       
                       // Find matching active call and update immediately
                       setCalls((currentCalls) => {
                         const matchingCall = currentCalls.find(call => {
                           return call.call_id && typedTurnData.call_id && call.call_id === typedTurnData.call_id;
                         });
                         
                         if (matchingCall && matchingCall.call_id) {
                           console.log(`✅ Updating transcript for call ${matchingCall.call_id} in real-time`);
                           setCallTurns((prev) => ({
                             ...prev,
                             [matchingCall.call_id]: typedTurnData,
                           }));
                         } else {
                           console.log("⚠️ No matching active call found for turn:", typedTurnData.call_id);
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

      // Poll for updates every 5 seconds to catch transcript changes
      // This ensures we catch any updates even if real-time subscription misses them
      // Reduced frequency to prevent flickering
      const pollInterval = setInterval(() => {
        if (isMounted) {
          // Only reload if we have active calls to avoid flickering
          if (calls.length > 0) {
            loadActiveCalls();
          }
        }
      }, 5000);

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
  }, [supabase, effectiveBusinessId, mounted]); // Removed calls.length to prevent flickering

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
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Live Calls</h1>
          <span className="beta-badge">Beta</span>
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
              className="glass-strong rounded-2xl p-6 max-w-md w-full border"
              style={{ borderColor: `${accentColor}4D` }}
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
                <motion.button
                  onClick={() => handleViewFullLog(endedCallId)}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: `${accentColor}33`,
                    borderColor: `${accentColor}4D`,
                    color: accentColor,
                  }}
                  whileHover={{ backgroundColor: `${accentColor}4D` }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Full Log
                </motion.button>
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
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
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
                <div className="p-4 sm:p-6 border-b border-white/10">
                  <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                      <div 
                        className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border flex-shrink-0"
                        style={{
                          backgroundColor: `${accentColor}33`,
                          borderColor: `${accentColor}4D`,
                        }}
                      >
                        <PhoneIncoming className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: accentColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-white truncate">
                          {call.patient_name || "Unknown Caller"}
                        </h3>
                        {call.phone && (
                          <p className="text-xs sm:text-sm text-white/60 truncate">{call.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 sm:gap-2 flex-shrink-0">
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
                        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border"
                        style={{
                          backgroundColor: `${accentColor}33`,
                          borderColor: `${accentColor}4D`,
                        }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                        <span className="text-xs font-medium" style={{ color: accentColor }}>Live</span>
                      </motion.div>
                      <div className="text-xs text-white/40">
                        {format(new Date(call.started_at), "h:mm a")}
                      </div>
                    </div>
                  </div>
                  {call.last_intent && (
                    <div className="mt-3">
                      <span 
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                        style={{
                          backgroundColor: `${accentColor}33`,
                          color: accentColor,
                          borderColor: `${accentColor}4D`,
                        }}
                      >
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
                          <div className={`flex items-start gap-1.5 sm:gap-2 max-w-[85%] sm:max-w-[80%] ${message.role === "user" ? "flex-row-reverse ml-auto" : ""}`}>
                            <div 
                              className={`p-1 sm:p-1.5 rounded-full flex-shrink-0 border ${
                                message.role === "user"
                                  ? ""
                                  : ""
                              }`}
                              style={message.role === "user" ? {
                                backgroundColor: "rgba(59, 130, 246, 0.2)",
                                borderColor: "rgba(59, 130, 246, 0.3)",
                              } : {
                                backgroundColor: `${accentColor}33`,
                                borderColor: `${accentColor}4D`,
                              }}
                            >
                              {message.role === "user" ? (
                                <UserCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400" />
                              ) : (
                                <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: accentColor }} />
                              )}
                            </div>
                            <div className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl ${
                              message.role === "user"
                                ? "bg-blue-500/20 border border-blue-500/30 text-white rounded-br-sm"
                                : "bg-white/5 border border-white/10 text-white/90 rounded-bl-sm"
                            }`}>
                              <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
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
