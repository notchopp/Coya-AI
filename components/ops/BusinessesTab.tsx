"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Clock,
  ExternalLink,
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import OperationsOverview from "./OperationsOverview";

type Business = {
  id: string;
  name: string;
  vertical: string | null;
  to_number: string | null;
  address: string | null;
  hours: any;
  services: any;
  created_at: string;
};

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

export default function BusinessesTab({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const { accentColor } = useAccentColor();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessStats, setBusinessStats] = useState<Record<string, BusinessStats>>({});
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadBusinesses();
    loadBusinessStats();
  }, [timeRange]);

  const loadBusinesses = async () => {
    try {
      const response = await fetch("/api/ops-businesses");
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses || []);
      }
    } catch (error) {
      console.error("Error loading businesses:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBusinessStats = async () => {
    try {
      const response = await fetch(`/api/ops-stats?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        const statsMap: Record<string, BusinessStats> = {};
        (data.businesses || []).forEach((stat: BusinessStats) => {
          statsMap[stat.id] = stat;
        });
        setBusinessStats(statsMap);
      }
    } catch (error) {
      console.error("Error loading business stats:", error);
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.vertical?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.to_number?.includes(searchQuery)
  );

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

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const goToBusinessDashboard = (businessId: string) => {
    // Store business_id in sessionStorage and redirect
    if (typeof window !== "undefined") {
      sessionStorage.setItem("business_id", businessId);
      window.open("/", "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/60">Loading businesses...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Search and Time Range */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search businesses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg glass border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
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

      {/* Business Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBusinesses.map((business, index) => {
          const stats = businessStats[business.id];
          return (
            <motion.div
              key={business.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedBusiness(business)}
              className="rounded-xl glass border border-white/10 p-4 sm:p-6 cursor-pointer hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">{business.name}</h3>
                  {business.vertical && (
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-white/5 text-white/60">
                      {business.vertical}
                    </span>
                  )}
                </div>
                {stats && (
                  <div className={`px-2 py-1 rounded-lg border text-xs font-medium ${getStatusBg(stats.status)} ${getStatusColor(stats.status)}`}>
                    {stats.status.toUpperCase()}
                  </div>
                )}
              </div>

              {stats && (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Calls</span>
                    <span className="text-white font-medium">{stats.total_calls}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Success Rate</span>
                    <span className={`font-medium ${
                      stats.success_rate >= 70 ? "text-green-400" :
                      stats.success_rate >= 50 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {stats.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Bookings</span>
                    <span className="text-white font-medium">{stats.bookings}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-white/60">
                {business.to_number && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {business.to_number}
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToBusinessDashboard(business.id);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-sm"
                style={{ borderColor: `${accentColor}33` }}
              >
                <ExternalLink className="h-4 w-4" />
                Go to Dashboard
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Business Details Modal */}
      <AnimatePresence>
        {selectedBusiness && (
          <BusinessDetailsModal
            business={selectedBusiness}
            stats={businessStats[selectedBusiness.id]}
            isOpen={!!selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
            onGoToDashboard={() => {
              if (selectedBusiness) {
                goToBusinessDashboard(selectedBusiness.id);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BusinessDetailsModal({
  business,
  stats,
  isOpen,
  onClose,
  onGoToDashboard,
}: {
  business: Business;
  stats?: BusinessStats;
  isOpen: boolean;
  onClose: () => void;
  onGoToDashboard: () => void;
}) {
  const { accentColor } = useAccentColor();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl glass-strong border border-white/10 p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5 text-white/60" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{business.name}</h2>
          {business.vertical && (
            <span className="inline-block px-3 py-1 rounded-lg text-sm bg-white/5 text-white/60">
              {business.vertical}
            </span>
          )}
        </div>

        {/* Business Info */}
        <div className="space-y-4 mb-6">
          {business.to_number && (
            <div className="flex items-center gap-3 text-white/80">
              <Phone className="h-5 w-5 text-white/60" />
              <span>{business.to_number}</span>
            </div>
          )}
          {business.address && (
            <div className="flex items-center gap-3 text-white/80">
              <MapPin className="h-5 w-5 text-white/60" />
              <span>{business.address}</span>
            </div>
          )}
          {business.created_at && (
            <div className="flex items-center gap-3 text-white/80">
              <Clock className="h-5 w-5 text-white/60" />
              <span>Created {format(new Date(business.created_at), "MMM d, yyyy")}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Performance Stats</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg glass border border-white/10 p-4">
                <div className="text-white/60 text-xs mb-1">Total Calls</div>
                <div className="text-xl font-bold text-white">{stats.total_calls}</div>
              </div>
              <div className="rounded-lg glass border border-white/10 p-4">
                <div className="text-white/60 text-xs mb-1">Success Rate</div>
                <div className={`text-xl font-bold ${
                  stats.success_rate >= 70 ? "text-green-400" :
                  stats.success_rate >= 50 ? "text-yellow-400" : "text-red-400"
                }`}>
                  {stats.success_rate.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg glass border border-white/10 p-4">
                <div className="text-white/60 text-xs mb-1">Bookings</div>
                <div className="text-xl font-bold text-blue-400">{stats.bookings}</div>
              </div>
              <div className="rounded-lg glass border border-white/10 p-4">
                <div className="text-white/60 text-xs mb-1">Avg Duration</div>
                <div className="text-xl font-bold text-white">
                  {Math.floor(stats.avg_duration / 60)}m {stats.avg_duration % 60}s
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Services */}
        {business.services && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-2">Services</h3>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(business.services) ? (
                business.services.map((service: string, i: number) => (
                  <span key={i} className="px-2 py-1 rounded bg-white/5 text-white/80 text-sm">
                    {service}
                  </span>
                ))
              ) : (
                <span className="text-white/60 text-sm">No services listed</span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onGoToDashboard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-medium transition-colors"
            style={{
              backgroundColor: `${accentColor}33`,
              borderColor: `${accentColor}4D`,
              color: accentColor,
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Go to Dashboard
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-lg glass border border-white/10 hover:bg-white/10 text-white/80 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}


