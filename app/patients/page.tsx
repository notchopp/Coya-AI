"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { BadgeCheck, PhoneIncoming, Bot, UserCircle, X, ExternalLink, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import { AnonymizationToggle, applyAnonymization } from "@/components/AnonymizationToggle";
import { useProgram } from "@/components/ProgramProvider";
import { useUserRole } from "@/lib/useUserRole";

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
  const { programId } = useProgram();
  const { role: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsByProgram, setCallsByProgram] = useState<Record<string, Call[]>>({});
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [callTurns, setCallTurns] = useState<Record<string, CallTurn>>({}); // Store one turn record per call_id
  const [connected, setConnected] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [endedCallId, setEndedCallId] = useState<string | null>(null);
  const [hasLoadedCalls, setHasLoadedCalls] = useState(false); // Track if we've loaded calls at least once
  const [isAnonymized, setIsAnonymized] = useState(false);

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

      // Load programs if admin
      if (isAdmin) {
        const { data: programsData } = await (supabase as any)
          .from("programs")
          .select("id, name")
          .eq("business_id", effectiveBusinessId);
        setPrograms(programsData || []);
      }

      // First, check all calls for this business to see what statuses exist
      let allCallsQuery = (supabase as any)
        .from("calls")
        .select("id,business_id,call_id,status,patient_name,program_id")
        .eq("business_id", effectiveBusinessId);
      
      // Filter by program_id if program is selected (non-admin) or show all (admin)
      if (!isAdmin && programId) {
        allCallsQuery = allCallsQuery.eq("program_id", programId);
      }
      
      const { data: allCallsData } = await allCallsQuery
        .order("started_at", { ascending: false })
        .limit(20);
      
      console.log("🔍 All calls for this business:", allCallsData?.length || 0);
      console.log("🔍 Sample calls:", allCallsData?.slice(0, 5));
      console.log("🔍 Status values found:", allCallsData?.map((c: any) => ({ call_id: c.call_id, status: c.status, patient_name: c.patient_name })));

      // Now query for active calls (try both exact match and case-insensitive)
      let callsQuery = (supabase as any)
        .from("calls")
        .select("id,business_id,call_id,patient_id,status,phone,email,patient_name,last_summary,last_intent,success,started_at,ended_at,total_turns,program_id")
        .eq("business_id", effectiveBusinessId);
      
      // Filter by program_id if program is selected (non-admin) or show all (admin)
      if (!isAdmin && programId) {
        callsQuery = callsQuery.eq("program_id", programId);
      }
      
      const { data: callsData, error: callsError } = await callsQuery
        .order("started_at", { ascending: false });

      if (!isMounted) return;
      if (callsError) {
        console.error("❌ Error loading calls:", callsError);
        return;
      }

      console.log("📞 Raw calls data:", callsData);
      console.log("📞 Total calls fetched:", callsData?.length || 0);

      // Filter for active calls - only calls that have started and haven't ended
      const activeCalls = (callsData || []).filter((c: any) => {
        const hasStarted = !!c.started_at;
        const hasNotEnded = !c.ended_at;
        const statusLower = c.status?.toLowerCase()?.trim();
        const isEndedStatus = statusLower === "ended";
        
        // Only include if: started, not ended (by timestamp), and not ended status
        const isActive = hasStarted && hasNotEnded && !isEndedStatus;
        console.log(`Call ${c.call_id}: status="${c.status}", started_at=${hasStarted}, ended_at=${!!c.ended_at}, isActive=${isActive}, patient="${c.patient_name || 'N/A'}"`);
        return isActive;
      });

      console.log("✅ Active calls after filtering:", activeCalls.length);
      if (activeCalls.length > 0) {
        console.log("📋 Active call details:", activeCalls.map((c: any) => ({
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
        const callIds = activeCalls.map((c: any) => c.call_id).filter(Boolean);
        
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
            const matchingCall = activeCalls.find((call: any) => {
              return call.call_id && turn.call_id && call.call_id === turn.call_id;
            });
            
