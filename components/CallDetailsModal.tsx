"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, User, MessageSquare, CheckCircle, XCircle, Mail, Clock, FileText, Bot, UserCircle } from "lucide-react";
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

type Message = {
  role: "user" | "bot";
  text: string;
};

function parseTranscript(transcript: string): Message[] {
  if (!transcript) return [];
  
  const messages: Message[] = [];
  const lines = transcript.split("\n").filter(line => line.trim());
  
  let currentRole: "user" | "bot" | null = null;
  let currentText = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect role indicators
    const userPatterns = [
      /^(user|caller|patient|client):\s*/i,
      /^\[user\]/i,
      /^\(user\)/i,
    ];
    
    const botPatterns = [
      /^(bot|ai|assistant|agent|nia):\s*/i,
      /^\[bot\]/i,
      /^\[ai\]/i,
      /^\(bot\)/i,
      /^\(assistant\)/i,
    ];
    
    const isUser = userPatterns.some(pattern => pattern.test(trimmed));
    const isBot = botPatterns.some(pattern => pattern.test(trimmed));
    
    if (isUser || isBot) {
      // Save previous message if exists
      if (currentRole && currentText.trim()) {
        messages.push({ role: currentRole, text: currentText.trim() });
      }
      
      // Start new message
      currentRole = isUser ? "user" : "bot";
      currentText = trimmed.replace(/^(user|caller|patient|client|bot|ai|assistant|agent|nia):\s*/i, "")
        .replace(/^\[(user|bot|ai)\]\s*/i, "")
        .replace(/^\((user|bot|assistant)\)\s*/i, "")
        .trim();
    } else if (currentRole) {
      // Continue current message
      currentText += (currentText ? " " : "") + trimmed;
    } else {
      // If no role detected yet, try to infer from context
      // Default to bot if it's the first line and looks like a greeting
      if (messages.length === 0) {
        const lower = trimmed.toLowerCase();
        if (lower.includes("hello") || lower.includes("hi") || lower.includes("thank you") || 
            lower.includes("how can i") || lower.includes("i can help")) {
          currentRole = "bot";
          currentText = trimmed;
        } else {
          currentRole = "user";
          currentText = trimmed;
        }
      } else {
        // Continue with last role
        currentRole = messages[messages.length - 1].role;
        currentText = trimmed;
      }
    }
  }
  
  // Save last message
  if (currentRole && currentText.trim()) {
    messages.push({ role: currentRole, text: currentText.trim() });
  }
  
  // If no messages parsed, return the whole transcript as a single bot message
  if (messages.length === 0 && transcript.trim()) {
    return [{ role: "bot", text: transcript.trim() }];
  }
  
  return messages;
}

type CallDetailsModalProps = {
  call: Call | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function CallDetailsModal({ call, isOpen, onClose }: CallDetailsModalProps) {
  const { accentColor } = useAccentColor();
  if (!call) return null;

  return (
    <>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={onClose}
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                  <div
                    className="glass-strong rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-xl border"
                          style={{
                            background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColor}4D)`,
                            borderColor: `${accentColor}4D`,
                          }}
                        >
                          <Phone className="h-6 w-6" style={{ color: accentColor }} />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            {call.patient_name || "Unknown"}
                          </h2>
                          <p className="text-sm text-white/60 mt-1">
                            {format(new Date(call.started_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                      >
                        <X className="h-5 w-5 text-white/60" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                      <div className="space-y-6">
                        {/* Contact Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {call.phone && (
                            <div className="flex items-start gap-3">
                              <Phone className="h-4 w-4 text-white/40 mt-1 flex-shrink-0" />
                              <div>
                                <div className="text-xs text-white/60 mb-1">Phone</div>
                                <div className="text-sm text-white">{call.phone}</div>
                              </div>
                            </div>
                          )}
                          {call.email && (
                            <div className="flex items-start gap-3">
                              <Mail className="h-4 w-4 text-white/40 mt-1 flex-shrink-0" />
                              <div>
                                <div className="text-xs text-white/60 mb-1">Email</div>
                                <div className="text-sm text-white">{call.email}</div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <Clock className="h-4 w-4 text-white/40 mt-1 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-white/60 mb-1">Started</div>
                              <div className="text-sm text-white">{format(new Date(call.started_at), "MMM d, yyyy 'at' h:mm a")}</div>
                            </div>
                          </div>
                          {call.ended_at && (
                            <div className="flex items-start gap-3">
                              <Clock className="h-4 w-4 text-white/40 mt-1 flex-shrink-0" />
                              <div>
                                <div className="text-xs text-white/60 mb-1">Ended</div>
                                <div className="text-sm text-white">{format(new Date(call.ended_at), "MMM d, yyyy 'at' h:mm a")}</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Status and Intent */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl glass border border-white/10">
                            <div className="text-sm text-white/60 mb-2">Status</div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                  call.status === "active"
                                    ? ""
                                    : call.status === "ended"
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : "bg-white/10 text-white/80 border-white/10"
                                }`}
                                style={call.status === "active" ? {
                                  backgroundColor: `${accentColor}33`,
                                  color: accentColor,
                                  borderColor: `${accentColor}4D`,
                                } : {}}
                              >
                                {call.status || "unknown"}
                              </span>
                              {call.success !== null && (
                                call.success ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )
                              )}
                            </div>
                          </div>
                          {call.last_intent && (
                            <div 
                              className="p-4 rounded-xl border"
                              style={{
                                background: `linear-gradient(to right, ${accentColor}1A, ${accentColor}26)`,
                                borderColor: `${accentColor}33`,
                              }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4" style={{ color: accentColor }} />
                                <span className="text-sm text-white/60">Intent</span>
                              </div>
                              <div className="text-white font-medium">{call.last_intent}</div>
                            </div>
                          )}
                        </div>

                        {/* Summary - Main Focus */}
                        {call.last_summary && (
                          <div className="p-6 rounded-xl glass border border-white/10 bg-white/5">
                            <div className="flex items-center gap-3 mb-4">
                              <div 
                                className="p-2 rounded-lg border"
                                style={{
                                  backgroundColor: `${accentColor}33`,
                                  borderColor: `${accentColor}4D`,
                                }}
                              >
                                <FileText className="h-5 w-5" style={{ color: accentColor }} />
                              </div>
                              <div className="text-base font-bold text-white uppercase tracking-wider">Summary</div>
                            </div>
                            <p className="text-lg text-white leading-relaxed">{call.last_summary}</p>
                          </div>
                        )}
                        
                        {/* Transcript - Condensed with Scroll */}
                        {call.transcript && (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <FileText className="h-4 w-4 text-white/60" />
                              <div className="text-xs font-medium text-white/60 uppercase tracking-wider">Transcript</div>
                            </div>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                              {parseTranscript(call.transcript).map((message, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                  <div className={`flex items-start gap-2 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                                    <div 
                                      className={`p-1.5 rounded-full flex-shrink-0 border ${
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
                                        <UserCircle className="h-3.5 w-3.5 text-blue-400" />
                                      ) : (
                                        <Bot className="h-3.5 w-3.5" style={{ color: accentColor }} />
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
                          </div>
                        )}
                        
                        {/* Call ID */}
                        <div className="pt-2 border-t border-white/10">
                          <div className="text-xs text-white/40">Call ID: {call.call_id}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

