import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Vapi Tool Endpoint - Returns business context for a given phone number
 * This replaces the n8n tool and can be called by Vapi during calls
 * 
 * Request body formats supported:
 * - { "to_number": "+1234567890" }
 * - { "to_number": "+1234567890", "extension": "123" }
 * - { "to_number": "+1234567890", "program_id": "uuid" }
 * - { "phoneNumber": { "number": "+1234567890" } }
 * - { "arguments": { "to_number": "+1234567890", "extension": "123" } } (Vapi function call format)
 * - Raw string phone number
 * Returns: Full business context (name, hours, services, FAQs, etc.)
 * If program exists (by extension or program_id), returns program-level data, otherwise business defaults
 * 
 * Deployment: Ready for production use
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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

    // Extract extension and program_id
    const extension = body.extension || body.arguments?.extension || null;
    const programId = body.program_id || body.programId || body.arguments?.program_id || body.arguments?.programId || null;

    // Clean and trim the phone number (remove newlines, whitespace, etc.)
    if (toNumber && typeof toNumber === 'string') {
      toNumber = toNumber.trim().replace(/\n/g, '').replace(/\r/g, '');
    }

    console.log("📞 Vapi context request received:", {
      rawBody: body,
      extractedToNumber: toNumber,
      extension,
      programId,
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

    // Normalize phone number - try multiple formats
    // Remove all non-digit characters except +
    const normalizedNumber = toNumber.replace(/[^\d+]/g, '');
    // Also try with just digits (no +)
    const digitsOnly = normalizedNumber.replace(/\+/g, '');
    // Try with +1 prefix
    const withPlusOne = digitsOnly.startsWith('1') ? `+${digitsOnly}` : `+1${digitsOnly}`;
    // Try without +1 prefix
    const withoutPlusOne = digitsOnly.startsWith('1') ? digitsOnly.substring(1) : digitsOnly;

    console.log("🔍 Trying phone number formats:", {
      original: toNumber,
      normalized: normalizedNumber,
      digitsOnly,
      withPlusOne,
      withoutPlusOne,
    });

    // Try multiple formats
    let business: any = null;
    let businessError: any = null;

    // Optimized: Only select needed columns for faster queries
    // Note: insurances column only exists in programs table, not businesses
    // Include program_id to auto-select default program for this business
    const businessColumns = "id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id";
    
    // Try 1: Exact match with cleaned number
    let { data, error } = await supabaseAdmin
      .from("businesses")
      .select(businessColumns)
      .eq("to_number", toNumber)
      .maybeSingle();
    
    console.log("🔍 First lookup attempt:", {
      searchingFor: toNumber,
      found: !!data,
      error: error?.message,
      errorCode: error?.code,
    });
    
    if (data) {
      business = data;
      console.log("✅ Found business on first try!");
    } else if (error && error.code !== "PGRST116") {
      businessError = error;
    }

    // Try 2: Normalized (no spaces/dashes)
    if (!business) {
      ({ data, error } = await supabaseAdmin
        .from("businesses")
        .select(businessColumns)
        .eq("to_number", normalizedNumber)
        .maybeSingle());
      
      if (data) {
        business = data;
        console.log("✅ Found business with normalized format:", normalizedNumber);
      } else if (error && error.code !== "PGRST116") {
        businessError = error;
      }
    }

    // Try 3: With +1 prefix
    if (!business) {
      ({ data, error } = await supabaseAdmin
        .from("businesses")
        .select(businessColumns)
        .eq("to_number", withPlusOne)
        .maybeSingle());
      
      if (data) {
        business = data;
        console.log("✅ Found business with +1 format:", withPlusOne);
      } else if (error && error.code !== "PGRST116") {
        businessError = error;
      }
    }

    // Try 4: Without +1 prefix
    if (!business) {
      ({ data, error } = await supabaseAdmin
        .from("businesses")
        .select(businessColumns)
        .eq("to_number", withoutPlusOne)
        .maybeSingle());
      
      if (data) {
        business = data;
        console.log("✅ Found business without +1 format:", withoutPlusOne);
      } else if (error && error.code !== "PGRST116") {
        businessError = error;
      }
    }

    // Debug: List all businesses to see what format they use
    if (!business) {
      const { data: allBusinesses } = await supabaseAdmin
        .from("businesses")
        .select("id, name, to_number")
        .limit(10);
      
      console.log("🔍 Sample businesses in database:", allBusinesses);
      console.log("🔍 Looking for:", { toNumber, normalizedNumber, digitsOnly, withPlusOne, withoutPlusOne });
    }

    if (businessError && businessError.code !== "PGRST116") {
      console.error("Error fetching business:", businessError);
      return NextResponse.json(
        { error: "Failed to fetch business context", details: businessError.message },
        { status: 500 }
      );
    }

    if (!business) {
      const duration = Date.now() - startTime;
      console.warn("⚠️ Business not found for phone number after trying multiple formats:", {
        original: toNumber,
        normalized: normalizedNumber,
        digitsOnly,
        withPlusOne,
        withoutPlusOne,
      });
      return NextResponse.json(
        { error: "Business not found for phone number", to_number: toNumber, tried_formats: [toNumber, normalizedNumber, withPlusOne, withoutPlusOne] },
        { 
          status: 404,
          headers: { 'X-Response-Time': `${duration}ms` },
        }
      );
    }

    // Fetch program: Priority order:
    // 1. Explicit program_id from request (highest priority)
    // 2. Extension from request
    // 3. business.program_id (default program for this business)
    let program: any = null;
    const businessData = business as any;
    const defaultProgramId = businessData.program_id; // Auto-select default program if business has one
    
    // Determine which program to fetch
    const targetProgramId = programId || defaultProgramId;
    
    if (targetProgramId || extension) {
      const programColumns = "id,name,extension,business_id,vertical,address,hours,services,staff,faqs,promos,insurances,description,settings";
      let programQuery = (supabaseAdmin
        .from("programs") as any)
        .select(programColumns)
        .eq("business_id", business.id);

      if (targetProgramId) {
        programQuery = programQuery.eq("id", targetProgramId);
        console.log("🔍 Fetching program by ID:", targetProgramId, programId ? "(from request)" : "(default from business)");
      } else if (extension) {
        programQuery = programQuery.eq("extension", extension);
        console.log("🔍 Fetching program by extension:", extension);
      }

      const { data: programData, error: programError } = await programQuery.maybeSingle();

      if (programError && programError.code !== "PGRST116") {
        console.warn("⚠️ Error fetching program:", programError);
        // Continue with business defaults if program lookup fails
      } else if (programData) {
        program = programData;
        console.log("✅ Found program:", { 
          id: program.id, 
          name: program.name, 
          extension: program.extension,
          source: programId ? "request" : (extension ? "extension" : "business default")
        });
      } else if (targetProgramId || extension) {
        console.warn("⚠️ Program not found:", { targetProgramId, extension, business_id: business.id });
      }
    } else {
      console.log("ℹ️ No program specified or default - using business context only");
    }

    // Build combined context: program-level data takes priority, business as fallback
    // Include both business_hours and program_hours so AI can reference both
    // (e.g., "our business closes at 5 but outpatient closes at 2")
    const context: any = {
      business_id: businessData.id,
      business_name: program?.name || businessData.name || null,
      business_phone: businessData.to_number || null,
      vertical: program?.vertical || businessData.vertical || null,
      address: program?.address || businessData.address || null,
      // Program hours take priority, but include business hours for reference
      hours: program?.hours || businessData.hours || null,
      business_hours: businessData.hours || null, // Always include business hours for AI reference
      services: program?.services || businessData.services || null,
      staff: program?.staff || businessData.staff || null,
      faqs: program?.faqs || businessData.faqs || null,
      promos: program?.promos || businessData.promos || null,
      insurances: program?.insurances || null, // insurances only exists in programs table
      // Legacy fields for backward compatibility
      id: businessData.id,
      name: program?.name || businessData.name || null,
      to_number: businessData.to_number || null,
    };

    // Add program-specific fields if program exists
    if (program) {
      context.program_id = program.id;
      context.program_name = program.name;
      context.extension = program.extension;
      if (program.description) context.program_description = program.description;
      if (program.settings) context.program_settings = program.settings;
    }

    const duration = Date.now() - startTime;

    // Log if response time exceeds target (for monitoring)
    if (duration > 200) {
      console.warn(`⚠️ Vapi context response time (${duration}ms) exceeds 200ms target`);
    }

    console.log("✅ Business context found for", toNumber, ":", {
      id: context.business_id,
      name: context.business_name,
      hasProgram: !!program,
      hasHours: !!context.hours,
      hasServices: !!context.services,
      hasFAQs: !!context.faqs,
      responseTime: `${duration}ms`,
    });

    // Return with CORS headers for Vapi
    return NextResponse.json(context, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Vapi context endpoint error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { 
        status: 500,
        headers: { 'X-Response-Time': `${duration}ms` },
      }
    );
  }
}

// Handle GET requests (supports query params for testing)
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const toNumber = searchParams.get("to_number");
    const extension = searchParams.get("extension");
    const programId = searchParams.get("program_id");

    // If no params, return health check
    if (!toNumber) {
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

    // Process GET request with query params (same logic as POST)
    const supabaseAdmin = getSupabaseAdminClient();

    // Normalize phone number - try multiple formats
    const normalizedNumber = toNumber.replace(/[^\d+]/g, '');
    const digitsOnly = normalizedNumber.replace(/\+/g, '');
    const withPlusOne = digitsOnly.startsWith('1') ? `+${digitsOnly}` : `+1${digitsOnly}`;
    const withoutPlusOne = digitsOnly.startsWith('1') ? digitsOnly.substring(1) : digitsOnly;

    // Note: insurances column only exists in programs table, not businesses
    // Include program_id to auto-select default program for this business
    const businessColumns = "id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id";
    let business: any = null;

    // Try multiple formats
    for (const format of [toNumber, normalizedNumber, withPlusOne, withoutPlusOne]) {
      const { data, error } = await supabaseAdmin
        .from("businesses")
        .select(businessColumns)
        .eq("to_number", format)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        business = data;
        break;
      }
    }

    if (!business) {
      const duration = Date.now() - startTime;
      return NextResponse.json(
        { error: "Business not found for phone number", to_number: toNumber },
        { 
          status: 404,
          headers: { 'X-Response-Time': `${duration}ms` },
        }
      );
    }

    // Fetch program: Priority order:
    // 1. Explicit program_id from request (highest priority)
    // 2. Extension from request
    // 3. business.program_id (default program for this business)
    let program: any = null;
    const businessData = business as any;
    const defaultProgramId = businessData.program_id; // Auto-select default program if business has one
    
    // Determine which program to fetch
    const targetProgramId = programId || defaultProgramId;
    
    if (targetProgramId || extension) {
      const programColumns = "id,name,extension,business_id,vertical,address,hours,services,staff,faqs,promos,insurances,description,settings";
      let programQuery = (supabaseAdmin
        .from("programs") as any)
        .select(programColumns)
        .eq("business_id", business.id);

      if (targetProgramId) {
        programQuery = programQuery.eq("id", targetProgramId);
        console.log("🔍 Fetching program by ID:", targetProgramId, programId ? "(from request)" : "(default from business)");
      } else if (extension) {
        programQuery = programQuery.eq("extension", extension);
        console.log("🔍 Fetching program by extension:", extension);
      }

      const { data: programData, error: programError } = await programQuery.maybeSingle();

      if (programError && programError.code !== "PGRST116") {
        console.warn("⚠️ Error fetching program:", programError);
      } else if (programData) {
        program = programData;
        console.log("✅ Found program:", { 
          id: program.id, 
          name: program.name, 
          extension: program.extension,
          source: programId ? "request" : (extension ? "extension" : "business default")
        });
      } else if (targetProgramId || extension) {
        console.warn("⚠️ Program not found:", { targetProgramId, extension, business_id: business.id });
      }
    } else {
      console.log("ℹ️ No program specified or default - using business context only");
    }

    // Build combined context: program-level data takes priority, business as fallback
    // Include both business_hours and program_hours so AI can reference both
    // (e.g., "our business closes at 5 but outpatient closes at 2")
    const context: any = {
      business_id: businessData.id,
      business_name: program?.name || businessData.name || null,
      business_phone: businessData.to_number || null,
      vertical: program?.vertical || businessData.vertical || null,
      address: program?.address || businessData.address || null,
      // Program hours take priority, but include business hours for reference
      hours: program?.hours || businessData.hours || null,
      business_hours: businessData.hours || null, // Always include business hours for AI reference
      services: program?.services || businessData.services || null,
      staff: program?.staff || businessData.staff || null,
      faqs: program?.faqs || businessData.faqs || null,
      promos: program?.promos || businessData.promos || null,
      insurances: program?.insurances || null, // insurances only exists in programs table
      // Legacy fields for backward compatibility
      id: businessData.id,
      name: program?.name || businessData.name || null,
      to_number: businessData.to_number || null,
    };

    if (program) {
      context.program_id = program.id;
      context.program_name = program.name;
      context.extension = program.extension;
      if (program.description) context.program_description = program.description;
      if (program.settings) context.program_settings = program.settings;
    }

    const duration = Date.now() - startTime;

    if (duration > 200) {
      console.warn(`⚠️ Vapi context response time (${duration}ms) exceeds 200ms target`);
    }

    return NextResponse.json(context, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Response-Time': `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Vapi context GET error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { 
        status: 500,
        headers: { 'X-Response-Time': `${duration}ms` },
      }
    );
  }
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

