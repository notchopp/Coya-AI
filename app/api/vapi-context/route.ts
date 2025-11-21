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
    
    // Extract from_number (caller's phone number) for patient lookup
    // VAPI variables: {{call.customer.number}} or {{customer.number}}
    const fromNumber = body.from_number || 
                      body.fromNumber || 
                      body.caller_number ||
                      body.customer?.number ||
                      body.call?.customer?.number ||
                      body.arguments?.from_number ||
                      body.arguments?.fromNumber ||
                      body.arguments?.caller_number ||
                      body.arguments?.customer?.number ||
                      body.arguments?.call?.customer?.number ||
                      null;

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

    // PRIORITY 0: Check if this is a demo business (sandbox mode)
    // All demo businesses use the same phone number: +1 (215) 986 2752
    const DEMO_PHONE_NUMBER = "+12159862752"; // +1 (215) 986 2752
    const demoPhoneFormats = [
      DEMO_PHONE_NUMBER,
      "12159862752",
      "+1 (215) 986 2752",
      "(215) 986 2752",
      "2159862752",
    ];
    
    let business: any = null;
    let program: any = null;
    let businessError: any = null;

    // Check if incoming number matches the demo phone number
    const isDemoCall = demoPhoneFormats.some(format => 
      toNumber === format || 
      normalizedNumber === format.replace(/[^\d+]/g, '') ||
      withPlusOne === format.replace(/[^\d+]/g, '') ||
      withoutPlusOne === format.replace(/[^\d+]/g, '').replace(/^\+?1/, '')
    );

    if (isDemoCall) {
      console.log("🎯 DEMO CALL DETECTED: Using shared demo business");
      
      // Demo business ID - all demo sessions use this same business
      const DEMO_BUSINESS_ID = "eea1f8b5-f4ed-4141-85c7-c381643ce9df";
      
      // Check if there's at least one active demo session
      const { data: activeSessions, error: sessionError } = await supabaseAdmin
        .from("demo_sessions")
        .select("id, expires_at")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .eq("demo_business_id", DEMO_BUSINESS_ID)
        .limit(1);

      if (sessionError) {
        console.error("Error checking demo sessions:", sessionError);
      }

      // If no active sessions, reject the call
      if (!activeSessions || activeSessions.length === 0) {
        console.log("⚠️ No active demo session found for demo number");
        return NextResponse.json({
          error: "No active demo session found",
          message: "Please start a new demo session.",
        }, { status: 404 });
      }

      // Fetch the shared demo business
      const { data: demoBusiness, error: businessError } = await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", DEMO_BUSINESS_ID)
        .single();

      if (businessError || !demoBusiness) {
        console.error("Error fetching demo business:", businessError);
        return NextResponse.json({
          error: "Demo business not found",
          message: "Demo business is not configured.",
        }, { status: 404 });
      }

      // Use demo business
      console.log("🎯 DEMO MODE: Using demo business:", (demoBusiness as any).name);
      business = demoBusiness as any;
      // Demo businesses don't have programs, so skip program lookup
    }

    // PRIORITY 1: Check if to_number matches a program's direct number (direct program routing)
    // This enables extension forwarding: clinic forwards extension → program number → direct program context
    // Skip program lookup if we're in demo mode
    if (!business?.is_demo) {
      const programColumns = "id,name,extension,business_id,to_number,hours,services,staff,faqs,promos,description";
      const phoneFormats = [toNumber, normalizedNumber, withPlusOne, withoutPlusOne];

      console.log("🔍 PRIORITY 1: Checking programs.to_number for formats:", phoneFormats);

      // Try to find program by phone number first (highest priority for direct routing)
      for (const format of phoneFormats) {
        console.log(`🔍 Checking program with format: "${format}"`);
        const { data: programData, error: programError } = await (supabaseAdmin
          .from("programs") as any)
          .select(`${programColumns}, business:businesses!programs_parent_business_fkey(id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id,categories,mobile_services,packages,same_day_booking)`)
          .eq("to_number", format)
          .maybeSingle();

        if (programError && programError.code !== "PGRST116") {
          console.warn("⚠️ Error checking program number:", programError);
        } else if (programData) {
          program = programData;
          business = programData.business;
          
          // If program found but business join failed, fetch business separately
          if (program && !business && program.business_id) {
            const { data: businessData } = await supabaseAdmin
              .from("businesses")
              .select("id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id")
              .eq("id", program.business_id)
              .maybeSingle();
            
            if (businessData) {
              business = businessData;
              console.log("✅ Fetched business separately for program:", business.name);
            }
          }
          
          console.log("✅ Found program by phone number (direct routing):", {
            program: program.name,
            phone: format,
            business: business?.name
          });
          break; // Found program, exit loop
        } else {
          console.log(`❌ No program found for format: "${format}"`);
        }
      }

      if (!program) {
        console.log("⚠️ No program found for any format, falling back to businesses lookup");
      }

      // PRIORITY 2: If no program found by phone, check businesses table (existing logic)
      if (!business && !program) {
        // Optimized: Only select needed columns for faster queries
        // Note: insurances column doesn't exist in programs or businesses tables
        // Include program_id to auto-select default program for this business
        const businessColumns = "id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id,categories,mobile_services,packages,same_day_booking";
        
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
      }
    }

    // PRIORITY 3: If program not found by phone number, check by extension/program_id
    // Priority order:
    // 1. Program found by direct number (already handled above - highest priority)
    // 2. Explicit program_id from request
    // 3. Extension from request
    // 4. business.program_id (default program for this business)
    
    // Only fetch program if we haven't already found one by phone number
    if (!program && business) {
      const businessData = business as any;
      const defaultProgramId = businessData.program_id; // Auto-select default program if business has one
      
      // Determine which program to fetch
      const targetProgramId = programId || defaultProgramId;
      
      if (targetProgramId || extension) {
        // Note: Based on actual schema - programs table has: id, business_id, name, description, extension, to_number, services, staff, hours, faqs, promos, categories, mobile_services, packages, same_day_booking
        // insurances, settings, vertical, and address do NOT exist in programs table
        const programColumns = "id,name,extension,business_id,to_number,hours,services,staff,faqs,promos,description,categories,mobile_services,packages,same_day_booking";
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
    } else if (program) {
      // Program already found by phone number, skip additional lookup
      console.log("ℹ️ Program already found by phone number, skipping extension/program_id lookup");
    }

    // Check for calendar connection (for dynamic calendar booking per business)
    let calendarConnection: any = null;
    if (business) {
      let calendarQuery = (supabaseAdmin as any)
        .from("calendar_connections")
        .select("id,calendar_id,email")
        .eq("business_id", business.id);
      
      if (program) {
        calendarQuery = calendarQuery.eq("program_id", program.id);
      } else {
        calendarQuery = calendarQuery.is("program_id", null);
      }
      
      const { data: calendarData } = await calendarQuery.maybeSingle();
      if (calendarData) {
        calendarConnection = {
          connected: true,
          calendar_id: calendarData.calendar_id,
          email: calendarData.email,
        };
      }
    }

    // Look up patient context if caller's number is provided
    let patientContext: any = null;
    if (fromNumber && business) {
      try {
        // Normalize phone number for lookup
        const normalizedPhone = fromNumber.replace(/[^\d+]/g, '');
        const phoneFormats = [
          fromNumber,
          normalizedPhone,
          normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : `+1${normalizedPhone}`,
          normalizedPhone.startsWith('1') ? normalizedPhone.substring(1) : normalizedPhone,
        ];

        // Try to find patient by phone number
        for (const format of phoneFormats) {
          const { data: patient } = await supabaseAdmin
            .from('patients')
            .select(`
              patient_id,
              patient_name,
              phone,
              last_visit,
              last_treatment,
              last_intent,
              notes,
              last_call_date
            `)
            .eq('business_id', business.id)
            .eq('phone', format)
            .maybeSingle();
          
          if (patient) {
            patientContext = {
              name: patient.patient_name,
              last_visit: patient.last_visit, // date of last booked appointment
              last_treatment: patient.last_treatment, // service from last booking
              last_intent: patient.last_intent, // what they asked about last time (if no booking)
              notes: patient.notes,
              last_call_date: patient.last_call_date,
            };
            console.log("✅ Found patient context for caller:", fromNumber);
            break;
          }
        }
      } catch (patientError) {
        // Don't fail context lookup if patient lookup fails
        console.warn("⚠️ Patient lookup failed (non-critical):", patientError);
      }
    }

    // Build structured context with separate business and program sections
    // This makes it easier for AI to understand what's business-level vs program-level
    // and construct dynamic responses like "you reached outpatient therapy for allure clinic"
    const businessData = business as any;
    
    // Extract categories structure (could be nested in JSONB or direct)
    const businessCategories = businessData.categories?.categories || businessData.categories || null;
    const programCategories = program?.categories?.categories || program?.categories || null;
    
    // Extract mobile_services, packages, same_day_booking
    const businessMobileServices = businessData.mobile_services || null;
    const programMobileServices = program?.mobile_services || null;
    const businessPackages = businessData.packages || null;
    const programPackages = program?.packages || null;
    const businessSameDayBooking = businessData.same_day_booking ?? true; // Default to true
    const programSameDayBooking = program?.same_day_booking ?? true;
    
    const context: any = {
      // Business-level information (always present)
      business: {
        id: businessData.id,
        name: businessData.name || null,
        phone: businessData.to_number || null,
        vertical: businessData.vertical || null,
        address: businessData.address || null,
        hours: businessData.hours || null,
        // NEW: Categories with nested services (for medspa/wellness)
        categories: businessCategories,
        // Legacy: Keep services array for backward compatibility
        services: businessData.services || null,
        staff: businessData.staff || null,
        faqs: businessData.faqs || null,
        promos: businessData.promos || null,
        // NEW: Medspa/wellness-specific fields
        mobile_services: businessMobileServices,
        packages: businessPackages,
        same_day_booking: businessSameDayBooking,
        calendar: calendarConnection, // Add calendar connection info
      },
      // Program-level information (if program exists)
      program: program ? {
        id: program.id,
        name: program.name,
        extension: program.extension || null,
        phone_number: program.to_number || null,
        description: program.description || null,
        hours: program.hours || null,
        // NEW: Categories with nested services
        categories: programCategories,
        // Legacy: Keep services array for backward compatibility
        services: program.services || null,
        staff: program.staff || null,
        faqs: program.faqs || null,
        promos: program.promos || null,
        // NEW: Medspa/wellness-specific fields
        mobile_services: programMobileServices,
        packages: programPackages,
        same_day_booking: programSameDayBooking,
      } : null,
      // Merged fields (program takes priority, business as fallback) - for backward compatibility
      business_id: businessData.id,
      business_name: businessData.name || null, // Always use actual business name
      program_name: program?.name || null, // Program name if exists
      business_phone: businessData.to_number || null,
      vertical: businessData.vertical || null,
      address: businessData.address || null,
      hours: program?.hours || businessData.hours || null, // Program hours take priority
      business_hours: businessData.hours || null, // Always include business hours for AI reference
      // NEW: Categories (program takes priority)
      categories: programCategories || businessCategories || null,
      // Legacy services (for backward compatibility)
      services: program?.services || businessData.services || null,
      staff: program?.staff || businessData.staff || null,
      faqs: program?.faqs || businessData.faqs || null,
      promos: program?.promos || businessData.promos || null,
      // NEW: Merged medspa/wellness fields (program takes priority)
      mobile_services: programMobileServices || businessMobileServices || null,
      packages: programPackages || businessPackages || null,
      same_day_booking: programSameDayBooking ?? businessSameDayBooking ?? true,
      insurances: null, // Note: insurances column doesn't exist in programs or businesses tables
      // Legacy fields for backward compatibility
      id: businessData.id,
      name: program?.name || businessData.name || null, // Program name takes priority for legacy "name" field
      to_number: businessData.to_number || null,
    };

    // Add program-specific fields if program exists
    if (program) {
      context.program_id = program.id;
      context.extension = program.extension;
      if (program.description) context.program_description = program.description;
      if (program.to_number) context.program_phone_number = program.to_number;
    }

    // Add patient context if found
    if (patientContext) {
      context.patient = patientContext;
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
      hasCategories: !!context.categories,
      hasServices: !!context.services,
      hasMobileServices: !!context.mobile_services,
      hasPackages: !!context.packages,
      sameDayBooking: context.same_day_booking,
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

    // PRIORITY 1: Check if to_number matches a program's direct number (direct program routing)
    let program: any = null;
    let business: any = null;

    const programColumns = "id,name,extension,business_id,to_number,hours,services,staff,faqs,promos,description,categories,mobile_services,packages,same_day_booking";
    const phoneFormats = [toNumber, normalizedNumber, withPlusOne, withoutPlusOne];

    // Try to find program by phone number first (highest priority for direct routing)
    for (const format of phoneFormats) {
      const { data: programData, error: programError } = await (supabaseAdmin
        .from("programs") as any)
        .select(`${programColumns}, business:businesses!programs_parent_business_fkey(id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id,categories,mobile_services,packages,same_day_booking)`)
        .eq("to_number", format)
        .maybeSingle();

      if (programError && programError.code !== "PGRST116") {
        console.warn("⚠️ Error checking program number:", programError);
      } else if (programData) {
        program = programData;
        business = programData.business;
        
        // If program found but business join failed, fetch business separately
        if (program && !business && program.business_id) {
          const { data: businessData } = await supabaseAdmin
            .from("businesses")
            .select("id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id,categories,mobile_services,packages,same_day_booking")
            .eq("id", program.business_id)
            .maybeSingle();
          
          if (businessData) {
            business = businessData;
            console.log("✅ Fetched business separately for program:", business.name);
          }
        }
        
        console.log("✅ Found program by phone number (direct routing):", {
          program: program.name,
          phone: format,
          business: business?.name
        });
        break; // Found program, exit loop
      }
    }

    // PRIORITY 2: If no program found by phone, check businesses table
    if (!business && !program) {
      const businessColumns = "id,name,to_number,vertical,address,hours,services,staff,faqs,promos,program_id,categories,mobile_services,packages,same_day_booking";
      
      // Try multiple formats
      for (const format of phoneFormats) {
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

    // PRIORITY 3: If program not found by phone number, check by extension/program_id
    if (!program && business) {
      const businessData = business as any;
      const defaultProgramId = businessData.program_id;
      const targetProgramId = programId || defaultProgramId;
      
      if (targetProgramId || extension) {
        const programColumns = "id,name,extension,business_id,to_number,hours,services,staff,faqs,promos,description,categories,mobile_services,packages,same_day_booking";
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
    } else if (program) {
      console.log("ℹ️ Program already found by phone number, skipping extension/program_id lookup");
    }

    // Build structured context with separate business and program sections
    // This makes it easier for AI to understand what's business-level vs program-level
    // and construct dynamic responses like "you reached outpatient therapy for allure clinic"
    const businessData = business as any;
    
    // Extract categories structure (could be nested in JSONB or direct)
    const businessCategories = businessData.categories?.categories || businessData.categories || null;
    const programCategories = program?.categories?.categories || program?.categories || null;
    
    // Extract mobile_services, packages, same_day_booking
    const businessMobileServices = businessData.mobile_services || null;
    const programMobileServices = program?.mobile_services || null;
    const businessPackages = businessData.packages || null;
    const programPackages = program?.packages || null;
    const businessSameDayBooking = businessData.same_day_booking ?? true; // Default to true
    const programSameDayBooking = program?.same_day_booking ?? true;
    
    const context: any = {
      // Business-level information (always present)
      business: {
        id: businessData.id,
        name: businessData.name || null,
        phone: businessData.to_number || null,
        vertical: businessData.vertical || null,
        address: businessData.address || null,
        hours: businessData.hours || null,
        // NEW: Categories with nested services (for medspa/wellness)
        categories: businessCategories,
        // Legacy: Keep services array for backward compatibility
        services: businessData.services || null,
        staff: businessData.staff || null,
        faqs: businessData.faqs || null,
        promos: businessData.promos || null,
        // NEW: Medspa/wellness-specific fields
        mobile_services: businessMobileServices,
        packages: businessPackages,
        same_day_booking: businessSameDayBooking,
      },
      // Program-level information (if program exists)
      program: program ? {
        id: program.id,
        name: program.name,
        extension: program.extension || null,
        phone_number: program.to_number || null,
        description: program.description || null,
        hours: program.hours || null,
        // NEW: Categories with nested services
        categories: programCategories,
        // Legacy: Keep services array for backward compatibility
        services: program.services || null,
        staff: program.staff || null,
        faqs: program.faqs || null,
        promos: program.promos || null,
        // NEW: Medspa/wellness-specific fields
        mobile_services: programMobileServices,
        packages: programPackages,
        same_day_booking: programSameDayBooking,
      } : null,
      // Merged fields (program takes priority, business as fallback) - for backward compatibility
      business_id: businessData.id,
      business_name: businessData.name || null, // Always use actual business name
      program_name: program?.name || null, // Program name if exists
      business_phone: businessData.to_number || null,
      vertical: businessData.vertical || null,
      address: businessData.address || null,
      hours: program?.hours || businessData.hours || null, // Program hours take priority
      business_hours: businessData.hours || null, // Always include business hours for AI reference
      // NEW: Categories (program takes priority)
      categories: programCategories || businessCategories || null,
      // Legacy services (for backward compatibility)
      services: program?.services || businessData.services || null,
      staff: program?.staff || businessData.staff || null,
      faqs: program?.faqs || businessData.faqs || null,
      promos: program?.promos || businessData.promos || null,
      // NEW: Merged medspa/wellness fields (program takes priority)
      mobile_services: programMobileServices || businessMobileServices || null,
      packages: programPackages || businessPackages || null,
      same_day_booking: programSameDayBooking ?? businessSameDayBooking ?? true,
      insurances: null, // Note: insurances column doesn't exist in programs or businesses tables
      // Legacy fields for backward compatibility
      id: businessData.id,
      name: program?.name || businessData.name || null, // Program name takes priority for legacy "name" field
      to_number: businessData.to_number || null,
    };

    // Add program-specific fields if program exists
    if (program) {
      context.program_id = program.id;
      context.extension = program.extension;
      if (program.description) context.program_description = program.description;
      if (program.to_number) context.program_phone_number = program.to_number;
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

