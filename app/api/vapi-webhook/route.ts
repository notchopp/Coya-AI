import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Vapi webhook structure - extract all data like n8n node
    const message = body.message || {};
    const messageType = message.type || "end-of-call-report";
    const call = message.call || {};
    const customer = call.customer || {};
    const phoneNumber = message.phoneNumber || call.phoneNumber || {};
    const artifact = message.artifact || {};
    const variables = artifact.variables || {};
    const analysis = message.analysis || {};
    const structuredOutputs = artifact.structuredOutputs || {};
    
    // Extract key identifiers
    const callId = call.id || null;
    const toNumber = phoneNumber.number || variables?.phoneNumber?.number || null;
    const workflowId = call.workflowId || phoneNumber.workflowId || variables?.workflowId || null;
    
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
      return NextResponse.json(
        { success: true, warning: "Business not found, call logged without business_id" },
        { status: 200 }
      );
    }

    // 2️⃣ Extract structured outputs (like n8n node)
    const bookingDetails = structuredOutputs["281953c6-3030-4e83-933c-2643f9c85599"]?.result || {};
    const appointmentBooked = structuredOutputs["fb56b670-f706-4cb5-9c7a-aeb0b360cff5"]?.result || false;
    const appointmentRescheduled = structuredOutputs["84a71aa2-e8a3-490b-bcb0-bf6498f42d79"]?.result || false;
    const appointmentCancelled = structuredOutputs["9d00dda6-1d20-4b5c-94a7-6f841b8e402e"]?.result || false;
    const upsellOpportunity = structuredOutputs["cab290cc-887d-4f25-84c7-7ef34379975e"]?.result || false;
    const callSummary = structuredOutputs["cb78524f-7625-4bd3-a53f-cf561b5adf24"]?.result || null;

    // 3️⃣ Extract escalation data
    let escalationData: {
      forwarding_phone_number: string | null;
      destination_type: string;
      destination_number: string | null;
      transfer_message: string | null;
      transfer_mode: string | null;
      sip_verb: string | null;
      timestamp: string | null;
    } | null = null;
    if (messageType === "status-update" && message.status === "forwarding") {
      escalationData = {
        forwarding_phone_number: message.forwardingPhoneNumber || message.destination?.number || null,
        destination_type: message.destination?.type || "number",
        destination_number: message.destination?.number || null,
        transfer_message: message.destination?.message || null,
        transfer_mode: message.destination?.transferPlan?.mode || null,
        sip_verb: message.destination?.transferPlan?.sipVerb || null,
        timestamp: message.timestamp || null,
      };
    }

    // 4️⃣ Extract messages and process call turns (like n8n)
    const messages = artifact.messages || message.messages || artifact.messagesOpenAIFormatted || message.conversation || [];
    const conversationTurns: any[] = [];
    let turnCounter = 1;
    let confidenceScores: number[] = [];
    let upsellDetected = false;
    let n8nResponseBody = null;

    messages.forEach((msg: any) => {
      // Extract n8n tool response body for context
      if (msg.role === "tool_call_result" && msg.name === "n8n" && msg.metadata?.responseBody) {
        n8nResponseBody = msg.metadata.responseBody;
      }
      
      // Check for escalation in tool calls
      if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
        msg.toolCalls.forEach((toolCall: any) => {
          if (toolCall.function?.name === "untitled_tool" || 
              toolCall.function?.name?.includes("transfer") ||
              toolCall.function?.name?.includes("escalat")) {
            try {
              const args = typeof toolCall.function?.arguments === "string" 
                ? JSON.parse(toolCall.function.arguments) 
                : toolCall.function?.arguments || {};
              
              if (!escalationData) {
                escalationData = {
                  forwarding_phone_number: args.destination || args.number || args.phone || null,
                  destination_type: "number",
                  destination_number: args.destination || args.number || args.phone || null,
                  transfer_message: null,
                  transfer_mode: "blind-transfer",
                  sip_verb: "refer",
                  timestamp: msg.time || null,
                };
              }
            } catch (e) {
              if (!escalationData) {
                escalationData = {
                  forwarding_phone_number: null,
                  destination_type: "number",
                  destination_number: null,
                  transfer_message: null,
                  transfer_mode: "blind-transfer",
                  sip_verb: "refer",
                  timestamp: msg.time || null,
                };
              }
            }
          }
        });
      }
      
      // Extract confidence scores from wordLevelConfidence
      if (msg.metadata?.wordLevelConfidence && Array.isArray(msg.metadata.wordLevelConfidence)) {
        const wordConfidences = msg.metadata.wordLevelConfidence.map((w: any) => w.confidence || 0);
        const avgConfidence = wordConfidences.length > 0 
          ? wordConfidences.reduce((sum: number, conf: number) => sum + conf, 0) / wordConfidences.length 
          : null;
        if (avgConfidence !== null) {
          confidenceScores.push(avgConfidence);
        }
      }
      
      // Check for upsell indicators
      const msgText = msg.message || msg.content || "";
      if (msgText && typeof msgText === "string") {
        const lcMessage = msgText.toLowerCase();
        if (lcMessage.includes("promo") || lcMessage.includes("discount") || 
            lcMessage.includes("deal") || lcMessage.includes("special") ||
            lcMessage.includes("offer")) {
          upsellDetected = true;
        }
      }
      
      // Process user/bot messages
      const role = msg.role || "";
      if (role === "user" || role === "bot" || role === "assistant") {
        let turnConfidence = null;
        if (msg.metadata?.wordLevelConfidence && Array.isArray(msg.metadata.wordLevelConfidence)) {
          const wordConfidences = msg.metadata.wordLevelConfidence.map((w: any) => w.confidence || 0);
          turnConfidence = wordConfidences.length > 0 
            ? wordConfidences.reduce((sum: number, conf: number) => sum + conf, 0) / wordConfidences.length 
            : null;
        }
        
        conversationTurns.push({
          turn_number: turnCounter++,
          role: role === "bot" ? "assistant" : role === "user" ? "user" : "assistant",
          content: msg.message || msg.content || "",
          timestamp: msg.time ? new Date(msg.time).toISOString() : new Date().toISOString(),
          seconds_from_start: msg.secondsFromStart || msg.seconds_from_start || null,
          duration: msg.duration || null,
          end_time: msg.endTime || msg.end_time || null,
          confidence_score: turnConfidence,
        });
      }
    });

    // Calculate average confidence score
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length
      : null;

    // 5️⃣ Calculate duration
    const durationSeconds = message.durationSeconds || message.duration_seconds || 0;
    const durationMinutes = message.durationMinutes || message.duration_minutes || 0;
    const durSec = Math.round((durationMinutes * 60) + durationSeconds);

    // 6️⃣ Extract context section (business info + escalation data)
    const contextData = n8nResponseBody || variables;
    const context: any = {
      business_id: phoneNumber.workflowId || call.workflowId || contextData.id || variables.id || business.id,
      business_name: contextData.name || variables.name || business.name || null,
      business_phone: toNumber,
      services: contextData.services || variables.services || business.services || null,
      hours: contextData.hours || variables.hours || business.hours || null,
      address: contextData.address || variables.address || business.address || null,
      vertical: contextData.vertical || variables.vertical || business.vertical || null,
    };
    
    // Add escalation data to context if present
    if (escalationData) {
      context.escalation_data = escalationData;
    }

    // 7️⃣ Extract schedule section from structured outputs
    let schedule = null;
    if (appointmentBooked && bookingDetails.confirmed) {
      const appointmentDate = bookingDetails.appointmentDate || variables.requested_date;
      const appointmentTime = bookingDetails.appointmentTime || variables.requested_time;
      const serviceType = bookingDetails.serviceType || variables.service_type;
      const customerName = bookingDetails.customerName || variables.patient_name;
      const duration = bookingDetails.duration || 60;
      const notes = bookingDetails.notes || null;
      
      if (appointmentDate && appointmentTime) {
        try {
          let timeStr = appointmentTime.toString();
          if (!timeStr.includes(":")) {
            timeStr = timeStr + ":00";
          }
          const isPM = timeStr.toUpperCase().includes("PM");
          const isAM = timeStr.toUpperCase().includes("AM");
          timeStr = timeStr.replace(/[AP]M/i, "").trim();
          const [hours, minutes = "00"] = timeStr.split(":");
          let hour24 = parseInt(hours);
          if (isPM && hour24 < 12) hour24 += 12;
          if (isAM && hour24 === 12) hour24 = 0;
          
          const startDate = new Date(`${appointmentDate}T${hour24.toString().padStart(2, "0")}:${minutes}:00`);
          const endDate = new Date(startDate);
          endDate.setMinutes(endDate.getMinutes() + duration);
          
          schedule = {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            service: serviceType || null,
            summary: serviceType && customerName ? 
              `${serviceType} Appointment for ${customerName}` : 
              (notes || null),
          };
        } catch (e) {
          schedule = variables.requested_date && variables.requested_time ? {
            start: `${variables.requested_date}T${variables.requested_time}:00`,
            end: null,
            service: variables.service_type || null,
            summary: variables.patient_name && variables.service_type ? 
              `${variables.service_type} Appointment for ${variables.patient_name}` : null,
          } : null;
        }
      }
    } else if (variables.requested_date && variables.requested_time) {
      schedule = {
        start: `${variables.requested_date}T${variables.requested_time}:00`,
        end: (() => {
          try {
            const startDate = new Date(`${variables.requested_date}T${variables.requested_time}:00`);
            const endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);
            return endDate.toISOString();
          } catch (e) {
            return null;
          }
        })(),
        service: variables.service_type || null,
        summary: variables.patient_name && variables.service_type ? 
          `${variables.service_type} Appointment for ${variables.patient_name}` : null,
      };
    }

    // 8️⃣ Determine escalate and upsell booleans
    const escalate = escalationData !== null || 
                     variables.confirmation_status === "Escalated" ||
                     (analysis?.summary && analysis.summary.toLowerCase().includes("escalat"));

    const upsell = upsellOpportunity || 
                   upsellDetected || 
                   variables.confirmation_status === "Upsell" ||
                   (analysis?.summary && analysis.summary.toLowerCase().includes("upsell"));

    // 9️⃣ Determine status - ensure new calls get "in-progress" status
    let status = "in-progress"; // Default to in-progress for new/active calls
    if (messageType === "end-of-call-report") {
      status = "ended";
    } else if (messageType === "status-update") {
      status = message.status || call.status || "in-progress";
    } else if (messageType === "conversation-update") {
      const messageStatus = message.status || null;
      const callStatus = call.status || null;
      if (messageStatus === "forwarding") {
        status = "forwarding";
      } else if (messageStatus === "started" || messageStatus === "stopped") {
        // For speech updates, preserve existing status or default to in-progress
        status = callStatus || "in-progress";
      } else {
        // For new conversation updates, use in-progress if no status
        status = callStatus || messageStatus || "in-progress";
      }
    }
    
    // Ensure we never have null/undefined status for active calls
    if (!status || status === "null" || status === "undefined") {
      status = "in-progress";
    }

    // 🔟 Extract transcript
    let transcript = message.transcript || artifact.transcript || null;
    if (!transcript && conversationTurns.length > 0) {
      transcript = conversationTurns
        .map((turn: any) => {
          const role = turn.role === "user" ? "User" : turn.role === "assistant" ? "AI" : turn.role;
          return `${role}: ${turn.content}`;
        })
        .join("\n");
    }

    // 1️⃣1️⃣ Extract summary/intent
    let summary = callSummary || analysis?.summary || message.summary || null;
    
    // Extract intent from multiple sources (priority order):
    // 1. analysis.intent (direct from Vapi)
    // 2. service_type from structured outputs/variables (what user was using)
    // 3. Parse from summary if it mentions specific services
    // 4. variables.intent as fallback
    let intent = analysis?.intent || 
                 bookingDetails.serviceType || 
                 variables.service_type || 
                 variables.intent || 
                 null;
    
    // If no intent found but we have a summary, try to extract from summary
    if (!intent && summary) {
      const summaryLower = summary.toLowerCase();
      // Check if summary mentions specific intents
      if (summaryLower.includes("book") || summaryLower.includes("appointment")) {
        intent = "appointment_booking";
      } else if (summaryLower.includes("cancel")) {
        intent = "appointment_cancellation";
      } else if (summaryLower.includes("reschedule")) {
        intent = "appointment_reschedule";
      } else if (summaryLower.includes("question") || summaryLower.includes("inquire")) {
        intent = "general_inquiry";
      }
    }
    
    const successEvaluation = analysis?.successEvaluation || analysis?.success_evaluation || null;
    const success = successEvaluation === "true" || successEvaluation === true || successEvaluation === 1;

    // 1️⃣2️⃣ Extract patient/customer info
    const patientName = bookingDetails.customerName || variables.patient_name || customer.name || null;
    const phone = customer.number || variables.phone || null;
    const email = customer.email || variables.email || null;
    
    // Extract route (F1, F2, F3, F4) - check variables or analysis
    const route = variables.route || analysis?.route || null;
    
    // Extract last_variant_id and last_response if available
    const lastVariantId = variables.variant_id || analysis?.variant_id || null;
    const lastResponse = variables.last_response || analysis?.last_response || message.lastResponse || null;

    // 1️⃣3️⃣ Build comprehensive call data (matching calls table schema)
    const callData: any = {
      call_id: callId,
      business_id: business.id,
      status: status,
      to_number: toNumber,
      phone: phone,
      email: email,
      patient_name: patientName,
      transcript: transcript,
      last_summary: summary,
      last_intent: intent,
      last_confidence: avgConfidence !== null ? parseFloat(avgConfidence.toFixed(3)) : null,
      last_variant_id: lastVariantId,
      last_response: lastResponse,
      route: route,
      success: success !== null ? success : undefined,
      escalate: escalate,
      upsell: upsell,
      schedule: schedule,
      context: context,
      duration_sec: durSec > 0 ? durSec : null,
      success_evaluation: successEvaluation === "true" || successEvaluation === true || successEvaluation === 1 ? 1 : (successEvaluation === "false" || successEvaluation === false || successEvaluation === 0 ? 0 : null),
      updated_at: new Date().toISOString(),
    };

    // Handle timestamps
    if (messageType === "end-of-call-report") {
      if (message.startedAt) {
        callData.started_at = new Date(message.startedAt).toISOString();
      }
      if (message.endedAt) {
        callData.ended_at = new Date(message.endedAt).toISOString();
      }
    } else if (messageType === "status-update") {
      if (message.status === "in-progress" || status === "in-progress") {
        const { data: existingCall } = await supabaseAdmin
          .from("calls")
          .select("started_at")
          .eq("call_id", callId)
          .maybeSingle();
        
        const existing = existingCall as { started_at: string | null } | null;
        if (!existing || !existing.started_at) {
          callData.started_at = new Date().toISOString();
          console.log("📞 New call created (status-update):", callId);
        }
      }
    } else if (messageType === "conversation-update") {
      const messageStatus = message.status || null;
      // Always check if call exists and set started_at if it's a new call
      const { data: existingCall } = await supabaseAdmin
        .from("calls")
        .select("started_at, status")
        .eq("call_id", callId)
        .maybeSingle();
      
      const existing = existingCall as { started_at: string | null; status: string | null } | null;
      if (!existing || !existing.started_at) {
        // New call - set started_at immediately
        callData.started_at = new Date().toISOString();
        console.log("📞 New call created (conversation-update):", callId, "status:", status);
      } else if (existing.started_at && !callData.ended_at) {
        // Existing active call - ensure status is set correctly
        if (!status || status === "ended") {
          status = existing.status || "in-progress";
        }
      }
      
      // For speech updates, preserve status
      if (messageStatus === "started" || messageStatus === "stopped") {
        delete callData.status;
      }
    }

    // 1️⃣4️⃣ Upsert call record
    let upsertedCall: any = null;
    let callError: any = null;
    
    if (message.status === "started" || message.status === "stopped") {
      // Partial update for speech updates
      const updateData: any = {
        updated_at: callData.updated_at,
      };
      if (callData.transcript) updateData.transcript = callData.transcript;
      if (callData.last_summary) updateData.last_summary = callData.last_summary;
      if (callData.last_intent) updateData.last_intent = callData.last_intent;
      
      const { data, error } = await (supabaseAdmin
        .from("calls") as any)
        .update(updateData)
        .eq("call_id", callId)
        .select()
        .single();
      
      upsertedCall = data;
      callError = error;
    } else {
      // Full upsert
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

    // 1️⃣5️⃣ Handle call turns - store conversation in transcript_json
    if (conversationTurns.length > 0) {
      console.log(`💬 Processing ${conversationTurns.length} conversation turns`);
      
      const callTurnData: any = {
        call_id: callId,
        transcript_json: conversationTurns,
        total_turns: conversationTurns.length,
        updated_at: new Date().toISOString(),
      };
      
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
        // Update total_turns in calls table
        const { error: updateError } = await (supabaseAdmin
          .from("calls") as any)
          .update({ total_turns: conversationTurns.length })
          .eq("call_id", callId);

        if (updateError) {
          console.error("❌ Error updating total_turns:", updateError);
        }
      }
    }

    // 1️⃣6️⃣ Return success response
    const response: any = {
      success: true,
      call_id: callId,
      business_id: business.id,
      message_type: messageType,
      status: status,
    };
    
    if (business) {
      response.business = {
        id: business.id,
        name: business.name || null,
      };
    }
    
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error("❌ Vapi webhook error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 200 }
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
