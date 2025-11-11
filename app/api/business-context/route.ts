import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Edge runtime for fast response times
export const runtime = "edge";

// Initialize Supabase client for edge runtime
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Normalizes phone number to try multiple formats
 */
function normalizePhoneNumber(phone: string): string[] {
  const normalized = phone.replace(/[^\d+]/g, "");
  const digitsOnly = normalized.replace(/\+/g, "");
  const withPlusOne = digitsOnly.startsWith("1") ? `+${digitsOnly}` : `+1${digitsOnly}`;
  const withoutPlusOne = digitsOnly.startsWith("1") ? digitsOnly.substring(1) : digitsOnly;

  return [phone, normalized, withPlusOne, withoutPlusOne].filter(Boolean);
}

/**
 * Fetches business by phone number (tries multiple formats)
 * Optimized: Only selects needed columns for faster queries
 */
async function fetchBusiness(supabase: any, toNumber: string) {
  const formats = normalizePhoneNumber(toNumber);
  // Note: insurances column only exists in programs table, not businesses
  const columns = "id,name,to_number,vertical,address,hours,services,staff,faqs,promos";

  for (const format of formats) {
    const { data, error } = await supabase
      .from("businesses")
      .select(columns)
      .eq("to_number", format)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  return null;
}

/**
 * Fetches program by extension or program_id
 * Optimized: Only selects needed columns for faster queries
 */
async function fetchProgram(
  supabase: any,
  businessId: string,
  extension?: string,
  programId?: string
) {
  if (!extension && !programId) {
    return null;
  }

  const columns = "id,name,extension,business_id,vertical,address,hours,services,staff,faqs,promos,insurances,description,settings";
  let query = (supabase.from("programs") as any).select(columns).eq("business_id", businessId);

  if (programId) {
    query = query.eq("id", programId);
  } else if (extension) {
    query = query.eq("extension", extension);
  }

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data;
}

/**
 * Combines program and business data into context object
 */
function buildContext(program: any, business: any) {
  // If program exists, use program-level data, otherwise use business defaults
  const context: any = {
    business_id: business?.id || null,
    business_name: program?.name || business?.name || null,
    business_phone: business?.to_number || null,
    vertical: program?.vertical || business?.vertical || null,
    address: program?.address || business?.address || null,
    hours: program?.hours || business?.hours || null,
    services: program?.services || business?.services || null,
    staff: program?.staff || business?.staff || null,
    faqs: program?.faqs || business?.faqs || null,
    promos: program?.promos || business?.promos || null,
    insurances: program?.insurances || null, // insurances only exists in programs table
  };

  // Add program-specific fields if program exists
  if (program) {
    context.program_id = program.id;
    context.program_name = program.name;
    context.extension = program.extension;
    // Include any additional program-specific fields
    if (program.description) context.program_description = program.description;
    if (program.settings) context.program_settings = program.settings;
  }

  return context;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const toNumber = searchParams.get("to_number");
    const extension = searchParams.get("extension");
    const programId = searchParams.get("program_id");

    if (!toNumber) {
      return NextResponse.json(
        { error: "to_number is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch business first (required for program lookup)
    const business = await fetchBusiness(supabase, toNumber);

    if (!business) {
      const duration = Date.now() - startTime;
      return NextResponse.json(
        { error: "Business not found for phone number", to_number: toNumber },
        {
          status: 404,
          headers: { "X-Response-Time": `${duration}ms` },
        }
      );
    }

    // Fetch program if extension or program_id provided (parallel not possible - need business_id)
    const program = await fetchProgram(supabase, business.id, extension || undefined, programId || undefined);

    // Build combined context
    const context = buildContext(program, business);

    const duration = Date.now() - startTime;

    // Log if response time exceeds target (for monitoring)
    if (duration > 200) {
      console.warn(`⚠️ Business context response time (${duration}ms) exceeds 200ms target`);
    }

    return NextResponse.json(context, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Response-Time": `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Business context error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch business context",
        details: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          "X-Response-Time": `${duration}ms`,
        },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      const text = await request.text();
      body = { to_number: text.trim() || null };
    }

    // Extract parameters from body (support multiple formats)
    const toNumber =
      body.to_number ||
      body.phoneNumber?.number ||
      body.phoneNumber ||
      body.number ||
      body.arguments?.to_number ||
      body.arguments?.phoneNumber?.number ||
      (typeof body === "string" ? body : null) ||
      null;

    const extension =
      body.extension ||
      body.arguments?.extension ||
      null;

    const programId =
      body.program_id ||
      body.programId ||
      body.arguments?.program_id ||
      body.arguments?.programId ||
      null;

    if (!toNumber) {
      return NextResponse.json(
        { error: "to_number is required" },
        { status: 400 }
      );
    }

    // Clean phone number
    const cleanToNumber = typeof toNumber === "string" ? toNumber.trim().replace(/\n/g, "").replace(/\r/g, "") : toNumber;

    const supabase = getSupabaseClient();

    // Fetch business
    const business = await fetchBusiness(supabase, cleanToNumber);

    if (!business) {
      return NextResponse.json(
        { error: "Business not found for phone number", to_number: cleanToNumber },
        { status: 404 }
      );
    }

    // Fetch program if extension or program_id provided
    const program = await fetchProgram(
      supabase,
      business.id,
      extension || undefined,
      programId || undefined
    );

    // Build combined context
    const context = buildContext(program, business);

    const duration = Date.now() - startTime;

    // Log if response time exceeds target (for monitoring)
    if (duration > 200) {
      console.warn(`⚠️ Business context response time (${duration}ms) exceeds 200ms target`);
    }

    return NextResponse.json(context, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "X-Response-Time": `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Business context error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch business context",
        details: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          "X-Response-Time": `${duration}ms`,
        },
      }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}

