/**
 * HIPAA-Compliant Audit Logging
 * Tracks all access to PHI and sensitive operations for compliance
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AuditActionType = 
  | "view" 
  | "edit" 
  | "delete" 
  | "export" 
  | "anonymize" 
  | "role_change" 
  | "invite"
  | "login"
  | "logout";

export type AuditResourceType = 
  | "call" 
  | "transcript" 
  | "patient_data" 
  | "business_info" 
  | "hours"
  | "staff"
  | "content"
  | "user" 
  | "role"
  | "settings";

export interface AuditLogEntry {
  user_id?: string;
  business_id?: string;
  action_type: AuditActionType;
  resource_type: AuditResourceType;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
}

/**
 * Log an audit event
 * Uses admin client to bypass RLS and ensure logs cannot be tampered with
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    
    // Get IP address and user agent from request if available
    const ipAddress = entry.ip_address || null;
    const userAgent = entry.user_agent || null;
    
    const { error } = await (supabaseAdmin
      .from("audit_logs") as any)
      .insert({
        user_id: entry.user_id || null,
        business_id: entry.business_id || null,
        action_type: entry.action_type,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        details: entry.details || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("❌ Failed to log audit event:", error);
      // Don't throw - audit logging should not break the application
      // But log it for monitoring
    } else {
      console.log("✅ Audit log recorded:", entry.action_type, entry.resource_type);
    }
  } catch (error) {
    console.error("❌ Error in audit logging:", error);
    // Silently fail - audit logging should not break the application
  }
}

/**
 * Log PHI access (viewing calls, transcripts, patient data)
 */
export async function logPHIAccess(
  userId: string,
  businessId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  ipAddress?: string,
  userAgent?: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    business_id: businessId,
    action_type: "view",
    resource_type: resourceType,
    resource_id: resourceId,
    ip_address: ipAddress,
    user_agent: userAgent,
    details: {
      ...additionalDetails,
      phi_accessed: true,
    },
  });
}

/**
 * Log data anonymization events
 */
export async function logAnonymization(
  userId: string,
  businessId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    business_id: businessId,
    action_type: "anonymize",
    resource_type: resourceType,
    resource_id: resourceId,
    ip_address: ipAddress,
    user_agent: userAgent,
    details: {
      reason,
      anonymized_at: new Date().toISOString(),
    },
  });
}

/**
 * Log role changes
 */
export async function logRoleChange(
  adminUserId: string,
  targetUserId: string,
  businessId: string,
  oldRole: string,
  newRole: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    user_id: adminUserId,
    business_id: businessId,
    action_type: "role_change",
    resource_type: "user",
    resource_id: targetUserId,
    ip_address: ipAddress,
    user_agent: userAgent,
    details: {
      target_user_id: targetUserId,
      old_role: oldRole,
      new_role: newRole,
    },
  });
}

/**
 * Log user invitations
 */
export async function logUserInvite(
  inviterUserId: string,
  businessId: string,
  invitedEmail: string,
  role: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    user_id: inviterUserId,
    business_id: businessId,
    action_type: "invite",
    resource_type: "user",
    ip_address: ipAddress,
    user_agent: userAgent,
    details: {
      invited_email: invitedEmail,
      assigned_role: role,
    },
  });
}

/**
 * Log business info edits (admin only operations)
 */
export async function logBusinessEdit(
  userId: string,
  businessId: string,
  resourceType: AuditResourceType,
  changes: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    business_id: businessId,
    action_type: "edit",
    resource_type: resourceType,
    resource_id: businessId,
    ip_address: ipAddress,
    user_agent: userAgent,
    details: {
      changes,
      edited_at: new Date().toISOString(),
    },
  });
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request | null): string | undefined {
  if (!request) return undefined;
  
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  return undefined;
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request | null): string | undefined {
  if (!request) return undefined;
  return request.headers.get("user-agent") || undefined;
}

