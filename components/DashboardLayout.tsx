"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { useTheme } from "@/components/ThemeProvider";
import { usePremiumMode } from "@/components/PremiumModeProvider";
import { ChartsPage } from "@/components/ChartsPage";
import { useAccentColor } from "@/components/AccentColorProvider";
import Coyalogo from "@/components/Coyalogo";
import { useIsAdmin } from "@/lib/useUserRole";
import {
  LayoutDashboard,
  Phone,
  FileText,
  Calendar,
  Settings,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  AlertCircle,
  GitBranch,
  Brain,
  BarChart3,
  Building2,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Live Calls", icon: Phone },
  { href: "/logs", label: "Call Logs", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/programs", label: "Programs", icon: Building2, adminOnly: true },
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
  const { isPremium, isLocalhost, togglePremium } = usePremiumMode();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  const isAdmin = useIsAdmin();
  const mobileMiddleColor = theme === "light" ? "#000000" : "#ffffff";
  // Premium mode available on all pages
  const isDashboard = pathname === "/";
  const showPremium = isPremium; // Available everywhere, not just dashboard

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden relative">
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
              className="fixed inset-y-0 left-0 z-50 w-[280px] glass-strong border-r lg:hidden"
              style={{ borderColor: `${accentColor}33` }}
            >
              <SidebarContent pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r glass-strong relative z-10" style={{ borderColor: `${accentColor}33` }}>
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b glass-strong" style={{ borderColor: `${accentColor}33` }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open sidebar"
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
              <span 
                className="font-semibold text-sm"
                style={{
                  background: `linear-gradient(to right, #eab308, #fde047, #eab308)`, // Always golden
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "#eab308", // Fallback color for browsers that don't support background-clip
                }}
              >
                COYA AI
              </span>
              <span className="beta-badge">Beta</span>
            </div>
          </div>
          <motion.button
            onClick={async () => {
              const supabase = getSupabaseClient();
              await supabase.auth.signOut();
              sessionStorage.removeItem("business_id");
              window.location.href = "/login";
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Sign out"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <LogOut className="h-5 w-5 text-white" />
          </motion.button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-20 sm:pb-24 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {isPremium && isDashboard ? (
                <ChartsPage />
              ) : (
                children
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Sidebar Toggle - Mobile Only */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed bottom-4 left-4 z-50 p-4 rounded-full glass-strong border shadow-2xl"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.2)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6 text-white" />
        </motion.button>

        {/* Floating AI Insights Toggle - Mobile Only, Dashboard Only, Admin Only */}
        {isDashboard && isAdmin && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePremium}
            className="lg:hidden fixed bottom-4 right-4 z-50 p-4 rounded-full glass-strong border shadow-2xl"
            style={{
              borderColor: isPremium ? `${accentColor}66` : 'rgba(255, 255, 255, 0.2)',
              backgroundColor: isPremium ? `${accentColor}33` : 'rgba(255, 255, 255, 0.1)',
              boxShadow: isPremium ? `0 8px 32px ${accentColor}40` : '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
            aria-label={isPremium ? "Turn off AI Insights" : "Turn on AI Insights"}
          >
            <motion.div
              animate={isPremium ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Brain 
                className="h-6 w-6" 
                style={{ color: isPremium ? accentColor : 'rgba(255, 255, 255, 0.8)' }} 
              />
            </motion.div>
            {isPremium && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 h-3 w-3 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </motion.button>
        )}
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
  const { accentColor } = useAccentColor();
  // Use context for premium mode - shared state across all components
  const { isPremium, togglePremium } = usePremiumMode();
  const isAdmin = useIsAdmin();
  const middleColor = theme === "light" ? "#000000" : "#ffffff"; // Black in light mode, white in dark mode
  const isDashboard = pathname === "/";
  const showPremium = isPremium; // Use context state directly
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
      <motion.div
        initial={showPremium ? { opacity: 0, y: -30 } : { opacity: 0, y: -20 }}
        animate={showPremium ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        transition={showPremium ? { duration: 0.8, ease: [0.16, 1, 0.3, 1] } : { duration: 0.5 }}
        className="p-6 border-b relative overflow-hidden"
        style={{ borderColor: `${accentColor}33` }}
      >
        {showPremium && (
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, ${accentColor}0D, transparent, ${accentColor}0D)`,
            }}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
        <motion.div
          initial={showPremium ? { opacity: 0, scale: 0.8 } : false}
          animate={showPremium ? { opacity: 1, scale: 1 } : {}}
          transition={showPremium ? { delay: 0.2, type: "spring", stiffness: 200 } : {}}
          className="flex items-center gap-3 relative z-10"
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
            whileHover={showPremium ? { scale: 1.05, rotate: 5 } : {}}
          >
            <Coyalogo src="/logo.gif" size={60} />
          </motion.div>
          <motion.div
            initial={showPremium ? { opacity: 0, x: -10 } : false}
            animate={showPremium ? { opacity: 1, x: 0 } : {}}
            transition={showPremium ? { delay: 0.3 } : {}}
          >
            <div className="flex items-center gap-2">
              <span 
                className="font-bold text-lg bg-clip-text text-transparent"
                style={{
                  background: `linear-gradient(to right, #eab308, #fde047, #eab308)`, // Always golden
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                COYA AI
              </span>
              <motion.span
                className="beta-badge"
                initial={showPremium ? { scale: 0 } : false}
                animate={showPremium ? { scale: 1 } : {}}
                transition={showPremium ? { type: "spring", delay: 0.4 } : {}}
                whileHover={showPremium ? { scale: 1.05 } : {}}
              >
                Beta
              </motion.span>
            </div>
            <motion.div
              initial={showPremium ? { opacity: 0 } : false}
              animate={showPremium ? { opacity: 1 } : {}}
              transition={showPremium ? { delay: 0.5 } : {}}
              className="text-xs bg-clip-text text-transparent mt-0.5"
              style={{
                background: `linear-gradient(to right, #eab308, #fde047, #eab308)`, // Always golden
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Live Receptionist
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Real-time Stats */}
      <motion.div
        initial={showPremium ? { opacity: 0, y: 20 } : false}
        animate={showPremium ? { opacity: 1, y: 0 } : {}}
        transition={showPremium ? { delay: 0.6, duration: 0.5 } : {}}
        className="p-4 border-b space-y-2"
        style={{ borderColor: `${accentColor}33` }}
      >
        <motion.div
          className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2"
          animate={isPremium ? {
            backgroundPosition: ["0%", "100%"],
          } : {}}
          style={isPremium ? {
            background: `linear-gradient(90deg, rgba(255,255,255,0.6) 0%, ${accentColor}CC 50%, rgba(255,255,255,0.6) 100%)`,
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          } : {}}
        >
          Quick Stats
        </motion.div>
        <div className="space-y-2">
          <motion.div
            initial={isPremium ? { opacity: 0, x: -20 } : false}
            animate={isPremium ? { opacity: 1, x: 0 } : {}}
            transition={isPremium ? { delay: 0.7 } : {}}
            whileHover={isPremium ? { scale: 1.02, x: 4 } : {}}
            className="p-2 rounded-lg glass border border-white/10 relative overflow-hidden group"
          >
            {isPremium && (
              <motion.div
                className="absolute inset-0"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.5 }}
                style={{
                  background: `linear-gradient(to right, ${accentColor}1A, transparent, ${accentColor}1A)`,
                }}
              />
            )}
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs text-white/60">Active</span>
              <motion.span
                key={sidebarStats.activeCalls}
                initial={isPremium ? { scale: 1.5 } : false}
                animate={isPremium ? { scale: 1 } : {}}
                transition={isPremium ? { type: "spring", stiffness: 300 } : {}}
                className="text-sm font-bold"
                style={{ color: accentColor }}
              >
                {sidebarStats.activeCalls}
              </motion.span>
            </div>
          </motion.div>
          <motion.button
            initial={isPremium ? { opacity: 0, x: -20 } : false}
            animate={isPremium ? { opacity: 1, x: 0 } : {}}
            transition={isPremium ? { delay: 0.8 } : {}}
            whileHover={isPremium ? { scale: 1.02, x: 4 } : {}}
            whileTap={isPremium ? { scale: 0.98 } : {}}
            onClick={togglePeriod}
            className="w-full p-2 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors text-left relative group overflow-hidden"
          >
            {isPremium && (
              <motion.div
                className="absolute inset-0"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.5 }}
                style={{
                  background: `linear-gradient(to right, ${accentColor}1A, transparent, ${accentColor}1A)`,
                }}
              />
            )}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Bookings {periodLabel}</span>
                <motion.span
                  animate={{
                    opacity: [1, 0.3, 1],
                    scale: isPremium ? [1, 1.1, 1] : [1, 1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  style={{
                    color: `${accentColor}B3`,
                    backgroundColor: `${accentColor}1A`,
                    borderColor: `${accentColor}33`,
                  }}
                >
                  Tap
                </motion.span>
              </div>
              <motion.span
                key={sidebarStats.bookings}
                initial={isPremium ? { scale: 1.5 } : false}
                animate={isPremium ? { scale: 1 } : {}}
                transition={isPremium ? { type: "spring", stiffness: 300 } : {}}
                className="text-sm font-bold text-white"
              >
                {sidebarStats.bookings}
              </motion.span>
            </div>
          </motion.button>
        </div>
      </motion.div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          // Hide admin-only items from non-admins
          if (item.adminOnly && !isAdmin) {
            return null;
          }
          return (
            <motion.div
              key={item.href}
              initial={isPremium ? { opacity: 0, x: -30, scale: 0.9 } : { opacity: 0, x: -20 }}
              animate={isPremium ? { opacity: 1, x: 0, scale: 1 } : { opacity: 1, x: 0 }}
              transition={isPremium ? { 
                delay: 0.9 + index * 0.1,
                type: "spring",
                stiffness: 200,
                damping: 20
              } : { delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                onClick={(e) => {
                  if (item.comingSoon) {
                    e.preventDefault();
                  }
                  if (onNavigate) onNavigate();
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group overflow-hidden ${
                  item.comingSoon ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl border"
                    style={{
                      background: `linear-gradient(to right, ${accentColor}33, ${accentColor}4D, ${accentColor}66)`,
                      borderColor: `${accentColor}4D`,
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {isPremium && !isActive && (
                  <motion.div
                    className="absolute inset-0"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                    style={{
                      background: `linear-gradient(to right, ${accentColor}00, ${accentColor}0D, ${accentColor}00)`,
                    }}
                  />
                )}
                <motion.div
                  whileHover={isPremium ? { rotate: [0, -5, 5, -5, 0], scale: 1.05 } : {}}
                  transition={isPremium ? { duration: 0.3 } : {}}
                >
                  <Icon
                    className={`h-5 w-5 relative z-10 transition-colors ${
                      isActive
                        ? ""
                        : "text-white/60 group-hover:text-white"
                    }`}
                    style={isActive ? { color: accentColor } : {}}
                  />
                </motion.div>
                <motion.span
                  className={`relative z-10 transition-colors ${
                    isActive
                      ? ""
                      : "text-white/60 group-hover:text-white"
                  }`}
                  style={isActive ? { color: accentColor } : {}}
                  whileHover={isPremium && !isActive ? { x: 4 } : {}}
                >
                  {item.label}
                </motion.span>
                {item.comingSoon && (
                  <motion.span
                    initial={isPremium ? { scale: 0, rotate: -180 } : false}
                    animate={isPremium ? { scale: 1, rotate: 0 } : {}}
                    transition={isPremium ? { delay: 1.5 + index * 0.1, type: "spring" } : {}}
                    className="relative z-10 ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium border"
                    style={{
                      color: `${accentColor}B3`,
                      backgroundColor: `${accentColor}1A`,
                      borderColor: `${accentColor}33`,
                    }}
                  >
                    Coming Soon
                  </motion.span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <motion.div
        initial={isPremium ? { opacity: 0, y: 20 } : false}
        animate={isPremium ? { opacity: 1, y: 0 } : {}}
        transition={isPremium ? { delay: 1.8, duration: 0.5 } : {}}
        className="p-4 border-t space-y-3"
        style={{ borderColor: `${accentColor}33` }}
      >
        {/* AI Insights Toggle - Admin Only */}
        {isAdmin && (
        <motion.button
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={togglePremium}
          className="w-full px-3 py-2 rounded-lg glass border hover:bg-white/10 transition-colors flex items-center gap-2 text-sm text-white/80 relative overflow-hidden group"
          style={{
            borderColor: showPremium ? `${accentColor}66` : 'rgba(255, 255, 255, 0.1)',
            backgroundColor: showPremium ? `${accentColor}15` : undefined,
          }}
        >
          {showPremium && (
            <motion.div
              className="absolute inset-0"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.5 }}
              style={{
                background: `linear-gradient(to right, ${accentColor}20, transparent, ${accentColor}20)`,
              }}
            />
          )}
          <motion.div
            animate={showPremium ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10"
          >
            <Brain className="h-4 w-4" style={{ color: showPremium ? accentColor : 'rgba(255, 255, 255, 0.6)' }} />
            <span className="ml-2">{showPremium ? "AI Insights ON" : "AI Insights OFF"}</span>
          </motion.div>
        </motion.button>
        )}

        {/* Theme Toggle */}
        <motion.button
          whileHover={isPremium ? { scale: 1.02, x: 4 } : {}}
          whileTap={isPremium ? { scale: 0.98 } : {}}
          onClick={toggleTheme}
          className="w-full px-3 py-2 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm text-white/80 relative overflow-hidden group"
        >
          {isPremium && (
            <motion.div
              className="absolute inset-0"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.5 }}
              style={{
                background: `linear-gradient(to right, ${accentColor}1A, transparent, ${accentColor}1A)`,
              }}
            />
          )}
          <motion.div
            animate={isPremium ? { rotate: theme === "dark" ? [0, 360] : [0, -360] } : {}}
            transition={isPremium ? { duration: 0.5 } : {}}
            className="relative z-10"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4" style={{ color: accentColor }} />
                <span className="ml-2">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" style={{ color: accentColor }} />
                <span className="ml-2">Dark Mode</span>
              </>
            )}
          </motion.div>
        </motion.button>

        <motion.div
          initial={isPremium ? { opacity: 0 } : false}
          animate={isPremium ? { opacity: 1 } : {}}
          transition={isPremium ? { delay: 1.9 } : {}}
          className="px-3 py-2 text-xs text-white/40 flex items-center justify-between"
        >
          <motion.span
            whileHover={isPremium ? { scale: 1.05 } : {}}
            className="beta-badge"
          >
            Beta
          </motion.span>
          <motion.span
            animate={isPremium ? {
              opacity: [0.3, 0.6, 0.3],
            } : {}}
            transition={isPremium ? {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            } : {}}
            className="text-white/30"
          >
            30 clients
          </motion.span>
        </motion.div>
        <motion.button
          whileHover={isPremium ? { scale: 1.02, x: 4 } : {}}
          whileTap={isPremium ? { scale: 0.98 } : {}}
          onClick={async () => {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
            sessionStorage.removeItem("business_id");
            window.location.href = "/login";
          }}
          className="w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white/60 text-left relative overflow-hidden group"
        >
          {isPremium && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-red-500/10"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.5 }}
            />
          )}
          <span className="relative z-10">Sign Out</span>
        </motion.button>
      </motion.div>
    </>
  );
}

// Premium Dashboard Content - Filters to show only performance-related content
// NOTE: This is now replaced by ChartsPage, but keeping for reference
function PremiumDashboardContent({ children }: { children: React.ReactNode }) {
  // This function is deprecated - ChartsPage is used instead
  return <ChartsPage />;
}

