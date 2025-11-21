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

type Patient = {
  patient_id: string;
  business_id: string;
  patient_name: string | null;
  phone: string | null;
  email: string | null;
  last_visit: string | null;
  last_treatment: string | null;
  last_intent: string | null;
  last_call_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export default function PatientsPage() {
  const { accentColor } = useAccentColor();
  const { programId } = useProgram();
  const { role: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveBusinessId = useMemo(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("business_id") || undefined;
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function loadPatients() {
      if (!effectiveBusinessId) {
        console.warn("⚠️ No business_id found, cannot load patients");
        setPatients([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log("🔍 Loading patients for business_id:", effectiveBusinessId);

      const { data: patientsData, error: patientsError } = await (supabase as any)
        .from("patients")
        .select("*")
        .eq("business_id", effectiveBusinessId)
        .order("last_call_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (patientsError) {
        console.error("❌ Error loading patients:", patientsError);
        setPatients([]);
      } else {
        console.log("✅ Loaded patients:", patientsData?.length || 0);
        setPatients((patientsData as unknown as Patient[]) || []);
      }
      setLoading(false);
    }
    
    loadPatients();
  }, [effectiveBusinessId, supabase]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const query = searchQuery.toLowerCase();
    return patients.filter((patient) => {
      return (
        patient.patient_name?.toLowerCase().includes(query) ||
        patient.phone?.toLowerCase().includes(query) ||
        patient.email?.toLowerCase().includes(query) ||
        patient.last_treatment?.toLowerCase().includes(query) ||
        patient.last_intent?.toLowerCase().includes(query)
      );
    });
  }, [patients, searchQuery]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: accentColor }}>
            Patients
          </h1>
          <p className="text-white/60">Manage and view your patient database</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search patients by name, phone, email, or treatment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-opacity-50"
              style={{ 
                borderColor: searchQuery ? `${accentColor}66` : 'rgba(255, 255, 255, 0.1)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = `${accentColor}66`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            />
            <UserCircle className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
          </div>
        </div>

        {/* Patients List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-white/60">Loading patients...</div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-12">
            <UserCircle className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <p className="text-white/60 text-lg mb-2">
              {searchQuery ? "No patients found matching your search" : "No patients yet"}
            </p>
            <p className="text-white/40 text-sm">
              {searchQuery ? "Try a different search term" : "Patients will appear here after they call"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPatients.map((patient) => (
              <motion.div
                key={patient.patient_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-opacity-30 transition-all"
                style={{ borderColor: `${accentColor}33` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold"
                        style={{
                          backgroundColor: `${accentColor}33`,
                          color: accentColor,
                        }}
                      >
                        {patient.patient_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {patient.patient_name || "Unknown Patient"}
                        </h3>
                        {patient.phone && (
                          <p className="text-sm text-white/60">{patient.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {patient.email && (
                        <div>
                          <span className="text-white/40">Email:</span>{" "}
                          <span className="text-white/80">{patient.email}</span>
                        </div>
                      )}
                      {patient.last_visit && (
                        <div>
                          <span className="text-white/40">Last Visit:</span>{" "}
                          <span className="text-white/80">
                            {format(new Date(patient.last_visit), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}
                      {patient.last_treatment && (
                        <div>
                          <span className="text-white/40">Last Treatment:</span>{" "}
                          <span className="text-white/80">{patient.last_treatment}</span>
                        </div>
                      )}
                      {patient.last_call_date && (
                        <div>
                          <span className="text-white/40">Last Call:</span>{" "}
                          <span className="text-white/80">
                            {format(new Date(patient.last_call_date), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      )}
                      {patient.last_intent && (
                        <div className="md:col-span-2">
                          <span className="text-white/40">Last Intent:</span>{" "}
                          <span className="text-white/80">{patient.last_intent}</span>
                        </div>
                      )}
                      {patient.notes && (
                        <div className="md:col-span-2">
                          <span className="text-white/40">Notes:</span>{" "}
                          <span className="text-white/80">{patient.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && patients.length > 0 && (
          <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-white/60">
              Showing {filteredPatients.length} of {patients.length} patients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
