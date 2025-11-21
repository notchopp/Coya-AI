import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent, getClientIP, getUserAgent } from "@/lib/audit-log";

/**
 * API endpoint for client-side audit logging
 * Uses admin client to ensure audit logs cannot be tampered with
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      user_id,
      business_id,
      action_type,
      resource_type,
      resource_id,
      details,
    } = body;

    // Validate required fields
    if (!action_type || !resource_type) {
      return NextResponse.json(
        { error: "action_type and resource_type are required" },
        { status: 400 }
      );
    }

    // Log the audit event
    await logAuditEvent({
      user_id,
      business_id,
      action_type,
      resource_type,
      resource_id,
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
      details,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in audit log API:", error);
    return NextResponse.json(
      { error: "Failed to log audit event" },
      { status: 500 }
    );
  }
}








