"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Phone, Clock, Calendar, MessageSquare, Loader2, ArrowLeft, FileText } from "lucide-react";

type Call = {
  id: string;
  call_id: string;
  started_at: string;
  patient_name: string | null;
  last_intent: string | null;
  last_summary: string | null;
  schedule: any;
  status: string | null;
  transcript: string | null;
};

type Message = {
  role: "user" | "bot";
  text: string;
};

type Booking = {
  id: string;
  schedule: any;
  started_at: string;
  patient_name: string | null;
};

export default function DemoLive() {
  const params = useParams();
  const router = useRouter();
  const sessionToken = params?.sessionToken as string;
  
  const [session, setSession] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [transcriptMessages, setTranscriptMessages] = useState<Message[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionToken) return;

    async function loadSession() {
      try {
        const response = await fetch(`/api/demo/${sessionToken}`);
        const data = await response.json();
        
        if (data.error || data.session?.isExpired) {
          router.push("/demo/expired");
          return;
        }

        setSession(data.session);
        setBusiness(data.session.demo_business);
        setRemainingSeconds(data.session.remainingSeconds);
        setLoading(false);
      } catch (error) {
        console.error("Error loading session:", error);
        setLoading(false);
      }
    }

    loadSession();
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [sessionToken, router]);

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) {
      router.push("/demo/expired");
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          router.push("/demo/expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, router]);

  // Load calls and bookings in real-time
  useEffect(() => {
    if (!business?.id) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`demo-live-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newCall = payload.new as Call;
            setCalls((prev) => [newCall, ...prev]);
            if (newCall.schedule) {
              setBookings((prev) => [{
                id: newCall.id,
                schedule: newCall.schedule,
                started_at: newCall.started_at,
                patient_name: newCall.patient_name,
              }, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedCall = payload.new as Call;
            setCalls((prev) =>
              prev.map((call) =>
                call.id === updatedCall.id ? updatedCall : call
              )
            );
            if (updatedCall.schedule) {
              setBookings((prev) => {
                const existing = prev.find(b => b.id === updatedCall.id);
                if (existing) {
                  return prev.map(b => b.id === updatedCall.id ? {
                    id: updatedCall.id,
                    schedule: updatedCall.schedule,
                    started_at: updatedCall.started_at,
                    patient_name: updatedCall.patient_name,
                  } : b);
                } else {
                  return [{
                    id: updatedCall.id,
                    schedule: updatedCall.schedule,
                    started_at: updatedCall.started_at,
                    patient_name: updatedCall.patient_name,
                  }, ...prev];
                }
              });
            }
            
            // Update selected call if it's the one being updated
            if (selectedCall?.id === updatedCall.id) {
              setSelectedCall(updatedCall);
            }
          }
        }
      )
      .subscribe();

    // Load existing calls with transcript
    supabase
      .from("calls")
      .select("id, call_id, started_at, patient_name, last_intent, last_summary, schedule, status, transcript")
      .eq("business_id", business.id)
      .order("started_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          const callsData = data as Call[];
          setCalls(callsData);
          setBookings(callsData.filter(c => c.schedule).map(c => ({
            id: c.id,
            schedule: c.schedule,
            started_at: c.started_at,
            patient_name: c.patient_name,
          })));
          // Auto-select the most recent call if available
          if (callsData.length > 0 && !selectedCall) {
            setSelectedCall(callsData[0]);
          }
        }
      });

    // Subscribe to call_turns for live transcripts
    const turnsChannel = supabase
      .channel(`demo-turns-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_turns" as any,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const turn = payload.new as any;
            // Find the call this turn belongs to
            const { data: callData } = await supabase
              .from("calls")
              .select("call_id")
              .eq("call_id", turn.call_id)
              .single();
            
            if (callData && selectedCall?.call_id === turn.call_id && turn.transcript_json) {
              // Update transcript for selected call
              const messages = parseTranscriptJson(turn.transcript_json);
              setTranscriptMessages(messages);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(turnsChannel);
    };

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBookingTime = (schedule: any) => {
    if (!schedule || !schedule.date || !schedule.time) return "N/A";
    return `${schedule.date} at ${schedule.time}`;
  };

  // Parse transcript JSON similar to calls page
  function parseTranscriptJson(transcriptJson: any): Message[] {
    if (!transcriptJson) return [];
    
    if (Array.isArray(transcriptJson)) {
      return transcriptJson
        .filter((msg: any) => msg && (msg.role || msg.speaker))
        .map((msg: any) => {
          const role = (msg.role || msg.speaker || "").toLowerCase();
          const text = msg.text || msg.content || msg.message || "";
          return {
            role: role.includes("user") || role.includes("caller") ? "user" : "bot",
            text: text,
          };
        });
    }
    
    if (transcriptJson.messages && Array.isArray(transcriptJson.messages)) {
      return transcriptJson.messages.map((msg: any) => ({
        role: (msg.role || "").toLowerCase().includes("user") ? "user" : "bot",
        text: msg.text || msg.content || msg.message || "",
      }));
    }
    
    return [];
  }

  // Parse string transcript
  function parseTranscript(transcript: string): Message[] {
    if (!transcript) return [];
    
    const messages: Message[] = [];
    const lines = transcript.split("\n").filter(line => line.trim());
    
    let currentRole: "user" | "bot" | null = null;
    let currentText = "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      const userPatterns = [/^(user|caller|patient|client):\s*/i, /^\[user\]/i];
      const botPatterns = [/^(bot|ai|assistant|agent):\s*/i, /^\[bot\]/i, /^\[ai\]/i];
      
      const isUser = userPatterns.some(pattern => pattern.test(trimmed));
      const isBot = botPatterns.some(pattern => pattern.test(trimmed));
      
      if (isUser || isBot) {
        if (currentRole && currentText.trim()) {
          messages.push({ role: currentRole, text: currentText.trim() });
        }
        currentRole = isUser ? "user" : "bot";
        currentText = trimmed.replace(/^(user|caller|patient|client|bot|ai|assistant|agent):\s*/i, "").trim();
      } else if (currentRole) {
        currentText += (currentText ? " " : "") + trimmed;
      }
    }
    
    if (currentRole && currentText.trim()) {
      messages.push({ role: currentRole, text: currentText.trim() });
    }
    
    return messages;
  }

  // Load transcript for selected call
  useEffect(() => {
    if (!selectedCall || !selectedCall.call_id) {
      setTranscriptMessages([]);
      return;
    }

    const callId = selectedCall.call_id;

    async function loadTranscript() {
      const supabase = getSupabaseClient();
      
      // Try to get transcript from call_turns first
      const { data: turn } = await (supabase as any)
        .from("call_turns")
        .select("transcript_json")
        .eq("call_id", callId)
        .order("total_turns", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (turn?.transcript_json) {
        const messages = parseTranscriptJson(turn.transcript_json);
        setTranscriptMessages(messages);
      } else if (selectedCall?.transcript) {
        const messages = parseTranscript(selectedCall.transcript);
        setTranscriptMessages(messages);
      } else {
        setTranscriptMessages([]);
      }
    }

    loadTranscript();
    
    // Poll for updates
    const interval = setInterval(loadTranscript, 2000);
    return () => clearInterval(interval);
  }, [selectedCall]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptMessages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/demo/${sessionToken}/configure`)}
              className="p-2 rounded-lg border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-2">{business?.name || "Your Business"}</h1>
              <p className="text-white/60">Live Demo Experience</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <Clock className="h-5 w-5 text-red-400" />
            <span className="text-xl font-bold">{formatTime(remainingSeconds)}</span>
          </div>
        </div>

        {/* Demo Phone Number */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 rounded-xl bg-black border border-yellow-500/30"
        >
          <div className="flex items-center gap-4">
            <Phone className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-white/60 mb-1">Call This Number</p>
              <p className="text-3xl font-bold">+1 (215) 986 2752</p>
              <p className="text-sm text-white/60 mt-1">Experience your AI receptionist live</p>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Transcript */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-bold">Live Transcript</h2>
            </div>
            <div className="p-4 rounded-xl bg-black border border-white/10 h-[600px] overflow-y-auto">
              {selectedCall ? (
                transcriptMessages.length > 0 ? (
                  <div className="space-y-4">
                    {transcriptMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.role === "user"
                              ? "bg-yellow-500/20 border border-yellow-500/30"
                              : "bg-white/5 border border-white/10"
                          }`}
                        >
                          <p className="text-sm text-white/80">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-white/60">Waiting for transcript...</p>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white/60">Select a call to view transcript</p>
                </div>
              )}
            </div>
          </div>

          {/* Call Log & Bookings */}
          <div className="space-y-6">
            {/* Call Log */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-bold">Call Log</h2>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {calls.length === 0 ? (
                  <div className="p-6 rounded-xl bg-black border border-white/10 text-center">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-white/40" />
                    <p className="text-sm text-white/60">No calls yet. Call the demo number to get started!</p>
                  </div>
                ) : (
                  calls.map((call) => (
                    <motion.div
                      key={call.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedCall(call)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedCall?.id === call.id
                          ? "bg-yellow-500/20 border-yellow-500/30"
                          : "bg-black border-white/10 hover:border-yellow-500/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{call.patient_name || "Anonymous"}</span>
                        <span className="text-xs text-white/60">
                          {new Date(call.started_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {call.last_intent && (
                        <p className="text-xs text-white/70 mb-1">
                          <span className="text-white/50">Intent: </span>
                          {call.last_intent}
                        </p>
                      )}
                      {call.last_summary && (
                        <p className="text-xs text-white/60 line-clamp-2">
                          {call.last_summary}
                        </p>
                      )}
                      {call.schedule && (
                        <div className="mt-2 p-1.5 rounded bg-green-500/20 border border-green-500/30 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span className="text-xs">Booked</span>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Bookings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-bold">Bookings</h2>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {bookings.length === 0 ? (
                  <div className="p-6 rounded-xl bg-black border border-white/10 text-center">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-white/40" />
                    <p className="text-sm text-white/60">No bookings yet. Call the number to make an appointment!</p>
                  </div>
                ) : (
                  bookings.map((booking) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 rounded-xl bg-black border border-green-500/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{booking.patient_name || "Anonymous"}</span>
                        <span className="text-xs text-white/60">
                          {new Date(booking.started_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-white/80">
                        {formatBookingTime(booking.schedule)}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

