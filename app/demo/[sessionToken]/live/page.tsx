"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Phone, Clock, Calendar, MessageSquare, Loader2, ArrowLeft, FileText, CheckCircle, X, Bot, UserCircle, Users, Info } from "lucide-react";
import CallDetailsModal from "@/components/CallDetailsModal";
import { format } from "date-fns";

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
  ended_at: string | null;
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
  const [showCallDetails, setShowCallDetails] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"calls" | "patients">("calls");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Find active/live call
  const liveCall = calls.find(call => 
    call.status === "in-progress" || 
    call.status === "in_progress" || 
    call.status === "active" ||
    (!call.ended_at && call.status !== "ended" && call.status !== "completed")
  );

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

  // Load patients - always use demo business ID
  useEffect(() => {
    const DEMO_BUSINESS_ID = "eea1f8b5-f4ed-4141-85c7-c381643ce9df";
    const supabase = getSupabaseClient();
    
    async function loadPatients() {
      try {
        console.log("🔍 Loading patients for demo business:", DEMO_BUSINESS_ID);
        const { data: patientsData, error: patientsError } = await (supabase as any)
          .from("patients")
          .select("*")
          .eq("business_id", DEMO_BUSINESS_ID)
          .order("last_call_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(5);

        if (patientsError) {
          console.error("❌ Error loading patients:", patientsError);
          setPatients([]);
          return;
        }

        console.log("✅ Loaded patients:", patientsData?.length || 0, patientsData);
        setPatients(patientsData || []);
      } catch (error) {
        console.error("❌ Exception loading patients:", error);
        setPatients([]);
      }
    }

    loadPatients();
    
    // Subscribe to patient updates
    const patientsChannel = supabase
      .channel(`demo-patients-${DEMO_BUSINESS_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
          filter: `business_id=eq.${DEMO_BUSINESS_ID}`,
        },
        () => {
          loadPatients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(patientsChannel);
    };
  }, []);

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
      .select("id, call_id, started_at, patient_name, last_intent, last_summary, schedule, status, transcript, ended_at")
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

  // Load transcript for live call or selected call
  useEffect(() => {
    const callToLoad = liveCall || selectedCall;
    if (!callToLoad || !callToLoad.call_id) {
      setTranscriptMessages([]);
      return;
    }

    const callId = callToLoad.call_id;

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
      } else if (callToLoad?.transcript) {
        const messages = parseTranscript(callToLoad.transcript);
        setTranscriptMessages(messages);
      } else {
        setTranscriptMessages([]);
      }
    }

    loadTranscript();
    
    // Poll for updates more frequently if it's a live call
    const pollInterval = liveCall ? 1000 : 2000;
    const interval = setInterval(loadTranscript, pollInterval);
    return () => clearInterval(interval);
  }, [liveCall, selectedCall]);

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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/signup?founder=true")}
              className="px-4 py-2 rounded-lg bg-black border border-white/10 hover:border-white/20 transition-colors text-sm font-medium"
            >
              Leave Demo
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
              <Clock className="h-5 w-5 text-red-400" />
              <span className="text-xl font-bold">{formatTime(remainingSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Demo Phone Number */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 rounded-xl bg-black border border-yellow-500/30"
        >
          <div className="flex items-start gap-4">
            <Phone className="h-8 w-8 text-yellow-500 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-white/60 mb-1">Call This Number</p>
              <p className="text-3xl font-bold mb-2">+1 (215) 986 2752</p>
              <p className="text-sm text-white/60 mb-3">Experience your AI receptionist live</p>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400 font-medium mb-1">💡 Pro Tip: Call Multiple Times</p>
                <p className="text-xs text-white/70">
                  Call again with the same number to see how the AI remembers your patient context, 
                  preferences, and history. This is what your customers will experience!
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab("calls")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "calls"
                ? "text-yellow-500 border-b-2 border-yellow-500"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            <MessageSquare className="h-4 w-4 inline-block mr-2" />
            Call Log
          </button>
          <button
            onClick={() => setActiveTab("patients")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "patients"
                ? "text-yellow-500 border-b-2 border-yellow-500"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            <Users className="h-4 w-4 inline-block mr-2" />
            Patients
          </button>
        </div>

        {/* Main Content Grid */}
        {activeTab === "calls" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Call Log - Main Focus */}
            <div className="lg:col-span-2 space-y-6">
              {/* Call Log */}
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-yellow-500" />
                      <h2 className="text-xl font-bold">Call Log</h2>
                      {liveCall && (
                        <motion.div
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                          <span className="text-xs font-medium text-yellow-500">Live</span>
                        </motion.div>
                      )}
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <Info className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-white/60">
                        This is your call log in the real dashboard. Every call is automatically logged with 
                        patient information, intent detection, and AI-generated summaries. Click any call to see full details.
                      </p>
                    </div>
                  </div>
                </div>
              <div className="space-y-3">
                {calls.length === 0 ? (
                  <div className="p-8 rounded-xl bg-black border border-white/10 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-white/40" />
                    <p className="text-white/60">No calls yet. Call the demo number to get started!</p>
                  </div>
                ) : (
                  calls.map((call) => {
                    const isLive = call.id === liveCall?.id;
                    const isSelected = selectedCall?.id === call.id;
                    return (
                      <motion.div
                        key={call.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => {
                          setSelectedCall(call);
                          setShowCallDetails(true);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isLive
                            ? "bg-yellow-500/10 border-yellow-500/30 ring-2 ring-yellow-500/20"
                            : isSelected
                            ? "bg-yellow-500/20 border-yellow-500/30"
                            : "bg-black border-white/10 hover:border-yellow-500/20 hover:bg-yellow-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white">
                                {call.patient_name || "Anonymous"}
                              </span>
                              {isLive && (
                                <motion.span
                                  animate={{ opacity: [0.6, 1, 0.6] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                  className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-500"
                                >
                                  Live
                                </motion.span>
                              )}
                            </div>
                            <p className="text-xs text-white/60 mb-2">
                              {new Date(call.started_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {call.last_intent && (
                          <div className="mb-2">
                            <span className="text-xs text-white/50">Intent: </span>
                            <span className="text-sm text-white/80 font-medium">{call.last_intent}</span>
                          </div>
                        )}
                        {call.last_summary && (
                          <p className="text-sm text-white/70 line-clamp-2 mb-2">
                            {call.last_summary}
                          </p>
                        )}
                        {call.schedule && (
                          <div className="mt-2 p-2 rounded bg-green-500/20 border border-green-500/30 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-green-400" />
                            <span className="text-xs text-green-400">Appointment Booked</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live Transcript - Only show when there's a live call */}
            {liveCall && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-xl bg-black border border-yellow-500/30"
              >
                <div className="flex items-start gap-2 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-yellow-500" />
                      <h2 className="text-xl font-bold">Live Transcript</h2>
                      <motion.div
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        <span className="text-xs font-medium text-yellow-500">Live</span>
                      </motion.div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <Info className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-white/60">
                        Watch conversations happen in real-time. Transcripts update automatically as the AI 
                        and caller speak. This helps you monitor quality and review interactions.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-black/50 border border-white/10 h-[400px] overflow-y-auto">
                  {transcriptMessages.length > 0 ? (
                    <div className="space-y-3">
                      {transcriptMessages.map((msg, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.role === "user"
                                ? "bg-blue-500/20 border border-blue-500/30"
                                : "bg-yellow-500/20 border border-yellow-500/30"
                            }`}
                          >
                            <p className="text-sm text-white/90">{msg.text}</p>
                          </div>
                        </motion.div>
                      ))}
                      <div ref={transcriptEndRef} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-white/60">Waiting for transcript...</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Bookings Sidebar */}
          <div className="space-y-6">
            {/* Feature Highlights */}
            <div className="p-4 rounded-xl bg-black border border-yellow-500/20">
              <h3 className="text-sm font-semibold text-yellow-500 mb-3">What You're Getting</h3>
              <div className="space-y-3 text-xs text-white/70">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Real-time call transcripts</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Automatic appointment booking</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>AI insights & summaries</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>24/7 availability</span>
                </div>
              </div>
            </div>

            {/* Bookings */}
            <div>
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-yellow-500" />
                    <h2 className="text-xl font-bold">Bookings</h2>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <Info className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-white/60">
                      Appointments booked during calls appear here automatically. In your real dashboard, 
                      these sync with your calendar system.
                    </p>
                  </div>
                </div>
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
        ) : (
          /* Patients Tab */
          <div className="space-y-6">
            <div className="flex items-start gap-2 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-xl font-bold">Recent Patients</h2>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Info className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-white/60">
                    Your patient database grows automatically with each call. The AI remembers patient history, 
                    preferences, and past treatments. Call multiple times with the same number to see patient context build up!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {patients.length === 0 ? (
                <div className="col-span-full p-8 rounded-xl bg-black border border-white/10 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <p className="text-white/60 mb-2">No patients yet</p>
                  <p className="text-sm text-white/40">Call the demo number to create your first patient record!</p>
                </div>
              ) : (
                patients.map((patient) => (
                  <motion.div
                    key={patient.patient_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-opacity-30 transition-all hover:bg-white/10"
                    style={{ borderColor: `rgba(234, 179, 8, 0.2)` }}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                        style={{
                          backgroundColor: `rgba(234, 179, 8, 0.2)`,
                          color: "#eab308",
                        }}
                      >
                        {patient.patient_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">
                          {patient.patient_name || "Unknown Patient"}
                        </h3>
                        {patient.phone && (
                          <p className="text-xs text-white/60 mt-1">{patient.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {patient.last_call_date && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-white/40" />
                          <span className="text-white/60 text-xs">
                            Last call: {format(new Date(patient.last_call_date), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      )}
                      {patient.last_treatment && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-white/40" />
                          <span className="text-white/60 text-xs">Last: {patient.last_treatment}</span>
                        </div>
                      )}
                      {patient.last_intent && (
                        <div className="mt-2 p-2 rounded bg-white/5">
                          <span className="text-xs text-white/50">Intent: </span>
                          <span className="text-xs text-white/80">{patient.last_intent}</span>
                        </div>
                      )}
                      {patient.total_visits !== null && patient.total_visits !== undefined && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <span className="text-xs text-white/50">Total Visits: </span>
                          <span className="text-xs text-white/80 font-semibold">{patient.total_visits}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Call Details Modal */}
      {showCallDetails && selectedCall && (
        <CallDetailsModal
          call={selectedCall as any}
          isOpen={showCallDetails}
          onClose={() => {
            setShowCallDetails(false);
            setSelectedCall(null);
          }}
        />
      )}
    </div>
  );
}

