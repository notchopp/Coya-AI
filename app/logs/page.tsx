"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Search, Filter, Download, X, Calendar, CheckCircle, XCircle } from "lucide-react";
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
};

type FilterState = {
  status: string | null;
  success: boolean | null;
  intent: string | null;
  dateRange: { start: string; end: string } | null;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Call[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: null,
    success: null,
    intent: null,
    dateRange: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
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
            className="w-full pl-10 pr-4 py-3 rounded-xl glass border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-3 rounded-xl glass border transition-colors flex items-center gap-2 text-white ${
              hasActiveFilters
                ? "border-yellow-500/50 bg-yellow-500/10"
                : "border-white/10 hover:bg-white/10"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filter
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
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
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                      className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
                        value={filters.dateRange?.start || ""}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            dateRange: {
                              start: e.target.value,
                              end: filters.dateRange?.end || "",
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
                      />
                      <input
                        type="date"
                        value={filters.dateRange?.end || ""}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            dateRange: {
                              start: filters.dateRange?.start || "",
                              end: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all text-sm"
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
          className="px-4 py-3 rounded-xl glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-white"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Results Count */}
      {!loading && (
        <div className="text-sm text-white/60">
          Showing {filteredLogs.length} of {logs.length} calls
        </div>
      )}

      {/* Logs Table */}
      <div className="rounded-2xl glass-strong border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white/40">Loading...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-white/40">No calls found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Intent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Summary
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredLogs.map((log) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {format(new Date(log.started_at), "MMM d, h:mm a")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">
                        {log.patient_name ?? "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                        {log.phone ?? "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              log.status === "ended" || (log.status !== "active" && log.ended_at)
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : log.status === "active"
                                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                : "bg-white/10 text-white/60 border border-white/10"
                            }`}
                          >
                            {log.status ?? "unknown"}
                          </span>
                          {log.success !== null && (
                            <span className={`text-xs ${log.success ? "text-emerald-400" : "text-red-400"}`}>
                              {log.success ? "✓" : "✗"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                        {log.last_intent ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/70 max-w-md truncate">
                        {log.last_summary ?? "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

