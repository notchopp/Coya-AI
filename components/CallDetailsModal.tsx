"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, User, MessageSquare, CheckCircle, XCircle } from "lucide-react";
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
  escalate: boolean | null;
  upsell: boolean | null;
  schedule: any;
  context: any;
  total_turns: number | null;
};

type CallDetailsModalProps = {
  call: Call | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function CallDetailsModal({ call, isOpen, onClose }: CallDetailsModalProps) {
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
                        <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                          <Phone className="h-6 w-6 text-yellow-400" />
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
                        {/* Patient Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl glass border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-yellow-400" />
                              <span className="text-sm text-white/60">Patient</span>
                            </div>
                            <div className="text-white font-medium">
                              {call.patient_name || "Unknown"}
                            </div>
                          </div>
                          <div className="p-4 rounded-xl glass border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                              <Phone className="h-4 w-4 text-yellow-400" />
                              <span className="text-sm text-white/60">Phone</span>
                            </div>
                            <div className="text-white font-medium">{call.phone || "—"}</div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="p-4 rounded-xl glass border border-white/10">
                          <div className="text-sm text-white/60 mb-2">Status</div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                call.status === "active"
                                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                  : "bg-white/10 text-white/80 border border-white/10"
                              }`}
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

                        {/* Intent */}
                        {call.last_intent && (
                          <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-yellow-400" />
                              <span className="text-sm text-white/60">Intent</span>
                            </div>
                            <div className="text-white font-medium">{call.last_intent}</div>
                          </div>
                        )}

                        {/* Summary */}
                        {call.last_summary && (
                          <div className="p-4 rounded-xl glass border border-white/10">
                            <div className="text-sm text-white/60 mb-2">Summary</div>
                            <div className="text-white/90 leading-relaxed">{call.last_summary}</div>
                          </div>
                        )}
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

