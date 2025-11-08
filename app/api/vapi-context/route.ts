import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool Endpoint - Returns business context for a given phone number
 * This replaces the n8n tool and can be called by Vapi during calls
 * 
 * Request body formats supported:
 * - { "to_number": "+1234567890" }
 * - { "phoneNumber": { "number": "+1234567890" } }
 * - { "arguments": { "to_number": "+1234567890" } } (Vapi function call format)
 * - Raw string phone number
 * Returns: Full business context (name, hours, services, FAQs, etc.)
 * 
 * Deployment: Ready for production use
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (jsonError) {
      // Handle case where body might be a raw string
      const text = await request.text();
      console.log("📞 Received non-JSON body:", text);
      body = { to_number: text.trim() || null };
    }
    
    // Handle multiple possible formats from Vapi
    // Vapi Server URL tools might send:
    // 1. Direct format: { "to_number": "..." }
    // 2. Nested format: { "phoneNumber": { "number": "..." } }
    // 3. Function call format: { "arguments": { "to_number": "..." } }
    // 4. Raw string phone number
    let toNumber = body.to_number || 
                   body.phoneNumber?.number || 
                   body.phoneNumber || 
                   body.number ||
                   body.arguments?.to_number ||
                   body.arguments?.phoneNumber?.number ||
                   body.arguments?.phoneNumber ||
                   (typeof body === 'string' ? body : null) ||
                   null;

    // Clean and trim the phone number (remove newlines, whitespace, etc.)
    if (toNumber && typeof toNumber === 'string') {
      toNumber = toNumber.trim().replace(/\n/g, '').replace(/\r/g, '');
    }

    console.log("📞 Vapi context request received:", {
      rawBody: body,
      extractedToNumber: toNumber,
      bodyType: typeof body,
    });

    if (!toNumber) {
      console.warn("⚠️ No phone number provided in request:", body);
      return NextResponse.json(
        { error: "to_number or phoneNumber.number is required", received: body },
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
      console.warn("⚠️ Business not found for phone number:", toNumber);
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

    console.log("✅ Business context found for", toNumber, ":", {
      id: context.id,
      name: context.name,
      hasHours: !!context.hours,
      hasServices: !!context.services,
      hasFAQs: !!context.faqs,
    });

    // Return with CORS headers for Vapi
    return NextResponse.json(context, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

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
    { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}

// Handle OPTIONS requests (for CORS preflight)
export async function OPTIONS() {
  return NextResponse.json(
    { status: "ok" },
    { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}

