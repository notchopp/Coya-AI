"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Phone, Building2, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import CallDetailsModal from "@/components/CallDetailsModal";

type Call = {
  id: string;
  business_id: string;
  call_id: string;
  patient_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  success: boolean | null;
  started_at: string;
  ended_at: string | null;
  last_intent: string | null;
  escalate: boolean | null;
  upsell: boolean | null;
  schedule: any;
  transcript: string | null;
  businesses?: {
    id: string;
    name: string;
    vertical: string | null;
  };
};

type TimeRange = "today" | "week" | "month" | "all";

export default function CallsTab({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const { accentColor } = useAccentColor();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();
  }, [timeRange, selectedBusiness]);

  const loadCalls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        range: timeRange,
        limit: "50",
      });
      if (selectedBusiness) {
        params.append("business_id", selectedBusiness);
      }
      
      const response = await fetch(`/api/ops-calls?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCalls(data.calls || []);
      }
    } catch (error) {
      console.error("Error loading calls:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter(call =>
    call.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.phone?.includes(searchQuery) ||
    call.businesses?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.last_intent?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/60">Loading calls...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
          <input
            type="text"
            placeholder="Search calls by name, phone, business, or intent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg glass border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["today", "week", "month", "all"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                timeRange === range
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calls List */}
      <div className="space-y-3">
        {filteredCalls.length === 0 ? (
          <div className="rounded-xl glass border border-white/10 p-8 text-center text-white/60">
            No calls found
          </div>
        ) : (
          filteredCalls.map((call, index) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedCall(call)}
              className="rounded-xl glass border border-white/10 p-4 sm:p-6 cursor-pointer hover:border-white/20 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div 
                      className="p-2 rounded-lg border flex-shrink-0"
                      style={{
                        backgroundColor: `${accentColor}33`,
                        borderColor: `${accentColor}4D`,
                      }}
                    >
                      <Phone className="h-5 w-5" style={{ color: accentColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white mb-1">
                        {call.patient_name || "Unknown Caller"}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
                        {call.businesses && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {call.businesses.name}
                          </span>
                        )}
                        {call.phone && (
                          <span className="font-mono">{call.phone}</span>
                        )}
                        {call.last_intent && (
                          <span className="px-2 py-0.5 rounded bg-white/5">
                            {call.last_intent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-white/60">
                      <Clock className="h-4 w-4" />
                      {format(new Date(call.started_at), "MMM d, h:mm a")}
                    </span>
                    {call.success !== null && (
                      <span className={`flex items-center gap-1 ${
                        call.success ? "text-green-400" : "text-red-400"
                      }`}>
                        {call.success ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {call.success ? "Successful" : "Failed"}
                      </span>
                    )}
                    {call.escalate && (
                      <span className="px-2 py-0.5 rounded bg-orange-400/20 text-orange-400 text-xs">
                        Escalated
                      </span>
                    )}
                    {call.upsell && (
                      <span className="px-2 py-0.5 rounded bg-purple-400/20 text-purple-400 text-xs">
                        Upsell
                      </span>
                    )}
                    {call.schedule && (
                      <span className="px-2 py-0.5 rounded bg-blue-400/20 text-blue-400 text-xs">
                        Booked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Call Details Modal */}
      <AnimatePresence>
        {selectedCall && (
          <CallDetailsModal
            call={selectedCall as any}
            isOpen={!!selectedCall}
            onClose={() => setSelectedCall(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

