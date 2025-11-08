import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Vapi webhook structure
    const message = body.message || {};
    const call = message.call || {};
    const variables = message.artifact?.variables || {};
    const analysis = message.analysis || {};
    
    // Extract key data from Vapi webhook
    const toNumber = variables?.phoneNumber?.number || call?.phoneNumber?.number || call?.to || null;
    const workflowId = call?.workflowId || variables?.id || variables?.workflowId || null;
    const callId = call?.id || message.call_id || null;
    const status = message.status || call?.status || "unknown";
    const transcript = message.artifact?.transcript || message.transcript || null;
    const summary = analysis?.summary || message.summary || null;
    const intent = analysis?.intent || message.intent || null;
    
    if (!callId) {
      console.warn("⚠️ No call_id found in webhook payload");
      return NextResponse.json(
        { success: false, error: "Missing call_id" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // 1️⃣ Lookup business by to_number or workflowId
    let business: any = null;
    
    if (toNumber) {
      const { data: businessByNumber } = await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("to_number", toNumber)
        .maybeSingle();
      
      if (businessByNumber) {
        business = businessByNumber;
      }
    }
    
    if (!business && workflowId) {
      const { data: businessById } = await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", workflowId)
        .maybeSingle();
      
      if (businessById) {
        business = businessById;
      }
    }

    if (!business) {
      console.warn("⚠️ Business not found for to_number:", toNumber, "workflowId:", workflowId);
      // Still process the call even if business not found - might be a new number
      // Return success so Vapi doesn't retry
      return NextResponse.json(
        { success: true, warning: "Business not found, call logged without business_id" },
        { status: 200 }
      );
    }

    // 2️⃣ Upsert call record
    const callData: any = {
      call_id: callId,
      business_id: business.id,
      status: status,
      last_summary: summary,
      transcript: transcript,
      last_intent: intent,
      updated_at: new Date().toISOString(),
    };

    // Add started_at if this is a new call
    if (status === "ringing" || status === "in-progress") {
      const { data: existingCall } = await supabaseAdmin
        .from("calls")
        .select("started_at")
        .eq("call_id", callId)
        .maybeSingle();
      
      const existing = existingCall as { started_at: string | null } | null;
      if (!existing || !existing.started_at) {
        callData.started_at = new Date().toISOString();
      }
    }

    // Add ended_at if call is completed
    if (status === "ended" || status === "completed" || status === "failed") {
      callData.ended_at = new Date().toISOString();
    }

    const { data: upsertedCall, error: callError } = await supabaseAdmin
      .from("calls")
      .upsert(callData as any, {
        onConflict: "call_id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (callError) {
      console.error("❌ Error upserting call:", callError);
      throw new Error(`Failed to upsert call: ${callError.message}`);
    }

    // 3️⃣ Handle call turns if present
    if (message.turns && Array.isArray(message.turns) && message.turns.length > 0) {
      const turnsToInsert = message.turns.map((turn: any, index: number) => ({
        call_id: callId,
        business_id: business.id,
        turn_number: index + 1,
        role: turn.role || turn.speaker || "unknown",
        content: turn.content || turn.text || turn.message || "",
        timestamp: turn.timestamp || new Date().toISOString(),
      }));

      const { error: turnsError } = await supabaseAdmin
        .from("call_turns")
        .upsert(turnsToInsert as any, {
          onConflict: "call_id,turn_number",
          ignoreDuplicates: false,
        });

      if (turnsError) {
        console.error("❌ Error upserting call turns:", turnsError);
        // Don't fail the whole request if turns fail
      }
    }

    // 4️⃣ Update total_turns count on call record
    if (message.turns && Array.isArray(message.turns)) {
      const { error: updateError } = await (supabaseAdmin
        .from("calls") as any)
        .update({ total_turns: message.turns.length })
        .eq("call_id", callId);

      if (updateError) {
        console.error("❌ Error updating total_turns:", updateError);
      }
    }

    // 5️⃣ Return success quickly to Vapi
    return NextResponse.json(
      { 
        success: true,
        call_id: callId,
        business_id: business.id,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ Vapi webhook error:", error);
    
    // Return 200 to prevent Vapi from retrying on our errors
    // Log the error for debugging
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 200 } // Return 200 so Vapi doesn't retry
    );
  }
}

// Handle GET requests (for health checks)
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "vapi-webhook" },
    { status: 200 }
  );
}

