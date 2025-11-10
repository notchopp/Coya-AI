"use client";

import { useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { AuditResourceType } from "@/lib/audit-log";

/**
 * Client-side hook for audit logging
 * Note: This calls an API endpoint since audit logging requires admin privileges
 */
export function useAuditLog() {
  const logPHIAccessClient = useCallback(async (
    resourceType: AuditResourceType,
    resourceId: string,
    additionalDetails?: Record<string, any>
  ) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) return;

      // Get user and business info
      const { data: userData } = await supabase
        .from("users")
        .select("id, business_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (!userData) return;

      const userId = (userData as any).id;
      const businessId = (userData as any).business_id;

      // Call API endpoint for audit logging
      await fetch("/api/audit-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          business_id: businessId,
          action_type: "view",
          resource_type: resourceType,
          resource_id: resourceId,
          details: {
            ...additionalDetails,
            phi_accessed: true,
          },
        }),
      });
    } catch (error) {
      console.error("Failed to log PHI access:", error);
      // Don't throw - audit logging should not break the UI
    }
  }, []);

  const logBusinessEditClient = useCallback(async (
    resourceType: AuditResourceType,
    changes: Record<string, any>
  ) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id, business_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (!userData) return;

      const userId = (userData as any).id;
      const businessId = (userData as any).business_id;

      await fetch("/api/audit-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          business_id: businessId,
          action_type: "edit",
          resource_type: resourceType,
          resource_id: businessId,
          details: {
            changes,
            edited_at: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error("Failed to log business edit:", error);
    }
  }, []);

  return {
    logPHIAccess: logPHIAccessClient,
    logBusinessEdit: logBusinessEditClient,
  };
}

