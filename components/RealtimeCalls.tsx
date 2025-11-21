"use client";

import { useEffect, useMemo, useState, memo } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { BadgeCheck, PhoneIncoming, PhoneOff, ChevronRight, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CallDetailsModal from "./CallDetailsModal";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useProgram } from "@/components/ProgramProvider";
import { useUserRole } from "@/lib/useUserRole";
import { AnonymizationToggle, applyAnonymization } from "./AnonymizationToggle";

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
  program_id?: string | null;
};

type Props = {
  businessId?: string;
  readOnly?: boolean;
};

function RealtimeCalls({ businessId, readOnly = false }: Props) {
  const { accentColor } = useAccentColor();
  const { programId } = useProgram();
  const { role: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsByProgram, setCallsByProgram] = useState<Record<string, Call[]>>({});
  const [programs, setPrograms] = useState<Array<{ id: string; name: string | null }>>([]);
  const [hasLoadedPrograms, setHasLoadedPrograms] = useState(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [userProgramId, setUserProgramId] = useState<string | null>(null);
  const NO_PROGRAM_KEY = "__NO_PROGRAM__";

  // Get business_id from props or sessionStorage for multi-tenant
  const effectiveBusinessId = useMemo(() => {
    if (businessId) return businessId;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("business_id") || undefined;
    }
    return undefined;
  }, [businessId]);

  useEffect(() => {
    if (!isAdmin) {
      setPrograms([]);
      setCallsByProgram({});
      setHasLoadedPrograms(false);
    } else {
      setHasLoadedPrograms(false);
    }
  }, [isAdmin, effectiveBusinessId]);

  // Get user's program_id if they have one assigned (for non-admins)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    async function loadUserProgramId() {
      if (isAdmin) {
        // Admins don't have assigned program_id, they can see all programs
        setUserProgramId(null);
        return;
      }
      
      const authUserId = (await supabase.auth.getUser()).data.user?.id;
      if (authUserId) {
        const { data: userData } = await supabase
          .from("users")
          .select("program_id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        
        if (userData && (userData as any).program_id) {
          setUserProgramId((userData as any).program_id);
        }
      }
    }
    
    loadUserProgramId();
  }, [supabase, isAdmin]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function loadInitial() {
      // Always filter by business_id if available
      if (!effectiveBusinessId) {
        console.warn("⚠️ No business_id found, cannot load calls");
        setCalls([]);
        setCallsByProgram({});
        return;
      }

      console.log("🔄 Loading calls for business_id:", effectiveBusinessId);

      // Determine which program_id to filter by:
      // - If user has assigned program_id (non-admin), use that
      // - Otherwise, if program is selected, use that
      // - Admins without selected program see all calls
      const filterProgramId = !isAdmin ? (userProgramId || programId) : null;
      
      const callsQuery = supabase
        .from("calls")
        .select("id,business_id,call_id,patient_id,status,phone,email,patient_name,last_summary,last_intent,success,started_at,ended_at,transcript,escalate,upsell,schedule,context,total_turns,program_id")
        .eq("business_id", effectiveBusinessId);
      
      // Note: program_id filtering is handled at the database level via RLS or will be added later
      // For now, we filter client-side if needed
      const { data, error } = await callsQuery
        .order("started_at", { ascending: false })
        .limit(100); // Get more calls to filter client-side

      if (!isMounted) return;
      if (error) {
        console.error("❌ Initial load error", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Business ID used:", effectiveBusinessId);
        console.error("Query attempted:", effectiveBusinessId ? `business_id = ${effectiveBusinessId}` : "all calls");
        return;
      }
      
      // Filter by program_id client-side if needed
      let filteredData = data || [];
      if (filterProgramId) {
        filteredData = filteredData.filter((c: any) => c.program_id === filterProgramId);
      }

      if (isAdmin) {
        if (!hasLoadedPrograms) {
          const { data: programRows, error: programError } = await (supabase as any)
            .from("programs")
            .select("id,name")
            .eq("business_id", effectiveBusinessId)
            .order("name", { ascending: true });

          if (!isMounted) return;

          if (programError) {
            console.warn("⚠️ Failed to load programs:", programError);
          } else if (programRows) {
            const programGroups = (programRows as Array<{ id: string; name: string | null }>).map(
              (row) => ({ id: row.id, name: row.name })
            );
            setPrograms(programGroups);
            setHasLoadedPrograms(true);
          }
        }

        const grouped: Record<string, Call[]> = {};
        filteredData.forEach((call: any) => {
          const programKey = call.program_id || NO_PROGRAM_KEY;
          if (!grouped[programKey]) {
            grouped[programKey] = [];
          }
          if (grouped[programKey].length < 5) {
            grouped[programKey].push(call as Call);
          }
        });

        setCalls([]);
        setCallsByProgram(grouped);

        const totalLoaded = Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0);
        console.log(
          "✅ Loaded admin calls:",
          totalLoaded,
          "across",
          Object.keys(grouped).length,
          "program groups"
        );
      } else {
        // Take only the last 5 calls
        filteredData = filteredData.slice(0, 5);
        
        console.log("✅ Loaded calls:", filteredData.length, "Business ID:", effectiveBusinessId);
        if (filteredData.length > 0) {
          console.log("Sample call:", filteredData[0]);
        } else {
          console.warn("⚠️ No calls found. Check:");
          console.warn("1. Do you have calls in the database?");
          console.warn("2. Is RLS blocking the query?");
          console.warn("3. Does business_id match?", effectiveBusinessId);
        }
        // Show last 5 calls regardless of status
        setCalls((filteredData || []) as any as Call[]);
        setCallsByProgram({});
      }
    }

    loadInitial();

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (effectiveBusinessId) {
      // Determine which program_id to filter by for realtime updates
      const filterProgramId = userProgramId || programId;
      
      const channel = supabase
        .channel(`business:CALLS:${effectiveBusinessId}`, { config: { private: true } })
        .on("broadcast", { event: "changes" }, (payload) => {
          console.log("Broadcast received:", payload);
          const eventData = payload.payload;
          if (!eventData) return;

          let callData: Call | null = null;
          let eventType = "UPDATE";
          
          // Filter by program_id if needed
          if (filterProgramId && eventData.data && (eventData.data as any).program_id !== filterProgramId) {
            return; // Skip this update if it's not for the user's program
          }

          if (eventData.data) {
            callData = eventData.data as Call;
            eventType = eventData.eventType || eventData.operation || "UPDATE";
          } else if (eventData.new) {
            callData = eventData.new as Call;
            eventType = "INSERT";
          } else if (eventData.old) {
            callData = eventData.old as Call;
            eventType = "DELETE";
          } else {
            callData = eventData as Call;
          }

          if (!callData) return;

                if (eventType === "INSERT" || eventType === "insert") {
                  // Refresh last 5 calls
                  loadInitial();
                } else if (eventType === "UPDATE" || eventType === "update") {
                  // Refresh last 5 calls
                  loadInitial();
                } else if (eventType === "DELETE" || eventType === "delete") {
                  setCalls((prev) => prev.filter((c) => c.id !== callData!.id));
                }
        })
        .subscribe((status) => {
          // Only log status changes, not every status update
          if (status === "SUBSCRIBED") {
            console.log("✅ Channel subscription active");
          } else if (status === "CLOSED" && isMounted) {
            // Only log if we're still mounted (unexpected close)
            console.warn("⚠️ Channel closed unexpectedly");
          }
          setConnected(status === "SUBSCRIBED");
        });
      channels.push(channel);
    } else {
      const channel = supabase
        .channel("realtime:calls")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
          },
          (payload) => {
            const newCall = payload.new as Call;
            // Refresh last 5 calls
            loadInitial();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
          },
          (payload) => {
            const updatedCall = payload.new as Call;
            // Refresh last 5 calls
            loadInitial();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "calls",
          },
          (payload) => {
            setCalls((prev) => prev.filter((c) => c.id !== (payload.old as Call).id));
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("✅ Realtime calls channel active");
          }
          setConnected(status === "SUBSCRIBED");
        });
      channels.push(channel);
    }

    // Set connected to true after a short delay if subscription succeeds
    // This prevents "Connecting..." from showing indefinitely
    const timeout = setTimeout(() => {
      if (isMounted && channels.length > 0) {
        setConnected(true);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, effectiveBusinessId, userProgramId, programId, isAdmin, hasLoadedPrograms]);

  function handleCallClick(call: Call) {
    setSelectedCall(call);
    setIsModalOpen(true);
  }

  // Apply anonymization to calls for display
  const displayCalls = useMemo(() => {
    if (!isAnonymized) return calls;
    return calls.map(call => applyAnonymization(call, true) as Call);
  }, [calls, isAnonymized]);

  return (
    <>
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/60">
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
          <div className="flex items-center gap-3">
            <AnonymizationToggle onToggle={setIsAnonymized} />
            <span className="beta-badge">Beta</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {isAdmin ? (
              (() => {
                const orderedPrograms = [
                  ...programs,
                  { id: NO_PROGRAM_KEY, name: "Business Calls" },
                ];
                const hasAnyCalls = orderedPrograms.some((program) => {
                  const key = program.id ?? NO_PROGRAM_KEY;
                  return (callsByProgram[key] ?? []).length > 0;
                });

                if (!hasAnyCalls) {
                  return (
                    <motion.div
                      key="empty-state-admin"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="col-span-full p-12 text-center text-white/40 rounded-2xl bg-black border border-white/10"
                    >
                      No calls yet.
                    </motion.div>
                  );
                }

                return orderedPrograms.map((program) => {
                  const key = program.id ?? NO_PROGRAM_KEY;
                  const programCalls = callsByProgram[key] ?? [];
                  if (programCalls.length === 0) {
                    return null;
                  }

                  const label =
                    program.id === NO_PROGRAM_KEY
                      ? "Business Calls"
                      : program.name || "Program";

                  return (
                    <div key={key} className="col-span-full space-y-3">
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <Building2 className="h-4 w-4 text-white/40" />
                        <span className="font-semibold text-white/80">{label}</span>
                        <span className="text-white/40">
                          ({programCalls.length} live)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {programCalls.map((c, index) => (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{
                              delay: index * 0.05,
                              type: "spring",
                              stiffness: 300,
                              damping: 25,
                            }}
                            whileHover={{ scale: 1.01, y: -2 }}
                            onClick={() => handleCallClick(c)}
                            className="group cursor-pointer p-5 rounded-2xl bg-black border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/10"
                            style={{
                              borderColor: "rgba(255, 255, 255, 0.1)",
                              transition: "border-color 0.2s ease, background-color 0.2s ease",
                            }}
                            onHoverStart={(e) => {
                              const target = e.currentTarget as HTMLElement;
                              if (target) {
                                target.style.borderColor = `${accentColor}80`;
                              }
                            }}
                            onHoverEnd={(e) => {
                              const target = e.currentTarget as HTMLElement;
                              if (target) {
                                target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                              }
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {c.status === "active" ? (
                                  <div
                                    className="p-2 rounded-xl border"
                                    style={{
                                      backgroundColor: `${accentColor}33`,
                                      borderColor: `${accentColor}4D`,
                                    }}
                                  >
                                    <PhoneIncoming className="h-5 w-5" style={{ color: accentColor }} />
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-xl bg-black border border-white/10">
                                    <PhoneOff className="h-5 w-5 text-white/60" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-semibold truncate">
                                    {c.patient_name ?? "Unknown"}
                                  </div>
                                  {c.phone && (
                                    <div className="text-white/60 text-sm truncate">{c.phone}</div>
                                  )}
                                </div>
                              </div>
                              <ChevronRight 
                                className="h-5 w-5 text-white/40 transition-colors flex-shrink-0" 
                                style={{ color: "rgba(255, 255, 255, 0.4)" }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = accentColor;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
                                }}
                              />
                            </div>

                            {c.last_intent && (
                              <div className="mb-3">
                                <span 
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                                  style={{
                                    backgroundColor: `${accentColor}33`,
                                    color: accentColor,
                                    borderColor: `${accentColor}4D`,
                                  }}
                                >
                                  {c.last_intent}
                                </span>
                              </div>
                            )}

                            {c.last_summary && (
                              <p className="text-white/70 text-sm line-clamp-2 mb-3">
                                {c.last_summary}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-xs text-white/50">
                              <span>{format(new Date(c.started_at), "MMM d, h:mm a")}</span>
                              <div className="flex items-center gap-2">
                                {(c.success !== null || c.schedule) && (
                                  <span className={(c.success === true || c.schedule) ? "text-emerald-400" : "text-red-400"}>
                                    {(c.success === true || c.schedule) ? "✓" : "✗"}
                                  </span>
                                )}
                                {c.escalate && (
                                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs border border-red-500/30">
                                    Escalated
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <>
                {calls.length === 0 && (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="col-span-full p-12 text-center text-white/40 rounded-2xl bg-white/5 border border-white/10"
                  >
                    No calls yet.
                  </motion.div>
                )}
                {displayCalls.map((c, index) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ 
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 300,
                      damping: 25
                    }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    onClick={() => handleCallClick(c)}
                    className="group cursor-pointer p-5 rounded-2xl glass border border-white/10 hover:bg-white/10"
                    style={{
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      transition: "border-color 0.2s ease, background-color 0.2s ease",
                    }}
                    onHoverStart={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      if (target) {
                        target.style.borderColor = `${accentColor}80`;
                      }
                    }}
                    onHoverEnd={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      if (target) {
                        target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {c.status === "active" ? (
                          <div 
                            className="p-2 rounded-xl border"
                            style={{
                              backgroundColor: `${accentColor}33`,
                              borderColor: `${accentColor}4D`,
                            }}
                          >
                            <PhoneIncoming className="h-5 w-5" style={{ color: accentColor }} />
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-white/10">
                            <PhoneOff className="h-5 w-5 text-white/60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold truncate">
                            {c.patient_name ?? "Unknown"}
                          </div>
                          {c.phone && (
                            <div className="text-white/60 text-sm truncate">{c.phone}</div>
                          )}
                        </div>
                      </div>
                      <ChevronRight 
                        className="h-5 w-5 text-white/40 transition-colors flex-shrink-0" 
                        style={{ color: "rgba(255, 255, 255, 0.4)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = accentColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
                        }}
                      />
                    </div>

                    {c.last_intent && (
                      <div className="mb-3">
                        <span 
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                          style={{
                            backgroundColor: `${accentColor}33`,
                            color: accentColor,
                            borderColor: `${accentColor}4D`,
                          }}
                        >
                          {c.last_intent}
                        </span>
                      </div>
                    )}

                    {c.last_summary && (
                      <p className="text-white/70 text-sm line-clamp-2 mb-3">
                        {c.last_summary}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>{format(new Date(c.started_at), "MMM d, h:mm a")}</span>
                      <div className="flex items-center gap-2">
                        {(c.success !== null || c.schedule) && (
                          <span className={(c.success === true || c.schedule) ? "text-emerald-400" : "text-red-400"}>
                            {(c.success === true || c.schedule) ? "✓" : "✗"}
                          </span>
                        )}
                        {c.escalate && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs border border-red-500/30">
                            Escalated
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <CallDetailsModal
        call={selectedCall}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCall(null);
        }}
        readOnly={readOnly}
      />
    </>
  );
}

export default memo(RealtimeCalls);


