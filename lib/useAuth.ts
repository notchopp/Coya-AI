"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseClient();
      
      // Check session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      // Get business_id from users table using auth_user_id
      const { data: userData } = await supabase
        .from("users")
        .select("business_id, is_active, role")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      
      const bid = userData?.business_id;
      
      if (userData && userData.role) {
        sessionStorage.setItem("user_role", userData.role);
      }

      if (bid) {
        setBusinessId(bid);
        sessionStorage.setItem("business_id", bid);
      }

      setLoading(false);

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          setUser(null);
          setBusinessId(null);
          sessionStorage.removeItem("business_id");
          router.push("/login");
        } else if (session) {
          setUser(session.user);
          // Reload business_id
          const bid = session.user.user_metadata?.business_id;
          if (bid) {
            setBusinessId(bid);
            sessionStorage.setItem("business_id", bid);
          }
        }
      });
    }

    checkAuth();
  }, [router]);

  return { user, businessId, loading };
}

