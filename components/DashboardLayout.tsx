"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { useTheme } from "@/components/ThemeProvider";
import Coyalogo from "@/components/Coyalogo";
import {
  LayoutDashboard,
  Phone,
  FileText,
  Calendar,
  Settings,
  Menu,
  X,
  Moon,
  Sun,
  TrendingUp,
  AlertCircle,
  GitBranch,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Live Calls", icon: Phone },
  { href: "/logs", label: "Call Logs", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/flowchart", label: "Flowchart", icon: GitBranch, comingSoon: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] glass-strong border-r border-yellow-500/20 lg:hidden"
            >
              <SidebarContent pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-yellow-500/20 glass-strong">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-yellow-500/20 glass-strong">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{
                rotate: [0, 5, -5, 5, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Coyalogo src="/logo.gif" size={60} />
            </motion.div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">COYA AI</span>
              <span className="beta-badge">Beta</span>
            </div>
          </div>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarStats, setSidebarStats] = useState({
    activeCalls: 0,
    bookings: 0,
  });
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function loadStats() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) return;

      const now = new Date();
      
      // Calculate date range based on period
      let periodStart: Date;
      if (period === "daily") {
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
      } else if (period === "weekly") {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
      } else {
        // monthly
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 30);
      }

      // Get active calls (always current active, not filtered by period)
      const { count: activeCount } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "active");

      // Get bookings for the selected period
      const { count: bookingsCount } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("schedule", "is", null)
        .gte("started_at", periodStart.toISOString());

      setSidebarStats({
        activeCalls: activeCount ?? 0,
        bookings: bookingsCount ?? 0,
      });
    }

    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [mounted, period]);

  function togglePeriod() {
    if (period === "daily") {
      setPeriod("weekly");
    } else if (period === "weekly") {
      setPeriod("monthly");
    } else {
      setPeriod("daily");
    }
  }

  const periodLabel = period === "daily" ? "Today" : period === "weekly" ? "This Week" : "This Month";

  return (
    <>
      <div className="p-6 border-b border-yellow-500/20">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <motion.div
            animate={{
              rotate: [0, 5, -5, 5, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Coyalogo src="/logo.gif" size={60} />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white">COYA AI</span>
              <span className="beta-badge">Beta</span>
            </div>
            <div className="text-xs text-yellow-400/70 mt-0.5">Live Receptionist</div>
          </div>
        </motion.div>
      </div>

      {/* Real-time Stats */}
      <div className="p-4 border-b border-yellow-500/20 space-y-2">
        <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Quick Stats
        </div>
        <div className="space-y-2">
          <div className="p-2 rounded-lg glass border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Active</span>
              <span className="text-sm font-bold text-yellow-400">{sidebarStats.activeCalls}</span>
            </div>
          </div>
          <button
            onClick={togglePeriod}
            className="w-full p-2 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors text-left relative group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Bookings {periodLabel}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-yellow-400/70 bg-yellow-400/10 border border-yellow-400/20">
                  Tap
                </span>
              </div>
              <span className="text-sm font-bold text-white">{sidebarStats.bookings}</span>
            </div>
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                onClick={(e) => {
                  if (item.comingSoon) {
                    e.preventDefault();
                  }
                  if (onNavigate) onNavigate();
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                  item.comingSoon ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 rounded-xl border border-yellow-500/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon
                  className={`h-5 w-5 relative z-10 transition-colors ${
                    isActive
                      ? "text-yellow-400"
                      : "text-white/60 group-hover:text-white"
                  }`}
                />
                      <span
                        className={`relative z-10 transition-colors ${
                          isActive
                            ? "text-yellow-400"
                            : "text-white/60 group-hover:text-white"
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.comingSoon && (
                        <span className="relative z-10 ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium text-yellow-400/70 bg-yellow-400/10 border border-yellow-400/20">
                          Coming Soon
                        </span>
                      )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-yellow-500/20 space-y-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full px-3 py-2 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm text-white/80"
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 text-yellow-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-yellow-400" />
              <span>Dark Mode</span>
            </>
          )}
        </button>

        <div className="px-3 py-2 text-xs text-white/40 flex items-center justify-between">
          <span className="beta-badge">Beta</span>
          <span className="text-white/30">30 clients</span>
        </div>
        <button
          onClick={async () => {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
            sessionStorage.removeItem("business_id");
            window.location.href = "/login";
          }}
          className="w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white/60 text-left"
        >
          Sign Out
        </button>
      </div>
    </>
  );
}

