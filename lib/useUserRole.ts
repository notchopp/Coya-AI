"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export type UserRole = "owner" | "admin" | "user" | null;

/**
 * Hook to get the current user's role
 */
export function useUserRole(): { role: UserRole; loading: boolean } {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      const supabase = getSupabaseClient();
      const authUser = (await supabase.auth.getUser()).data.user;
      
      if (!authUser) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (userData && (userData as any).role) {
        setRole((userData as any).role as UserRole);
      } else {
        setRole("user"); // Default to user if no role found
      }
      
      setLoading(false);
    }

    fetchUserRole();
  }, []);

  return { role, loading };
}

/**
 * Check if user is admin
 */
export function useIsAdmin(): boolean {
  const { role } = useUserRole();
  return role === "admin";
}

