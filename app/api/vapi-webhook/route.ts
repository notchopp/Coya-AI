import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Vapi webhook structure - actual format from logs
    const message = body.message || {};
    const messageType = message.type || "unknown";
    const call = message.call || {};
    const phoneNumber = message.phoneNumber || {};
    const artifact = message.artifact || {};
    const variables = artifact.variables || {};
    const analysis = message.analysis || {};
    
    // Extract key data from Vapi webhook
    const callId = call.id || null;
    const toNumber = phoneNumber.number || variables?.phoneNumber?.number || null;
    const workflowId = call.workflowId || phoneNumber.workflowId || variables?.workflowId || null;
    
    // Extract status from message.status (for conversation-update) or call.status
    // message.status can be: in-progress, forwarding, started, stopped (may not always be present)
    // call.status can be: ringing, in-progress, ended, completed, failed
    const messageStatus = message.status || null;
    const callStatus = call.status || null;
    
    // Determine final status based on message type and status
    // status-update is the FIRST webhook that fires (with in-progress status)
    // conversation-update sends speech/transcript data
    // end-of-call-report is the final webhook
    let status = "unknown";
    if (messageType === "end-of-call-report") {
      status = "ended";
    } else if (messageType === "status-update") {
      // status-update is the FIRST webhook - use message.status directly
      // This fires before conversation-update
      status = messageStatus || callStatus || "in-progress";
    } else if (messageType === "conversation-update") {
      // conversation-update may or may not have message.status
      if (messageStatus) {
        // If message.status exists, use it
        if (messageStatus === "in-progress") {
          status = "in-progress";
        } else if (messageStatus === "forwarding") {
          status = "forwarding";
        } else if (messageStatus === "started" || messageStatus === "stopped") {
          // started/stopped are speech updates - keep existing call status
          status = callStatus || "in-progress";
        } else {
          status = messageStatus;
        }
      } else {
        // No message.status - use call.status
        // If call.status is "ringing", treat as "in-progress" (first webhook)
        if (callStatus === "ringing") {
          status = "in-progress";
        } else {
          status = callStatus || "in-progress";
        }
      }
    } else {
      status = callStatus || "unknown";
    }
    
    // Extract transcript - handle both conversation-update and end-of-call-report
    // conversation-update is what sends speech/transcript data
    let transcript: string | null = null;
    let conversation: any[] = [];
    
    if (messageType === "end-of-call-report") {
      // End-of-call-report has transcript already formatted
      transcript = message.transcript || artifact.transcript || null;
      // Also extract conversation from artifact.messages if available
      conversation = artifact.messagesOpenAIFormatted || artifact.messages || [];
    } else if (messageType === "conversation-update") {
      // conversation-update sends speech/transcript data
      // Try multiple sources for conversation data (in priority order)
      conversation = message.conversation || artifact.messagesOpenAIFormatted || artifact.messages || message.messages || [];
      
      // Build transcript from conversation array
      // Filter out tool calls and only include user/assistant messages with content
      if (conversation.length > 0) {
        const validMessages = conversation.filter((msg: any) => {
          // Include user and assistant messages with content
          // Exclude tool, tool_calls, tool_call_result roles
          if (msg.role === "user" || msg.role === "assistant") {
            return msg.content && msg.content.trim().length > 0;
          }
          return false;
        });
        
        if (validMessages.length > 0) {
          transcript = validMessages
            .map((msg: any) => {
              const role = msg.role === "user" ? "User" : msg.role === "assistant" ? "AI" : msg.role;
              return `${role}: ${msg.content}`;
            })
            .join('\n');
        }
      }
      
      // If no conversation array, try to get transcript from artifact
      if (!transcript && artifact.transcript) {
        transcript = artifact.transcript;
      }
      
      // Also try building from message.messages if available (has bot/user messages)
      if (!transcript && message.messages && Array.isArray(message.messages)) {
        const speechMessages = message.messages
          .filter((msg: any) => {
            return (msg.role === "bot" || msg.role === "user") && msg.message && msg.message.trim().length > 0;
          })
          .map((msg: any) => {
            const role = msg.role === "bot" ? "AI" : msg.role === "user" ? "User" : msg.role;
            return `${role}: ${msg.message}`;
          });
        
        if (speechMessages.length > 0) {
          transcript = speechMessages.join('\n');
        }
      }
    }
    
    // Extract summary/intent from analysis if present
    let summary = analysis?.summary || message.summary || null;
    const intent = analysis?.intent || null;
    
    // Extract success evaluation from end-of-call-report
    const successEvaluation = analysis?.successEvaluation || null;
    const success = successEvaluation === "true" || successEvaluation === true;
    
    // Extract structured outputs from end-of-call-report for additional summary
    if (messageType === "end-of-call-report" && artifact.structuredOutputs) {
      const structuredOutputs = artifact.structuredOutputs;
      // Extract call summary from structured outputs if main summary is missing
      const callSummary = structuredOutputs["cb78524f-7625-4bd3-a53f-cf561b5adf24"]?.result;
      if (callSummary && !summary) {
        summary = callSummary;
      }
    }
    
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
      success: success !== null ? success : undefined,
      updated_at: new Date().toISOString(),
    };

    // Handle timestamps based on message type and status
    if (messageType === "end-of-call-report") {
      // End-of-call-report has explicit timestamps
      if (message.startedAt) {
        callData.started_at = new Date(message.startedAt).toISOString();
      }
      if (message.endedAt) {
        callData.ended_at = new Date(message.endedAt).toISOString();
      }
    } else if (messageType === "status-update") {
      // status-update is the FIRST webhook that fires (with in-progress status)
      // This creates the call record
      if (messageStatus === "in-progress" || status === "in-progress") {
        const { data: existingCall } = await supabaseAdmin
          .from("calls")
          .select("started_at")
          .eq("call_id", callId)
          .maybeSingle();
        
        const existing = existingCall as { started_at: string | null } | null;
        if (!existing || !existing.started_at) {
          // This is a new call - set started_at
          callData.started_at = new Date().toISOString();
          console.log("📞 New call created (status-update):", callId, "for business:", business.id);
        }
      } else if (messageStatus === "forwarding") {
        // Call is being transferred
        console.log("📞 Call forwarding (status-update):", callId);
      }
    } else if (messageType === "conversation-update") {
      // conversation-update: handle different statuses
      // Note: message.status may not always be present, so we check both messageStatus and callStatus
      const isInProgress = messageStatus === "in-progress" || (!messageStatus && callStatus === "ringing");
      const isForwarding = messageStatus === "forwarding";
      const isSpeechUpdate = messageStatus === "started" || messageStatus === "stopped";
      
      if (isInProgress) {
        // in-progress or ringing - check if call already exists (status-update may have created it)
        const { data: existingCall } = await supabaseAdmin
          .from("calls")
          .select("started_at")
          .eq("call_id", callId)
          .maybeSingle();
        
        const existing = existingCall as { started_at: string | null } | null;
        if (!existing || !existing.started_at) {
          // Call doesn't exist yet - create it (status-update might not have fired)
          callData.started_at = new Date().toISOString();
          console.log("📞 New call created (conversation-update):", callId, "for business:", business.id);
        }
      } else if (isForwarding) {
        // Call is being transferred - update status but don't change timestamps
        console.log("📞 Call forwarding:", callId);
      } else if (isSpeechUpdate) {
        // Speech updates - don't change call status or timestamps
        // These are just speech state changes, not call state changes
        console.log("🗣️ Speech update:", messageStatus, "for call:", callId);
        // Don't update status for these - keep existing call status
        // We'll update transcript and other data, but preserve the call status
        delete callData.status; // Remove status from update to preserve existing
      } else {
        // No specific status - check if this is a new call
        const { data: existingCall } = await supabaseAdmin
          .from("calls")
          .select("started_at")
          .eq("call_id", callId)
          .maybeSingle();
        
        const existing = existingCall as { started_at: string | null } | null;
        if (!existing || !existing.started_at) {
          // This might be the first webhook without explicit status
          callData.started_at = new Date().toISOString();
          console.log("📞 New call created (no status):", callId, "for business:", business.id);
        }
      }
    }

    // For started/stopped, we still want to update transcript but not status
    // So we do a partial update instead of full upsert
    let upsertedCall: any = null;
    let callError: any = null;
    
    if (messageStatus === "started" || messageStatus === "stopped") {
      // For speech updates (conversation-update with started/stopped),
      // update transcript and conversation data but preserve call status
      // conversation-update sends speech data, so we always want to save it
      const updateData: any = {
        updated_at: callData.updated_at,
      };
      
      // Always update transcript if we have it (conversation-update sends speech)
      if (callData.transcript) {
        updateData.transcript = callData.transcript;
      }
      
      // Update summary/intent if available
      if (callData.last_summary) {
        updateData.last_summary = callData.last_summary;
      }
      if (callData.last_intent) {
        updateData.last_intent = callData.last_intent;
      }
      
      console.log(`💬 Speech update (${messageStatus}): Updating transcript for call ${callId}`);
      
      const { data, error } = await (supabaseAdmin
        .from("calls") as any)
        .update(updateData)
        .eq("call_id", callId)
        .select()
        .single();
      
      upsertedCall = data;
      callError = error;
    } else {
      // For all other statuses, do full upsert
      const { data, error } = await supabaseAdmin
        .from("calls")
        .upsert(callData as any, {
          onConflict: "call_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();
      
      upsertedCall = data;
      callError = error;
    }

    if (callError) {
      console.error("❌ Error upserting call:", callError);
      throw new Error(`Failed to upsert call: ${callError.message}`);
    }

    // 3️⃣ Handle call turns - store conversation in transcript_json (single row per call_id)
    // call_turns table has: call_id (unique), transcript_json (jsonb), total_turns, to_number
    let conversationTurns: any[] = [];
    
    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      // Process conversation array (has role/content structure)
      conversationTurns = conversation
        .filter((msg: any) => {
          // Filter valid messages (user/assistant with content)
          // Exclude tool, tool_calls, tool_call_result
          if (msg.role === "user" || msg.role === "assistant") {
            return msg.content && msg.content.trim().length > 0;
          }
          return false;
        })
        .map((msg: any, index: number) => ({
          turn_number: index + 1,
          role: msg.role === "user" ? "user" : msg.role === "assistant" ? "assistant" : "unknown",
          content: msg.content || "",
          timestamp: msg.time ? new Date(msg.time).toISOString() : new Date().toISOString(),
        }));
    }
    
    // Also process message.messages if available (has bot/user with message field)
    if (messageType === "conversation-update" && message.messages && Array.isArray(message.messages) && conversationTurns.length === 0) {
      conversationTurns = message.messages
        .filter((msg: any) => {
          // Filter valid bot/user messages with message field
          if (msg.role === "bot" || msg.role === "user") {
            return msg.message && msg.message.trim().length > 0;
          }
          return false;
        })
        .map((msg: any, index: number) => ({
          turn_number: index + 1,
          role: msg.role === "bot" ? "assistant" : msg.role === "user" ? "user" : "unknown",
          content: msg.message || "",
          timestamp: msg.time ? new Date(msg.time).toISOString() : new Date().toISOString(),
        }));
    }
    
    if (conversationTurns.length > 0) {
      console.log(`💬 Processing ${conversationTurns.length} conversation turns from ${messageType}`);
      
      // Upsert single row per call_id with transcript_json
      const callTurnData: any = {
        call_id: callId,
        transcript_json: conversationTurns,
        total_turns: conversationTurns.length,
        updated_at: new Date().toISOString(),
      };
      
      // Add to_number if we have it
      if (toNumber) {
        callTurnData.to_number = toNumber;
      }
      
      const { error: turnsError } = await supabaseAdmin
        .from("call_turns")
        .upsert(callTurnData as any, {
          onConflict: "call_id",
          ignoreDuplicates: false,
        });

      if (turnsError) {
        console.error("❌ Error upserting call turns:", turnsError);
      } else {
        // Also update total_turns in calls table
        const { error: updateError } = await (supabaseAdmin
          .from("calls") as any)
          .update({ total_turns: conversationTurns.length })
          .eq("call_id", callId);

        if (updateError) {
          console.error("❌ Error updating total_turns in calls table:", updateError);
        }
      }
    }
    
    // 4️⃣ Extract structured outputs from end-of-call-report (e.g., booking details)
    if (messageType === "end-of-call-report" && artifact.structuredOutputs) {
      const structuredOutputs = artifact.structuredOutputs;
      
      // Extract booking details if available
      const bookingDetails = structuredOutputs["281953c6-3030-4e83-933c-2643f9c85599"]?.result;
      if (bookingDetails) {
        // Log booking details - you can store these in a separate table or as JSON
        console.log("📅 Booking details extracted:", JSON.stringify(bookingDetails));
      }
    }

    // 5️⃣ Return success response to Vapi with full business context
    // Vapi can use this business context data if needed
    const response: any = {
      success: true,
      call_id: callId,
      business_id: business.id,
      message_type: messageType,
      status: status,
    };
    
    // Include full business context for Vapi to use
    if (business) {
      response.business = {
        id: business.id,
        name: business.name || null,
        vertical: business.vertical || null,
        address: business.address || null,
        hours: business.hours || null,
        services: business.services || null,
        insurances: business.insurances || null,
        staff: business.staff || null,
        faqs: business.faqs || null,
        promos: business.promos || null,
        to_number: business.to_number || null,
      };
    }
    
    return NextResponse.json(response, { status: 200 });

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

