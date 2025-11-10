import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { deidentifyPhone, deidentifyEmail, deidentifyName, deidentifyTranscript } from "@/lib/hipaa-utils";

/**
 * Auto-anonymizes calls older than retention period (default 90 days)
 * This runs automatically via Vercel Cron to keep old data HIPAA-safe
 * 
 * Business owners still see their data, but old data is automatically anonymized
 * Training data in calls_training is already anonymized
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from Vercel Cron (optional security check)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    
    // Get retention period from env (default 90 days)
    const retentionDays = parseInt(process.env.CALL_RETENTION_DAYS || "90");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`🔒 Starting auto-anonymization for calls older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
    
    // Find calls older than retention period that still have PHI
    // Check if phone doesn't start with "PH-" (our anonymization token format)
    const { data: oldCalls, error: fetchError } = await supabaseAdmin
      .from("calls")
      .select("call_id, phone, email, patient_name, transcript, last_summary, business_id")
      .lt("ended_at", cutoffDate.toISOString())
      .or("phone.not.like.PH-%,email.not.like.EM-%,patient_name.not.like.NM-%")
      .limit(1000); // Process in batches
    
    if (fetchError) {
      console.error("❌ Error fetching old calls:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch old calls", details: fetchError.message },
        { status: 500 }
      );
    }
    
    if (!oldCalls || oldCalls.length === 0) {
      console.log("✅ No calls to anonymize");
      return NextResponse.json({ 
        success: true, 
        anonymized: 0,
        message: "No calls found that need anonymization"
      });
    }
    
    console.log(`📊 Found ${oldCalls.length} calls to anonymize`);
    
    // Anonymize each call in batch
    let anonymizedCount = 0;
    let errorCount = 0;
    
    type CallRecord = {
      call_id: string;
      phone: string | null;
      email: string | null;
      patient_name: string | null;
      transcript: string | null;
      last_summary: string | null;
      business_id: string;
    };
    
    for (const call of oldCalls as CallRecord[]) {
      try {
        const updateData: any = {
          updated_at: new Date().toISOString(),
          anonymized_at: new Date().toISOString(),
        };
        
        // Only anonymize fields that aren't already anonymized
        if (call.phone && !call.phone.startsWith("PH-")) {
          updateData.phone = deidentifyPhone(call.phone);
        }
        
        if (call.email && !call.email.startsWith("EM-")) {
          updateData.email = deidentifyEmail(call.email);
        }
        
        if (call.patient_name && !call.patient_name.startsWith("NM-")) {
          updateData.patient_name = deidentifyName(call.patient_name);
        }
        
        if (call.transcript) {
          updateData.transcript = deidentifyTranscript(call.transcript);
        }
        
        if (call.last_summary) {
          updateData.last_summary = deidentifyTranscript(call.last_summary);
        }
        
        const { error: updateError } = await (supabaseAdmin
          .from("calls") as any)
          .update(updateData)
          .eq("call_id", call.call_id);
        
        if (updateError) {
          console.error(`❌ Error anonymizing call ${call.call_id}:`, updateError);
          errorCount++;
        } else {
          anonymizedCount++;
        }
      } catch (e) {
        console.error(`❌ Exception anonymizing call ${call.call_id}:`, e);
        errorCount++;
      }
    }
    
    // Also anonymize conversation turns for these calls
    const callIds = (oldCalls as CallRecord[]).map(c => c.call_id);
    if (callIds.length > 0) {
      const { data: oldTurns, error: turnsError } = await supabaseAdmin
        .from("call_turns")
        .select("call_id, transcript_json")
        .in("call_id", callIds);
      
      if (!turnsError && oldTurns) {
        type TurnRecord = {
          call_id: string;
          transcript_json: any;
        };
        for (const turn of oldTurns as TurnRecord[]) {
          if (turn.transcript_json && Array.isArray(turn.transcript_json)) {
            const anonymizedTurns = turn.transcript_json.map((t: any) => ({
              ...t,
              content: deidentifyTranscript(t.content) || t.content,
            }));
            
            await (supabaseAdmin
              .from("call_turns") as any)
              .update({
                transcript_json: anonymizedTurns,
                updated_at: new Date().toISOString(),
              })
              .eq("call_id", turn.call_id);
          }
        }
      }
    }
    
    console.log(`✅ Anonymization complete: ${anonymizedCount} calls anonymized, ${errorCount} errors`);
    
    return NextResponse.json({ 
      success: true, 
      anonymized: anonymizedCount,
      errors: errorCount,
      total: oldCalls.length,
      retention_days: retentionDays,
      cutoff_date: cutoffDate.toISOString(),
    });
    
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

// Allow GET for manual testing
export async function GET() {
  return NextResponse.json({
    message: "Call cleanup endpoint - use POST to run cleanup",
    retention_days: process.env.CALL_RETENTION_DAYS || "90",
  });
}

