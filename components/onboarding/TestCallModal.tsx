"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { X, Phone, Bot, UserCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

interface TranscriptTurn {
  turn_number?: number;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  confidence_score?: number;
}

interface TestCallModalProps {
  callId: string;
  businessId: string;
  onClose: () => void;
}

export function TestCallModal({ callId, businessId, onClose }: TestCallModalProps) {
  const { accentColor } = useAccentColor();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [isCallActive, setIsCallActive] = useState(true);
  const [callStatus, setCallStatus] = useState<"connecting" | "active" | "ended">("connecting");
  const [totalTurns, setTotalTurns] = useState(0);
  const [duration, setDuration] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabaseClient();

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    let isMounted = true;

    // Subscribe to call_turns table updates
    const turnsChannel = supabase
      .channel(`call_turns:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_turns",
          filter: `call_id=eq.${callId}`,
        },
        async () => {
          if (isMounted) {
            await loadCallTurns();
          }
        }
      )
      .subscribe();

    // Subscribe to calls table for status updates
    const callsChannel = supabase
      .channel(`calls:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const updatedCall = payload.new as any;

          if (updatedCall.status === "ended" || updatedCall.ended_at) {
            setIsCallActive(false);
            setCallStatus("ended");
          } else if (updatedCall.status === "active" || updatedCall.status === "in-progress") {
            setCallStatus("active");
          }
        }
      )
      .subscribe();

    // Initial load
    loadCallTurns();

    // Polling fallback (every 500ms for smoother updates)
    const pollInterval = setInterval(() => {
      if (isMounted) {
        loadCallTurns();
      }
    }, 500);

    return () => {
      isMounted = false;
      turnsChannel.unsubscribe();
      callsChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [callId]);

  const loadCallTurns = async () => {
    // Load call_turns data
    const { data: turnsData, error: turnsError } = await (supabase as any)
      .from("call_turns")
      .select("transcript_json, total_turns, duration_sec")
      .eq("call_id", callId)
      .single();

    if (turnsData && !turnsError) {
      // Parse transcript_json
      if (turnsData.transcript_json) {
        const parsedTurns = Array.isArray(turnsData.transcript_json)
          ? turnsData.transcript_json
          : turnsData.transcript_json.turns || [];

        setTurns(parsedTurns);
      }

      setTotalTurns(turnsData.total_turns || 0);
      setDuration(turnsData.duration_sec || 0);
    }

    // Also check call status
    const { data: callData } = await supabase
      .from("calls")
      .select("status, ended_at")
      .eq("call_id", callId)
      .single();

    if (callData) {
      if (callData.status === "ended" || callData.ended_at) {
        setIsCallActive(false);
        setCallStatus("ended");
      } else if (callData.status === "active" || callData.status === "in-progress") {
        setCallStatus("active");
      }
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Test Call - Live Transcript</h2>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      callStatus === "active"
                        ? "bg-green-500 animate-pulse"
                        : callStatus === "connecting"
                        ? "bg-yellow-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <span className="text-sm text-white/60">
                    {callStatus === "active"
                      ? "Call Active"
                      : callStatus === "connecting"
                      ? "Connecting..."
                      : "Call Ended"}
                  </span>
                </div>
                <span className="text-sm text-white/50">
                  {totalTurns} turns • {formatDuration(duration)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5 text-white/60" />
            </button>
          </div>

          {/* Transcript Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/5">
            {turns.length === 0 ? (
              <div className="text-center text-white/40 mt-8">
                <div className="animate-pulse">Waiting for transcript...</div>
              </div>
            ) : (
              <div className="space-y-3">
                {turns.map((turn, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex gap-3 p-3 rounded-lg ${
                      turn.role === "assistant"
                        ? "bg-blue-50/10 border-l-4 border-blue-500"
                        : "bg-white/5 border-l-4 border-gray-400"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          turn.role === "assistant"
                            ? "bg-blue-500/20"
                            : "bg-gray-400/20"
                        }`}
                      >
                        {turn.role === "assistant" ? (
                          <Bot className="h-4 w-4 text-blue-400" />
                        ) : (
                          <UserCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-white/60">
                          {turn.role === "assistant" ? "AI Receptionist" : "Caller"}
                        </span>
                        {turn.timestamp && (
                          <span className="text-xs text-white/40">
                            {format(new Date(turn.timestamp), "h:mm:ss a")}
                          </span>
                        )}
                        {turn.confidence_score !== undefined && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              turn.confidence_score > 0.8
                                ? "bg-green-500/20 text-green-400"
                                : turn.confidence_score > 0.6
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {Math.round(turn.confidence_score * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/90 whitespace-pre-wrap break-words">
                        {turn.content}
                      </p>
                    </div>
                  </motion.div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Call ID: {callId.slice(0, 8)}...</span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-white font-medium transition-colors"
                style={{
                  backgroundColor: `${accentColor}33`,
                  color: accentColor,
                }}
              >
                {isCallActive ? "End Call & Close" : "Close"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

