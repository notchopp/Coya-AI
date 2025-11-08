import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool Endpoint - Returns business context for a given phone number
 * This replaces the n8n tool and can be called by Vapi during calls
 * 
 * Request body: { "to_number": "+1234567890" }
 * Returns: Full business context (name, hours, services, FAQs, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const toNumber = body.to_number || body.phoneNumber?.number || null;

    if (!toNumber) {
      return NextResponse.json(
        { error: "to_number is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Lookup business by to_number
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .eq("to_number", toNumber)
      .maybeSingle();

    if (businessError && businessError.code !== "PGRST116") {
      console.error("Error fetching business:", businessError);
      return NextResponse.json(
        { error: "Failed to fetch business context", details: businessError.message },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "Business not found for phone number", to_number: toNumber },
        { status: 404 }
      );
    }

    // Format business context for Vapi
    // Return all relevant fields that Vapi might need during the call
    const businessData = business as any;
    const context = {
      id: businessData.id,
      name: businessData.name || null,
      vertical: businessData.vertical || null,
      address: businessData.address || null,
      hours: businessData.hours || null,
      services: businessData.services || null,
      insurances: businessData.insurances || null,
      staff: businessData.staff || null,
      faqs: businessData.faqs || null,
      promos: businessData.promos || null,
      to_number: businessData.to_number || null,
      // Include any other fields that might be useful
    };

    return NextResponse.json(context, { status: 200 });

  } catch (error) {
    console.error("❌ Vapi context endpoint error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Handle GET requests (for health checks)
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "vapi-context", description: "Returns business context for Vapi calls" },
    { status: 200 }
  );
}

