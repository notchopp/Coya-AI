"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { 
  BarChart3,
  Building2,
  Phone,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  X,
  ArrowRight,
  Layers
} from "lucide-react";
import { format } from "date-fns";
import { useAccentColor } from "@/components/AccentColorProvider";
import CallDetailsModal from "@/components/CallDetailsModal";
import OperationsOverview from "@/components/ops/OperationsOverview";
import BusinessesTab from "@/components/ops/BusinessesTab";
import CallsTab from "@/components/ops/CallsTab";
import AnalyticsTab from "@/components/ops/AnalyticsTab";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";

type Tab = "overview" | "businesses" | "calls" | "analytics" | "programs";

export default function OperationsDashboard() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [authLoading, setAuthLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("week");
  const [callsTimeRange, setCallsTimeRange] = useState<"today" | "week" | "month" | "all">("week");

  // Check authentication
  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }
      
      setAuthLoading(false);
    }
    
    checkAuth();
  }, [router]);

  const tabs = [
    { id: "overview" as Tab, label: "Overview", icon: BarChart3 },
    { id: "businesses" as Tab, label: "Businesses", icon: Building2 },
    { id: "programs" as Tab, label: "Programs", icon: Layers },
    { id: "calls" as Tab, label: "Calls", icon: Phone },
    { id: "analytics" as Tab, label: "Analytics", icon: TrendingUp },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white/60">Loading operations dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Welcome Onboarding Modal - shows for new users/admins */}
      <WelcomeOnboarding />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Operations Dashboard</h1>
          <p className="text-white/60 text-sm sm:text-base">
            System-wide management and analytics
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 border-b border-white/10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === "programs") {
                      router.push("/ops/programs");
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? "border-white text-white"
                      : "border-transparent text-white/60 hover:text-white hover:border-white/30"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && (
              <OperationsOverview timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            )}
            {activeTab === "businesses" && (
              <BusinessesTab timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            )}
            {activeTab === "calls" && (
              <CallsTab timeRange={callsTimeRange} onTimeRangeChange={setCallsTimeRange} />
            )}
            {activeTab === "analytics" && (
              <AnalyticsTab timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            )}
            {activeTab === "programs" && (
              <div className="text-center py-12">
                <p className="text-white/60 mb-4">Redirecting to Programs Management...</p>
                <button
                  onClick={() => router.push("/ops/programs")}
                  className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                >
                  Go to Programs
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
