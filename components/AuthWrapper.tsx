"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import { NotificationProvider } from "@/components/NotificationProvider";
import { BarChart3, LogOut, Menu } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";
import { useProgram } from "@/components/ProgramProvider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPrograms, programId, loading: programLoading } = useProgram();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const isLoginPage = pathname === "/login";
  const isSignupPage = pathname === "/signup";
  const isAuthCallback = pathname === "/auth/callback";
  const isSelectProgramPage = pathname === "/select-program";
  const isDemoDashboard = pathname === "/demo-dashboard";
  const isOnboardingPage = pathname.startsWith("/onboarding");

  useEffect(() => {
    async function checkAuth() {
      if (isLoginPage || isSignupPage || isAuthCallback || isDemoDashboard || isOnboardingPage) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      // Check if user is superior admin (whochoppa@gmail.com or specific user ID)
      const userEmail = session.user.email?.toLowerCase();
      const userId = session.user.id;
      const isSuperiorAdmin = userEmail === "whochoppa@gmail.com" || userId === "9c0e8c58-8a36-47e9-aa68-909b22b4443f";
      setIsAdmin(isSuperiorAdmin);
      
      if (isSuperiorAdmin) {
        // Superior admin - skip users table check, redirect to ops if on regular pages
        console.log("✅ Superior admin detected:", userEmail);
        if (pathname !== "/ops" && pathname !== "/login" && pathname !== "/auth/callback") {
          router.push("/ops");
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      // Regular users - need users table record with business_id
      const storedBusinessId = sessionStorage.getItem("business_id");
      
      if (!storedBusinessId) {
        console.log("🔄 Loading business_id from users table...");
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("business_id, is_active, role")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (userError) {
          console.error("❌ Error loading user data:", userError);
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }

        if (userData && userData.is_active) {
          console.log("✅ User found, business_id:", userData.business_id);
          sessionStorage.setItem("business_id", userData.business_id);
          if (userData.role) {
            sessionStorage.setItem("user_role", userData.role);
          }
        } else {
          console.error("❌ User not found or inactive");
          // User not found or inactive, sign out
          await supabase.auth.signOut();
          sessionStorage.removeItem("business_id");
          sessionStorage.removeItem("user_role");
          router.push("/login");
          return;
        }
      } else {
        console.log("✅ Using stored business_id:", storedBusinessId);
      }

      // Check onboarding status (only for regular users, not super admin)
      if (!isAdmin && storedBusinessId) {
        const result = await supabase
          .from("businesses")
          .select("onboarding_completed_at, onboarding_step")
          .eq("id", storedBusinessId)
          .maybeSingle();

        const businessData = result.data as {
          onboarding_completed_at: string | null;
          onboarding_step: number | null;
        } | null;

        // If onboarding not completed and not already on onboarding page, redirect
        if (businessData && !businessData.onboarding_completed_at) {
          const isOnboardingPage = pathname.startsWith("/onboarding");
          if (!isOnboardingPage) {
            const { getStepRoute } = await import("@/lib/onboarding");
            const step = (businessData.onboarding_step || 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const onboardingRoute = getStepRoute(step);
            console.log("🔄 Redirecting to onboarding:", onboardingRoute);
            router.push(onboardingRoute);
            setLoading(false);
            return;
          }
        }
      }

      // Check if business has programs and user needs to select one
      if (!isSelectProgramPage && !isAdmin) {
        const storedProgramId = sessionStorage.getItem("program_id");
        
        // First check if business has a default program_id
        if (!storedProgramId && storedBusinessId) {
          const { data: businessData } = await supabase
            .from("businesses")
            .select("program_id")
            .eq("id", storedBusinessId)
            .maybeSingle();
          
          if (businessData && (businessData as any).program_id) {
            // Auto-set program from business.program_id
            const businessProgramId = (businessData as any).program_id;
            sessionStorage.setItem("program_id", businessProgramId);
            console.log("✅ Auto-selected program from business:", businessProgramId);
            setLoading(false);
            return;
          }
        }
        
        // If still no program_id, check if business has multiple programs
        if (!storedProgramId) {
          const query = (supabase as any).from("programs");
          const { data: programs } = await query
            .select("id")
            .eq("business_id", storedBusinessId || "")
            .limit(1);

          const hasPrograms = (programs?.length || 0) > 0;

          // If business has programs but no program selected, redirect to select-program
          if (hasPrograms) {
            router.push("/select-program");
            setLoading(false);
            return;
          }
        }
      }

      setLoading(false);
    }

    checkAuth();
  }, [pathname, isLoginPage, isSelectProgramPage, isOnboardingPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  if (isLoginPage || isSignupPage || isAuthCallback || isSelectProgramPage || isDemoDashboard || isOnboardingPage) {
    return <>{children}</>;
  }

  // Admin user gets custom layout
  if (isAdmin) {
    return (
      <NotificationProvider>
        <AdminLayout>{children}</AdminLayout>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </NotificationProvider>
  );
}

// Custom Admin Layout - Only shows Operations
function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accentColor } = useAccentColor();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    sessionStorage.clear();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden relative">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}
        <div className={`fixed inset-y-0 left-0 z-50 w-[280px] glass-strong border-r transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`} style={{ borderColor: `${accentColor}33` }}>
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
                COYA AI
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                ADMIN
              </span>
            </div>
            <p className="text-white/60 text-sm">Operations Dashboard</p>
          </div>
          <nav className="p-4">
            <button
              onClick={() => { router.push("/ops"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === "/ops"
                  ? "bg-white/10"
                  : "hover:bg-white/5"
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>Operations</span>
            </button>
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-red-400"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r glass-strong relative z-10" style={{ borderColor: `${accentColor}33` }}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
              COYA AI
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
              ADMIN
            </span>
          </div>
          <p className="text-white/60 text-sm">Operations Dashboard</p>
        </div>
        <nav className="p-4 flex-1">
          <button
            onClick={() => router.push("/ops")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === "/ops"
                ? "bg-white/10"
                : "hover:bg-white/5"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Operations</span>
          </button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-red-400"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b glass-strong" style={{ borderColor: `${accentColor}33` }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
          <div className="text-lg font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
            COYA AI ADMIN
          </div>
          <div className="w-9" /> {/* Spacer */}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

