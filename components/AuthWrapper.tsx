"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";
import { NotificationProvider } from "@/components/NotificationProvider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    async function checkAuth() {
      if (isLoginPage) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      // Get business_id if not in sessionStorage
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

      setLoading(false);
    }

    checkAuth();
  }, [pathname, isLoginPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <NotificationProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </NotificationProvider>
  );
}

