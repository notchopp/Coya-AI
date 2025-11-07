"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Search, Filter, Download, X, Calendar, CheckCircle, XCircle, ChevronRight, Phone, Mail, Clock, User, FileText, Target, Bot, UserCircle } from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import CallDetailsModal from "@/components/CallDetailsModal";


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
};

type Message = {
  role: "user" | "bot";
  text: string;
};

type FilterState = {
  status: string | null;
  success: boolean | null;
  intent: string | null;
  dateRange: { from: Date | null; to: Date | null } | null;
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

export default function LogsPage() {
  const { accentColor } = useAccentColor();
  const searchParams = useSearchParams();
  const callIdParam = searchParams.get("callId");
  const callCardRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<Call[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [filters, setFilters] = useState<FilterState>({
    status: null,
    success: null,
    intent: null,
    dateRange: null,
  });
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll to specific call when callId param is present
  useEffect(() => {
    if (callIdParam && callCardRef.current && logs.length > 0) {
      // Expand the card if it's not already expanded
      setExpandedCards(prev => new Set([...prev, callIdParam]));
      
      // Scroll to the card after a short delay
      setTimeout(() => {
        callCardRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });
      }, 500);
    }
  }, [callIdParam, logs]);

  useEffect(() => {
    if (!mounted) return;

    async function loadLogs() {
      const supabase = getSupabaseClient();
      
      // Get business_id from sessionStorage
      const businessId = sessionStorage.getItem("business_id");
      
      if (!businessId) {
        console.error("⚠️ No business_id found in sessionStorage");
        setLoading(false);
        return;
      }

      console.log("🔄 Loading logs for business_id:", businessId);

      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .eq("business_id", businessId!)
        .order("started_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("❌ Error loading logs:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        setLoading(false);
        return;
      }

      console.log("✅ Loaded logs:", data?.length || 0);

      setLogs(data ?? []);
      setLoading(false);
    }

    loadLogs();
  }, [mounted]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Apply search filter
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (log) =>
          log.phone?.toLowerCase().includes(lowerSearch) ||
          log.email?.toLowerCase().includes(lowerSearch) ||
          log.patient_name?.toLowerCase().includes(lowerSearch) ||
          log.last_summary?.toLowerCase().includes(lowerSearch) ||
          log.last_intent?.toLowerCase().includes(lowerSearch) ||
          log.transcript?.toLowerCase().includes(lowerSearch)
      );
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter((log) => log.status === filters.status);
    }

    // Apply success filter
    if (filters.success !== null) {
      result = result.filter((log) => log.success === filters.success);
    }

    // Apply intent filter (case-insensitive matching)
    if (filters.intent) {
      const intentLower = filters.intent.toLowerCase();
      result = result.filter((log) => {
        if (!log.last_intent) return false;
        const logIntentLower = log.last_intent.toLowerCase();
        
        // Handle "Booking" filter - match booking, schedule, appointment related intents
        if (intentLower === "booking") {
          return logIntentLower.includes("booking") || 
                 logIntentLower.includes("schedule") || 
                 logIntentLower.includes("appointment");
        }
        
        // Handle "FAQs" filter - match faq, question, inquiry related intents
        if (intentLower === "faqs") {
          return logIntentLower.includes("faq") || 
                 logIntentLower.includes("question") || 
                 logIntentLower.includes("inquiry") ||
                 logIntentLower.includes("info");
        }
        
        // Exact match for other intents
        return logIntentLower.includes(intentLower);
      });
    }

    // Apply date range filter
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      const { from: start, to: end } = filters.dateRange;
      result = result.filter((log) => {
        const logDate = new Date(log.started_at);
        const startDate = new Date(start);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        return logDate >= startDate && logDate <= endDate;
      });
    }

    return result;
  }, [logs, search, filters]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  function handleCardClick(call: Call) {
    setSelectedCall(call);
    setIsModalOpen(true);
  }

  function exportToCSV() {
    if (filteredLogs.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Time",
      "Patient Name",
      "Phone",
      "Email",
      "Status",
      "Success",
      "Intent",
      "Summary",
    ];

    const rows = filteredLogs.map((log) => [
      format(new Date(log.started_at), "yyyy-MM-dd HH:mm:ss"),
      log.patient_name || "",
      log.phone || "",
      log.email || "",
      log.status || "",
      log.success ? "Yes" : log.success === false ? "No" : "",
      log.last_intent || "",
      (log.last_summary || "").replace(/,/g, ";"), // Replace commas in summary
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `call-logs-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function clearFilters() {
    setFilters({
      status: null,
      success: null,
      intent: null,
      dateRange: null,
    });
  }

  const hasActiveFilters = filters.status !== null || filters.success !== null || filters.intent !== null || filters.dateRange !== null;

  return (
    <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white">Call Logs</h1>
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

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
          <input
            type="text"
            placeholder="Search calls by number, summary, or transcript..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl glass border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = `${accentColor}80`;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilter(!showFilter)}
            aria-label={showFilter ? "Close filters" : "Open filters"}
            aria-expanded={showFilter}
            className={`px-4 py-3 rounded-xl glass border transition-colors flex items-center gap-2 text-white ${
              hasActiveFilters
                ? "border"
                : "border-white/10 hover:bg-white/10"
            }`}
            style={hasActiveFilters ? {
              borderColor: `${accentColor}80`,
              backgroundColor: `${accentColor}1A`,
            } : {}}
          >
            <Filter className="h-4 w-4" />
            Filter
            {hasActiveFilters && (
              <span 
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: `${accentColor}33`,
                  color: accentColor,
                }}
              >
                {[filters.status, filters.success !== null, filters.intent, filters.dateRange].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Filter Dropdown */}
          <AnimatePresence>
            {showFilter && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-80 p-4 rounded-xl glass-strong border border-white/10 z-50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Filters</h3>
                  <button
                    onClick={() => setShowFilter(false)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="h-4 w-4 text-white/60" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Status
                    </label>
                    <select
                      value={filters.status || ""}
                      onChange={(e) =>
                        setFilters({ ...filters, status: e.target.value || null })
                      }
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all text-sm"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}80`;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="ended">Ended</option>
                    </select>
                  </div>

                  {/* Success Filter */}
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Success
                    </label>
                    <select
                      value={filters.success === null ? "" : filters.success ? "true" : "false"}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          success: e.target.value === "" ? null : e.target.value === "true",
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all text-sm"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}80`;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="">All</option>
                      <option value="true">Success</option>
                      <option value="false">Failed</option>
                    </select>
                  </div>

                  {/* Intent Filter */}
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Intent
                    </label>
                    <select
                      value={filters.intent || ""}
                      onChange={(e) =>
                        setFilters({ ...filters, intent: e.target.value || null })
                      }
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all text-sm"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}80`;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="">All</option>
                      <option value="Booking">Booking</option>
                      <option value="FAQs">FAQs</option>
                    </select>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">
                      Date Range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={filters.dateRange?.from ? format(filters.dateRange.from, "yyyy-MM-dd") : ""}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            dateRange: {
                              from: e.target.value ? new Date(e.target.value) : null,
                              to: filters.dateRange?.to || null,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all text-sm"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}80`;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      />
                      <input
                        type="date"
                        value={filters.dateRange?.to ? format(filters.dateRange.to, "yyyy-MM-dd") : ""}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            dateRange: {
                              from: filters.dateRange?.from || null,
                              to: e.target.value ? new Date(e.target.value) : null,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 transition-all text-sm"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}80`;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}80`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      />
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors text-sm text-white/80"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={exportToCSV}
          aria-label="Export call logs to CSV"
          className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl glass border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-white min-h-[44px] text-sm sm:text-base"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Results Count */}
      {!loading && (
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="text-xs sm:text-sm text-white/60">
            Showing {startIndex + 1}–{Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} calls
          </div>
        </div>
      )}

      {/* Logs Cards - Floating Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center text-white/40">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="col-span-full p-8 text-center text-white/40">No calls found</div>
        ) : (
                paginatedLogs.map((log) => {
                  const statusColor = log.status === "ended" || (log.status !== "active" && log.ended_at)
                    ? "emerald"
                    : log.status === "active"
                    ? "yellow"
                    : "gray";
                  
                  return (
                    <motion.div
                      key={log.id}
                      ref={log.id === callIdParam ? callCardRef : null}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                      }}
                      whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="rounded-2xl glass-strong border border-white/10 overflow-hidden transition-all cursor-pointer"
                      style={{
                        boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.2), 0 4px 8px -2px rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}80`;
                        e.currentTarget.style.boxShadow = `0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1), 0 0 0 2px ${accentColor}80`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.boxShadow = "0 8px 16px -4px rgba(0, 0, 0, 0.2), 0 4px 8px -2px rgba(0, 0, 0, 0.1)";
                      }}
                    >
                {/* Card Header */}
                <div 
                  className="p-4 sm:p-6 cursor-pointer"
                  onClick={() => handleCardClick(log)}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div 
                          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border flex-shrink-0 ${
                            statusColor === "emerald"
                              ? "bg-emerald-500/20 border-emerald-500/30"
                              : statusColor === "yellow"
                              ? ""
                              : "bg-white/10 border-white/10"
                          }`}
                          style={statusColor === "yellow" ? {
                            backgroundColor: `${accentColor}33`,
                            borderColor: `${accentColor}4D`,
                          } : {}}
                        >
                          <Phone 
                            className={`h-4 w-4 sm:h-5 sm:w-5 ${
                              statusColor === "emerald"
                                ? "text-emerald-400"
                                : statusColor === "yellow"
                                ? ""
                                : "text-white/60"
                            }`}
                            style={statusColor === "yellow" ? { color: accentColor } : {}}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                            <h3 className="text-base sm:text-lg font-bold text-white truncate">
                              {log.patient_name || "Unknown Caller"}
                            </h3>
                            {log.success !== null && (
                              <span className={`flex-shrink-0 ${log.success ? "text-emerald-400" : "text-red-400"}`}>
                                {log.success ? <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-white/60">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.started_at), "MMM d, h:mm a")}
                            </div>
                            {log.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span className="truncate max-w-[120px] sm:max-w-none">{log.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Intent - Prominent Display */}
                      {log.last_intent && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4" style={{ color: accentColor }} />
                            <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Intent</span>
                          </div>
                          <span 
                            className="px-3 py-1.5 rounded-lg text-sm font-semibold border inline-block"
                            style={{
                              backgroundColor: `${accentColor}33`,
                              color: accentColor,
                              borderColor: `${accentColor}66`,
                            }}
                          >
                            {log.last_intent}
                          </span>
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${
                            statusColor === "emerald"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : statusColor === "yellow"
                              ? ""
                              : "bg-white/10 text-white/60 border-white/10"
                          }`}
                          style={statusColor === "yellow" ? {
                            backgroundColor: `${accentColor}33`,
                            color: accentColor,
                            borderColor: `${accentColor}4D`,
                          } : {}}
                        >
                          {log.status ?? "unknown"}
                        </span>
                      </div>
                      
                      {/* Summary Preview */}
                      {log.last_summary && (
                        <p className="text-sm text-white/70 line-clamp-2 mt-3">
                          {log.last_summary}
                        </p>
                      )}
                    </div>
                    
                    {/* View Details Indicator */}
                    <div className="p-2 rounded-lg flex-shrink-0">
                      <ChevronRight className="h-5 w-5 text-white/40" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg glass border transition-colors ${
              currentPage === 1
                ? "border-white/10 text-white/40 cursor-not-allowed"
                : "border-white/10 text-white hover:bg-white/10"
            }`}
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 rounded-lg glass border transition-colors text-sm ${
                    currentPage === pageNum
                      ? ""
                      : "border-white/10 text-white hover:bg-white/10"
                  }`}
                  style={currentPage === pageNum ? {
                    borderColor: `${accentColor}80`,
                    backgroundColor: `${accentColor}33`,
                    color: accentColor,
                  } : {}}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg glass border transition-colors ${
              currentPage === totalPages
                ? "border-white/10 text-white/40 cursor-not-allowed"
                : "border-white/10 text-white hover:bg-white/10"
            }`}
          >
            Next
          </button>
        </div>
      )}

      {/* Call Details Modal */}
      <CallDetailsModal
        call={selectedCall as any}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCall(null);
        }}
      />
    </div>
  );
}
