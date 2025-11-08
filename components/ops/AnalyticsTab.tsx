"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";

type TimeRange = "today" | "week" | "month";

type AnalyticsData = {
  summary: {
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    escalated_calls: number;
    upsell_calls: number;
    bookings: number;
    avg_duration: number;
    success_rate: number;
  };
  intent_breakdown: Record<string, number>;
  business_stats: Array<{
    business_id: string;
    business_name: string;
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    bookings: number;
    escalated_calls: number;
    upsell_calls: number;
  }>;
  daily_breakdown: Record<string, { calls: number; successful: number; bookings: number }>;
};

export default function AnalyticsTab({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const { accentColor } = useAccentColor();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, selectedBusiness]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ range: timeRange });
      if (selectedBusiness) {
        params.append("business_id", selectedBusiness);
      }
      
      const response = await fetch(`/api/ops-analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/60">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-xl glass border border-white/10 p-8 text-center text-white/60">
        No analytics data available
      </div>
    );
  }

  // Prepare daily breakdown for chart
  const dailyData = Object.entries(analytics.daily_breakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      ...data,
    }));

  const maxCalls = Math.max(...dailyData.map(d => d.calls), 1);

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl glass border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Total Calls</div>
          <div className="text-2xl font-bold text-white">{analytics.summary.total_calls}</div>
        </div>
        <div className="rounded-xl glass border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Success Rate</div>
          <div className="text-2xl font-bold text-green-400">
            {analytics.summary.success_rate.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl glass border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Bookings</div>
          <div className="text-2xl font-bold text-blue-400">{analytics.summary.bookings}</div>
        </div>
        <div className="rounded-xl glass border border-white/10 p-4">
          <div className="text-white/60 text-xs mb-1">Avg Duration</div>
          <div className="text-2xl font-bold text-white">
            {Math.floor(analytics.summary.avg_duration / 60)}m {analytics.summary.avg_duration % 60}s
          </div>
        </div>
      </div>

      {/* Daily Trend Chart */}
      {dailyData.length > 0 && (
        <div className="rounded-xl glass border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Daily Trend</h3>
          <div className="flex items-end gap-2 h-48">
            {dailyData.map((day, index) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="relative w-full h-40 flex items-end">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(day.calls / maxCalls) * 100}%`,
                      backgroundColor: accentColor,
                      minHeight: day.calls > 0 ? "4px" : "0",
                    }}
                  />
                </div>
                <div className="text-xs text-white/60 text-center">
                  {format(parseISO(day.date), "MMM d")}
                </div>
                <div className="text-xs font-medium text-white">{day.calls}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intent Breakdown */}
      {Object.keys(analytics.intent_breakdown).length > 0 && (
        <div className="rounded-xl glass border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Intent Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(analytics.intent_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([intent, count]) => {
                const percentage = (count / analytics.summary.total_calls) * 100;
                return (
                  <div key={intent} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/80 text-sm">{intent}</span>
                        <span className="text-white/60 text-sm">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: accentColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Business Performance */}
      {analytics.business_stats.length > 0 && (
        <div className="rounded-xl glass border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Business Performance</h3>
          <div className="space-y-3">
            {analytics.business_stats
              .sort((a, b) => b.total_calls - a.total_calls)
              .map((business) => {
                const successRate = business.total_calls > 0
                  ? (business.successful_calls / business.total_calls) * 100
                  : 0;
                return (
                  <div key={business.business_id} className="rounded-lg border border-white/10 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-white">{business.business_name}</h4>
                      <span className="text-white/60 text-sm">{business.total_calls} calls</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-white/60">Success Rate</div>
                        <div className={`font-medium ${
                          successRate >= 70 ? "text-green-400" :
                          successRate >= 50 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {successRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-white/60">Bookings</div>
                        <div className="font-medium text-white">{business.bookings}</div>
                      </div>
                      <div>
                        <div className="text-white/60">Escalated</div>
                        <div className="font-medium text-white">{business.escalated_calls}</div>
                      </div>
                      <div>
                        <div className="text-white/60">Upsells</div>
                        <div className="font-medium text-white">{business.upsell_calls}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

