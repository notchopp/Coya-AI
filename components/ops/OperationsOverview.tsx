"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Clock } from "lucide-react";
import { format } from "date-fns";

type BusinessStats = {
  id: string;
  name: string;
  vertical: string | null;
  to_number: string | null;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  escalated_calls: number;
  upsell_calls: number;
  bookings: number;
  avg_duration: number;
  success_rate: number;
  last_call_at: string | null;
  status: "healthy" | "warning" | "critical";
};

type TimeRange = "today" | "week" | "month";

export default function OperationsOverview({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const [businesses, setBusinesses] = useState<BusinessStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadBusinessStats = async () => {
    try {
      setRefreshing(true);
      
      const response = await fetch(`/api/ops-stats?range=${timeRange}`);
      if (!response.ok) {
        throw new Error(`Failed to load stats: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error("Error loading stats:", data.error);
        return;
      }
      
      setBusinesses(data.businesses || []);
      if (data.totalStats) {
        setTotalStats(data.totalStats);
      }
      setLastUpdated(new Date(data.timestamp || Date.now()));
    } catch (error) {
      console.error("Error loading business stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBusinessStats();
  }, [timeRange]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadBusinessStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange]);

  const [totalStats, setTotalStats] = useState({
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    escalated_calls: 0,
    upsell_calls: 0,
    bookings: 0,
    avg_success_rate: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`/api/ops-stats?range=${timeRange}`);
        if (response.ok) {
          const data = await response.json();
          if (data.totalStats) {
            setTotalStats(data.totalStats);
          }
        }
      } catch (error) {
        console.error("Error loading total stats:", error);
      }
    };
    
    loadStats();
  }, [timeRange]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "critical":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-400/20 border-green-400/30";
      case "warning":
        return "bg-yellow-400/20 border-yellow-400/30";
      case "critical":
        return "bg-red-400/20 border-red-400/30";
      default:
        return "bg-gray-400/20 border-gray-400/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/60">Loading overview...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Time Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["today", "week", "month"] as TimeRange[]).map((range) => (
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
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm">
            Last updated: {format(lastUpdated, "h:mm:ss a")}
          </span>
          <button
            onClick={() => loadBusinessStats()}
            disabled={refreshing}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 text-white/60 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* System Health Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl glass border border-white/10 p-3 sm:p-4"
        >
          <div className="text-white/60 text-xs sm:text-sm mb-1">Total Calls</div>
          <div className="text-xl sm:text-2xl font-bold text-white">{totalStats.total_calls}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl glass border border-white/10 p-3 sm:p-4"
        >
          <div className="text-white/60 text-xs sm:text-sm mb-1">Success Rate</div>
          <div className="text-xl sm:text-2xl font-bold text-green-400">
            {totalStats.avg_success_rate.toFixed(1)}%
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl glass border border-white/10 p-3 sm:p-4"
        >
          <div className="text-white/60 text-xs sm:text-sm mb-1">Bookings</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-400">{totalStats.bookings}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`rounded-xl border p-3 sm:p-4 ${getStatusBg("healthy")}`}
        >
          <div className="text-white/60 text-xs sm:text-sm mb-1">Healthy</div>
          <div className="text-xl sm:text-2xl font-bold text-green-400">{totalStats.healthy}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`rounded-xl border p-3 sm:p-4 ${getStatusBg("warning")}`}
        >
          <div className="text-white/60 text-xs sm:text-sm mb-1">Warning</div>
          <div className="text-xl sm:text-2xl font-bold text-yellow-400">{totalStats.warning}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`rounded-xl border p-3 sm:p-4 ${getStatusBg("critical")}`}
        >
          <div className="text-white/60 text-xs sm:text-sm mb-1">Critical</div>
          <div className="text-xl sm:text-2xl font-bold text-red-400">{totalStats.critical}</div>
        </motion.div>
      </div>

      {/* Business List */}
      <div className="space-y-3 sm:space-y-4">
        {businesses.length === 0 ? (
          <div className="rounded-xl glass border border-white/10 p-8 text-center text-white/60">
            No businesses found
          </div>
        ) : (
          businesses.map((business, index) => (
            <motion.div
              key={business.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl glass border p-4 sm:p-6 ${getStatusBg(business.status)}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Left: Business Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`px-2 sm:px-3 py-1 rounded-lg border ${getStatusBg(business.status)}`}>
                      <div className={`text-xs font-medium ${getStatusColor(business.status)}`}>
                        {business.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1 truncate">
                        {business.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-white/60">
                        {business.vertical && (
                          <span className="px-2 py-0.5 rounded bg-white/5">
                            {business.vertical}
                          </span>
                        )}
                        {business.to_number && (
                          <span className="font-mono">{business.to_number}</span>
                        )}
                        {business.last_call_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(business.last_call_at), "MMM d, h:mm a")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                    <div>
                      <div className="text-white/60 text-xs mb-1">Total Calls</div>
                      <div className="text-lg sm:text-xl font-bold text-white">{business.total_calls}</div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">Success Rate</div>
                      <div className={`text-lg sm:text-xl font-bold ${
                        business.success_rate >= 70 ? "text-green-400" :
                        business.success_rate >= 50 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {business.success_rate.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">Bookings</div>
                      <div className="text-lg sm:text-xl font-bold text-blue-400">{business.bookings}</div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">Escalated</div>
                      <div className="text-lg sm:text-xl font-bold text-orange-400">
                        {business.escalated_calls}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">Upsells</div>
                      <div className="text-lg sm:text-xl font-bold text-purple-400">
                        {business.upsell_calls}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">Avg Duration</div>
                      <div className="text-lg sm:text-xl font-bold text-white">
                        {formatDuration(business.avg_duration)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Stats */}
                <div className="flex sm:flex-col gap-2 sm:gap-3 sm:items-end">
                  <div className="text-right">
                    <div className="text-white/60 text-xs mb-1">Successful</div>
                    <div className="text-lg sm:text-xl font-bold text-green-400">
                      {business.successful_calls}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/60 text-xs mb-1">Failed</div>
                    <div className="text-lg sm:text-xl font-bold text-red-400">
                      {business.failed_calls}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

