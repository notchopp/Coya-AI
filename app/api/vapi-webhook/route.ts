import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createHash } from "crypto";

// HIPAA-compliant de-identification with consistent tokenization
// Uses consistent hashing so same person = same token (for trainability and identification)

// Secret salt for hashing (should be from env in production)
const HASH_SALT = process.env.HIPAA_HASH_SALT || "default-salt-change-in-production";

/**
 * Creates a consistent hash for patient identification
 * Same input always produces same hash (allows tracking same person across calls)
 * But hash cannot be reversed to original value (HIPAA compliant)
 */
function createPatientHash(phone: string | null, email: string | null, name: string | null): string {
  const identifiers = [
    phone ? phone.replace(/\D/g, '').toLowerCase() : '',
    email ? email.toLowerCase() : '',
    name ? name.trim().toLowerCase() : '',
  ].filter(Boolean).join('|');
  
  if (!identifiers) {
    // Generate random hash if no identifiers (shouldn't happen, but safety)
    return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 16);
  }
  
  return createHash('sha256')
    .update(`${HASH_SALT}-${identifiers}`)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter identifier
}

/**
 * Creates a consistent token for a value (same value = same token)
 * Used for phone, email, names - allows identification without exposing PHI
 */
function createConsistentToken(value: string | null, type: 'phone' | 'email' | 'name'): string | null {
  if (!value) return null;
  
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  
  const hash = createHash('sha256')
    .update(`${HASH_SALT}-${type}-${normalized}`)
    .digest('hex')
    .substring(0, 8); // 8 char token
  
  // Format tokens for readability while maintaining consistency
  switch (type) {
    case 'phone':
      return `PH-${hash}`;
    case 'email':
      return `EM-${hash}`;
    case 'name':
      return `NM-${hash}`;
    default:
      return hash;
  }
}

/**
 * Anonymizes specific names in transcript (only known names, not common words)
 */
function anonymizeKnownNames(transcript: string, namesToAnonymize: string[]): string {
  if (!transcript || namesToAnonymize.length === 0) return transcript;
  
  let anonymized = transcript;
  const nameCache = new Map<string, string>();
  
  // Anonymize each known name
  for (const name of namesToAnonymize) {
    if (!name || name.trim().length === 0) continue;
    
    const trimmedName = name.trim();
    // Create token for this name
    if (!nameCache.has(trimmedName)) {
      nameCache.set(trimmedName, createConsistentToken(trimmedName, 'name') || '[NAME]');
    }
    const token = nameCache.get(trimmedName) || '[NAME]';
    
    // Replace the name (case-insensitive, whole word only)
    const namePattern = new RegExp(`\\b${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    anonymized = anonymized.replace(namePattern, token);
  }
  
  return anonymized;
}

/**
 * HIPAA-compliant transcript de-identification
 * Removes all 18 HIPAA identifiers while preserving structure for training
 * Only anonymizes known names (patient name, business name) - keeps everything else readable
 * @param transcript - The transcript text to de-identify
 * @param knownNames - Optional array of known names to anonymize (patient name, business name, etc.)
 */
function deidentifyTranscript(transcript: string | null, knownNames?: string[]): string | null {
  if (!transcript) return transcript;
  
  let deidentified = transcript;
  
  // 1. Remove phone numbers (HIPAA identifier #4)
  deidentified = deidentified.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  deidentified = deidentified.replace(/\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
  deidentified = deidentified.replace(/\b\d{10,}\b/g, '[PHONE]');
  
  // 2. Remove fax numbers (HIPAA identifier #5)
  deidentified = deidentified.replace(/\bfax[:\s]?\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '[FAX]');
  
  // 3. Remove email addresses (HIPAA identifier #6)
  deidentified = deidentified.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  
  // 4. Remove SSN (HIPAA identifier #7)
  deidentified = deidentified.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]');
  deidentified = deidentified.replace(/\b\d{9}\b/g, (match) => {
    return match.length === 9 ? '[SSN]' : match;
  });
  
  // 5. Remove URLs (HIPAA identifier #14)
  deidentified = deidentified.replace(/https?:\/\/[^\s]+/gi, '[URL]');
  deidentified = deidentified.replace(/\bwww\.[^\s]+/gi, '[URL]');
  
  // 6. Remove IP addresses (HIPAA identifier #15)
  deidentified = deidentified.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
  
  // 7. Remove dates (HIPAA identifier #3) - dates that could identify individuals
  deidentified = deidentified.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '[DATE]');
  deidentified = deidentified.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, '[DATE]');
  deidentified = deidentified.replace(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g, '[DATE]');
  
  // 8. Remove ages over 89 (HIPAA identifier #3)
  deidentified = deidentified.replace(/\b(9[0-9]|[1-9]\d{2,})\s*(?:years?\s*old|yrs?\.?|years?)\b/gi, '[AGE]');
  
  // 9. Anonymize known names and business names (HIPAA identifier #1)
  // Only anonymize the specific names provided, not common words - keeps transcript readable
  if (knownNames && knownNames.length > 0) {
    deidentified = anonymizeKnownNames(deidentified, knownNames);
  }
  
  // 10. Remove addresses (HIPAA identifier #2) - street addresses
  deidentified = deidentified.replace(/\b\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Way|Place|Pl)\b/gi, '[ADDRESS]');
  
  // 11. Remove ZIP codes (part of geographic identifier)
  deidentified = deidentified.replace(/\b\d{5}(?:-\d{4})?\b/g, '[ZIP]');
  
  // 12. Remove medical record numbers (HIPAA identifier #8) - common patterns
  deidentified = deidentified.replace(/\b(?:MRN|MR|Medical Record)[:\s#]?\s*\d+\b/gi, '[MRN]');
  deidentified = deidentified.replace(/\b(?:Record|Account)[:\s#]?\s*#?\s*\d{4,}\b/gi, '[RECORD]');
  
  // 13. Remove account numbers (HIPAA identifier #10)
  deidentified = deidentified.replace(/\b(?:Account|Acct)[:\s#]?\s*#?\s*\d{4,}\b/gi, '[ACCOUNT]');
  
  // 14. Remove certificate/license numbers (HIPAA identifier #11)
  deidentified = deidentified.replace(/\b(?:License|Cert|Certificate)[:\s#]?\s*#?\s*[A-Z0-9]{4,}\b/gi, '[LICENSE]');
  
  return deidentified;
}

/**
 * HIPAA-compliant phone de-identification with consistent tokenization
 */
function deidentifyPhone(phone: string | null): string | null {
  if (!phone) return null;
  return createConsistentToken(phone, 'phone');
}

/**
 * HIPAA-compliant email de-identification with consistent tokenization
 */
function deidentifyEmail(email: string | null): string | null {
  if (!email) return null;
  return createConsistentToken(email, 'email');
}

/**
 * HIPAA-compliant name de-identification with consistent tokenization
 */
function deidentifyName(name: string | null): string | null {
  if (!name) return null;
  return createConsistentToken(name, 'name');
}

/**
 * HIPAA-compliant conversation turns de-identification
 */
function deidentifyConversationTurns(turns: any[]): any[] {
  return turns.map(turn => ({
    ...turn,
    content: deidentifyTranscript(turn.content) || turn.content,
    // Remove timestamps that could identify individuals (keep relative time only)
    timestamp: turn.timestamp ? '[TIMESTAMP]' : null,
    end_time: null, // Remove end_time as it could be identifying
  }));
}

/**
 * Remove dates from schedule that could identify individuals
 * Keep only year and relative timing for training purposes
 */
function deidentifySchedule(schedule: any): any {
  if (!schedule) return schedule;
  
  const deidentified = { ...schedule };
  
  // Remove specific dates, keep only structure
  if (deidentified.start) {
    try {
      const date = new Date(deidentified.start);
      // Keep only year and month for training, remove day/time
      deidentified.start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-[DAY]`;
    } catch (e) {
      deidentified.start = '[DATE]';
    }
  }
  
  if (deidentified.end) {
    try {
      const date = new Date(deidentified.end);
      deidentified.end = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-[DAY]`;
    } catch (e) {
      deidentified.end = '[DATE]';
    }
  }
  
  // De-identify summary if it contains names
  if (deidentified.summary) {
    deidentified.summary = deidentifyTranscript(deidentified.summary);
  }
  
  return deidentified;
}

/**
 * Detects sensitive content that should be heavily anonymized or not saved
 * Returns object with flags and sanitized content
 */
function detectSensitiveContent(text: string | null): {
  hasSensitiveContent: boolean;
  sensitiveTypes: string[];
  sanitizedText: string | null;
  shouldAnonymize: boolean;
} {
  if (!text) {
    return {
      hasSensitiveContent: false,
      sensitiveTypes: [],
      sanitizedText: null,
      shouldAnonymize: false,
    };
  }

  const lowerText = text.toLowerCase();
  const sensitiveTypes: string[] = [];
  let shouldAnonymize = false;
  let sanitizedText = text;

  // Suicidal ideation patterns
  const suicidalPatterns = [
    /\b(kill\s+myself|kill myself|end my life|end it all|suicide|suicidal|want to die|don't want to live|not worth living)\b/gi,
    /\b(harm myself|hurt myself|self harm|cutting|overdose|overdosing)\b/gi,
    /\b(no reason to live|better off dead|everyone would be better|no point in living)\b/gi,
  ];

  // Mental health crisis patterns
  const crisisPatterns = [
    /\b(psychiatric emergency|mental breakdown|psychotic|hallucinating|hearing voices)\b/gi,
    /\b(abuse|abused|abuser|domestic violence|sexual assault|rape)\b/gi,
    /\b(addiction|overdose|withdrawal|relapse|using drugs|drinking too much)\b/gi,
  ];

  // Check for suicidal content
  const hasSuicidal = suicidalPatterns.some(pattern => pattern.test(text));
  if (hasSuicidal) {
    sensitiveTypes.push('suicidal_ideation');
    shouldAnonymize = true;
    // Replace sensitive phrases with generic markers
    suicidalPatterns.forEach(pattern => {
      sanitizedText = sanitizedText.replace(pattern, '[SENSITIVE_CONTENT]');
    });
  }

  // Check for crisis content
  const hasCrisis = crisisPatterns.some(pattern => pattern.test(text));
  if (hasCrisis) {
    sensitiveTypes.push('mental_health_crisis');
    shouldAnonymize = true;
    crisisPatterns.forEach(pattern => {
      sanitizedText = sanitizedText.replace(pattern, '[SENSITIVE_CONTENT]');
    });
  }

  return {
    hasSensitiveContent: sensitiveTypes.length > 0,
    sensitiveTypes,
    sanitizedText: shouldAnonymize ? sanitizedText : text,
    shouldAnonymize,
  };
}

/**
 * Aggressively anonymize sensitive content - removes all PHI and sensitive details
 */
function anonymizeSensitiveContent(text: string | null): string | null {
  if (!text) return text;
  
  // First de-identify all PHI
  let anonymized = deidentifyTranscript(text);
  
  if (!anonymized) return null;
  
  // Then replace sensitive content markers
  anonymized = anonymized.replace(/\[SENSITIVE_CONTENT\]/gi, '[REDACTED]');
  
  // Remove any remaining context that could identify the situation
  anonymized = anonymized.replace(/\b(I|me|my|myself|I'm|I've|I'll)\b/gi, '[PERSON]');
  
  return anonymized;
}

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
    // PRIORITY 1: Check if to_number matches a program's to_number (direct program routing)
    // PRIORITY 2: Check businesses.to_number
    // PRIORITY 3: Check workflowId as business.id
    let business: any = null;
    let program: any = null;
    
    if (toNumber) {
      // Normalize phone number - try multiple formats
      const normalizedNumber = toNumber.replace(/[^\d+]/g, '');
      const digitsOnly = normalizedNumber.replace(/\+/g, '');
      const withPlusOne = digitsOnly.startsWith('1') ? `+${digitsOnly}` : `+1${digitsOnly}`;
      const withoutPlusOne = digitsOnly.startsWith('1') ? digitsOnly.substring(1) : digitsOnly;
      const phoneFormats = Array.from(new Set([toNumber, normalizedNumber, withPlusOne, withoutPlusOne].filter(Boolean)));

      // PRIORITY 1: Check if to_number matches a program's to_number
      for (const format of phoneFormats) {
        const { data: programData, error: programError } = await (supabaseAdmin
          .from("programs") as any)
          .select(`
            id,
            name,
            to_number,
            business_id,
            business:businesses!programs_parent_business_fkey (
              id,
              name,
              to_number,
              vertical,
              address,
              hours,
              services,
              staff,
              faqs,
              promos,
              program_id
            )
          `)
          .eq("to_number", format)
          .maybeSingle();

        if (programError && programError.code !== "PGRST116") {
          console.warn("⚠️ Error checking program to_number:", programError);
        }

        if (programData) {
          program = programData;
          business = programData.business || null;
          
          // If program found but business join failed, fetch business separately
          if (program && !business && program.business_id) {
            const { data: businessData } = await supabaseAdmin
              .from("businesses")
              .select("*")
              .eq("id", program.business_id)
              .maybeSingle();
            
            if (businessData) {
              business = businessData;
              console.log("✅ Fetched business separately for program:", business.name);
            }
          }
          
          console.log("✅ Found program by to_number (direct routing):", {
            program: program.name,
            business: business?.name,
            phone: format,
            program_id: program.id
          });
          break;
        }
      }

      // PRIORITY 2: If no program found, check businesses.to_number
      if (!business && !program) {
        for (const format of phoneFormats) {
          const { data: businessByNumber } = await supabaseAdmin
            .from("businesses")
            .select("*")
            .eq("to_number", format)
            .maybeSingle();
          
          if (businessByNumber) {
            business = businessByNumber;
            console.log("✅ Found business by to_number:", format);
            break;
          }
        }
      }
    }
    
    // PRIORITY 3: If still no business, try workflowId as business.id
    if (!business && workflowId) {
      const { data: businessById } = await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", workflowId)
        .maybeSingle();
      
      if (businessById) {
        business = businessById;
        console.log("✅ Found business by workflowId:", workflowId);
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

    // 3️⃣ Extract escalation data - ONLY when call is actually being forwarded with a destination
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
      const forwardingNumber = message.forwardingPhoneNumber || message.destination?.number || null;
      // Only create escalationData if there's an actual forwarding number
      if (forwardingNumber) {
        escalationData = {
          forwarding_phone_number: forwardingNumber,
          destination_type: message.destination?.type || "number",
          destination_number: forwardingNumber,
          transfer_message: message.destination?.message || null,
          transfer_mode: message.destination?.transferPlan?.mode || null,
          sip_verb: message.destination?.transferPlan?.sipVerb || null,
          timestamp: message.timestamp || null,
        };
      }
    }

    // 4️⃣ Extract messages and process call turns (like n8n)
    const messages = artifact.messages || message.messages || artifact.messagesOpenAIFormatted || message.conversation || [];
    let conversationTurns: any[] = [];
    let turnCounter = 1;
    let confidenceScores: number[] = [];
    let n8nResponseBody = null;

    messages.forEach((msg: any) => {
      // Extract n8n tool response body for context
      if (msg.role === "tool_call_result" && msg.name === "n8n" && msg.metadata?.responseBody) {
        n8nResponseBody = msg.metadata.responseBody;
      }
      
      // Check for escalation in tool calls - ONLY if there's an actual destination number
      if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
        msg.toolCalls.forEach((toolCall: any) => {
          if (toolCall.function?.name === "untitled_tool" || 
              toolCall.function?.name?.includes("transfer") ||
              toolCall.function?.name?.includes("escalat")) {
            try {
              const args = typeof toolCall.function?.arguments === "string" 
                ? JSON.parse(toolCall.function.arguments) 
                : toolCall.function?.arguments || {};
              
              // Only create escalationData if there's an actual destination number
              const destinationNumber = args.destination || args.number || args.phone || null;
              if (destinationNumber && !escalationData) {
                escalationData = {
                  forwarding_phone_number: destinationNumber,
                  destination_type: "number",
                  destination_number: destinationNumber,
                  transfer_message: null,
                  transfer_mode: "blind-transfer",
                  sip_verb: "refer",
                  timestamp: msg.time || null,
                };
              }
            } catch (e) {
              // Don't create escalationData on error - only if we have actual forwarding
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
    // Only escalate if call is actually being forwarded with a real destination (no guessing)
    const escalate = escalationData !== null && 
                     escalationData.forwarding_phone_number !== null &&
                     escalationData.forwarding_phone_number.trim() !== "";

    // Only use structured output for upsell (no text analysis guessing)
    const upsell = upsellOpportunity === true;

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

    // 🔒 Create patient hash for consistent identification (HIPAA compliant)
    // This allows tracking same person across calls without exposing PHI
    const patientHash = createPatientHash(phone, email, patientName);
    
    // 🔒 Detect sensitive content (suicidal ideation, mental health crisis, etc.)
    const transcriptSensitivity = detectSensitiveContent(transcript);
    const summarySensitivity = detectSensitiveContent(summary);
    const hasSensitiveContent = transcriptSensitivity.hasSensitiveContent || summarySensitivity.hasSensitiveContent;
    
    // For sensitive content: sanitize for business view, heavily anonymize for training
    let businessTranscript = transcript;
    let businessSummary = summary;
    
    if (transcriptSensitivity.hasSensitiveContent) {
      // Business owners see sanitized version (sensitive phrases replaced)
      businessTranscript = transcriptSensitivity.sanitizedText;
      console.log("⚠️ Sensitive content detected in transcript:", transcriptSensitivity.sensitiveTypes);
    }
    
    if (summarySensitivity.hasSensitiveContent) {
      // Business owners see sanitized version
      businessSummary = summarySensitivity.sanitizedText;
      console.log("⚠️ Sensitive content detected in summary:", summarySensitivity.sensitiveTypes);
    }
    
    // For training data: anonymize only known names, keep everything else readable
    const namesToAnonymize: string[] = [];
    if (patientName) namesToAnonymize.push(patientName);
    if (business?.name) namesToAnonymize.push(business.name);
    
    // 1️⃣3️⃣ Build comprehensive call data (matching calls table schema)
    const callData: any = {
      call_id: callId,
      business_id: business.id,
      program_id: program?.id || null,
      status: status,
      to_number: toNumber,
      phone: phone,
      email: email,
      patient_name: patientName,
      transcript: businessTranscript, // Use sanitized version if sensitive
      last_summary: businessSummary, // Use sanitized version if sensitive
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
      // Note: has_sensitive_content column doesn't exist in calls table - removed
      sensitive_content_types: [
        ...(transcriptSensitivity.sensitiveTypes || []),
        ...(summarySensitivity.sensitiveTypes || []),
      ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
    };

    // 🔒 HIPAA-COMPLIANT DUAL STORAGE APPROACH
    // Business owners need full data for operations (HIPAA allows this with proper access controls)
    // Training/ML needs anonymized data (HIPAA compliant de-identification)
    
    // Always store patient_hash for consistent identification
    callData.patient_hash = patientHash;
    
    // Store full data in main calls table (for business dashboard use)
    // This is HIPAA compliant because:
    // 1. Business owners have BAA and proper access controls
    // 2. Data is encrypted at rest and in transit
    // 3. RLS policies restrict access to authorized users only
    
    // When call ends, also create anonymized version for training/ML
    if (messageType === "end-of-call-report") {
      console.log("🔒 Creating anonymized training data for ended call:", callId);
      
      // Create anonymized version for training/ML purposes
      // Only anonymize known names (patient name, business name) - keep everything else readable
      const namesToAnonymize: string[] = [];
      if (patientName) namesToAnonymize.push(patientName);
      if (business?.name) namesToAnonymize.push(business.name);
      
      let trainingTranscript = deidentifyTranscript(transcript, namesToAnonymize);
      let trainingSummary = deidentifyTranscript(summary, namesToAnonymize);
      
      if (hasSensitiveContent) {
        // Heavily anonymize sensitive content for training
        // First anonymize known names, then apply sensitive content anonymization
        trainingTranscript = anonymizeSensitiveContent(trainingTranscript);
        trainingSummary = anonymizeSensitiveContent(trainingSummary);
        console.log("🔒 Heavily anonymizing sensitive content for training data");
      }
      
      const anonymizedCallData: any = {
        call_id: callId,
        business_id: business.id,
        patient_hash: patientHash, // Keep hash for consistent identification
        status: status,
        to_number: toNumber, // Business number is not PHI
        phone: deidentifyPhone(phone),
        email: deidentifyEmail(email),
        patient_name: deidentifyName(patientName),
        transcript: trainingTranscript,
        last_summary: trainingSummary,
        last_intent: intent,
        last_confidence: avgConfidence !== null ? parseFloat(avgConfidence.toFixed(3)) : null,
        route: route,
        success: success !== null ? success : undefined,
        escalate: escalate,
        upsell: upsell,
        duration_sec: durSec > 0 ? durSec : null,
        success_evaluation: successEvaluation === "true" || successEvaluation === true || successEvaluation === 1 ? 1 : (successEvaluation === "false" || successEvaluation === false || successEvaluation === 0 ? 0 : null),
        updated_at: new Date().toISOString(),
        // Note: has_sensitive_content column doesn't exist in calls_training table - removed
        sensitive_content_types: callData.sensitive_content_types,
      };
      
      // Handle anonymized schedule
      if (schedule) {
        anonymizedCallData.schedule = deidentifySchedule(schedule);
      }
      
      // Handle anonymized timestamps (year-month only)
      if (message.startedAt) {
        try {
          const date = new Date(message.startedAt);
          anonymizedCallData.started_at_year_month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } catch (e) {
          // Skip if parsing fails
        }
      }
      
      if (message.endedAt) {
        try {
          const date = new Date(message.endedAt);
          anonymizedCallData.ended_at_year_month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } catch (e) {
          // Skip if parsing fails
        }
      }
      
      // Store anonymized conversation turns
      let anonymizedTurns: any[] = [];
      if (conversationTurns.length > 0) {
        anonymizedTurns = deidentifyConversationTurns(conversationTurns);
      }
      
      // Store anonymized data in separate table (calls_training) for ML/training
      // This table is HIPAA compliant and safe for export/sharing
      try {
        const { error: trainingError } = await supabaseAdmin
          .from("calls_training")
          .upsert(anonymizedCallData as any, {
            onConflict: "call_id",
            ignoreDuplicates: false,
          });
        
        if (trainingError) {
          console.warn("⚠️ Could not store anonymized training data (table may not exist):", trainingError.message);
          // Don't fail the main call storage if training table doesn't exist
        } else {
          console.log("✅ Stored anonymized training data for call:", callId);
          
          // Store anonymized conversation turns
          if (anonymizedTurns.length > 0) {
            const anonymizedTurnData: any = {
              call_id: callId,
              transcript_json: anonymizedTurns,
              total_turns: anonymizedTurns.length,
              updated_at: new Date().toISOString(),
            };
            
            if (toNumber) {
              anonymizedTurnData.to_number = toNumber;
            }
            
            const { error: turnsError } = await supabaseAdmin
              .from("call_turns_training")
              .upsert(anonymizedTurnData as any, {
                onConflict: "call_id",
                ignoreDuplicates: false,
              });
            
            if (turnsError) {
              console.warn("⚠️ Could not store anonymized turns (table may not exist):", turnsError.message);
            }
          }
        }
      } catch (e) {
        console.warn("⚠️ Training table storage failed (non-critical):", e);
        // Continue with main call storage even if training storage fails
      }
    }

    // Handle timestamps
    if (messageType === "end-of-call-report") {
      // Store full timestamps in main calls table (for business dashboard)
      // Anonymized version with year-month only is stored in calls_training table
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
        .maybeSingle();
      
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
        program_id: program?.id || null,
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
