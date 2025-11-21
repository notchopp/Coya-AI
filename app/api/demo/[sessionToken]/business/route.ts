import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> | { sessionToken: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionToken } = resolvedParams;
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdminClient();

    // Demo business ID - all demo sessions use this same business
    const DEMO_BUSINESS_ID = "eea1f8b5-f4ed-4141-85c7-c381643ce9df";
    const DEMO_PHONE_NUMBER = "+12159862752"; // +1 (215) 986 2752

    // Get session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("demo_sessions")
      .select("id, demo_business_id")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Demo session not found" },
        { status: 404 }
      );
    }

    const sessionData = session as any;

    // Prepare update data - only include fields that exist in the businesses table
    const updateData: any = {
      name: body.name,
      vertical: body.vertical || "medspa",
      is_demo: true,
      demo_phone_number: DEMO_PHONE_NUMBER,
      to_number: DEMO_PHONE_NUMBER,
      is_active: true,
    };

    // Handle categories - store as JSON
    if (body.categories) {
      updateData.categories = typeof body.categories === 'string' ? body.categories : JSON.stringify(body.categories);
    }

    // Handle hours - store as JSON
    if (body.hours) {
      updateData.hours = typeof body.hours === 'string' ? body.hours : JSON.stringify(body.hours);
    }

    // Handle FAQs - store as JSON
    if (body.faqs) {
      updateData.faqs = typeof body.faqs === 'string' ? body.faqs : JSON.stringify(body.faqs);
    }

    // Always update the shared demo business (don't create new ones)
    const { data: business, error: updateError } = await (supabaseAdmin
      .from("businesses") as any)
      .update(updateData)
      .eq("id", DEMO_BUSINESS_ID)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating demo business:", updateError);
      console.error("Update data:", JSON.stringify(updateData, null, 2));
      return NextResponse.json(
        { error: "Failed to update demo business", details: updateError.message },
        { status: 500 }
      );
    }

    // Ensure session is linked to demo business
    if (sessionData.demo_business_id !== DEMO_BUSINESS_ID) {
      await (supabaseAdmin
        .from("demo_sessions") as any)
        .update({ demo_business_id: DEMO_BUSINESS_ID })
        .eq("id", sessionData.id);
    }

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error("Demo business error:", error);
    return NextResponse.json(
      { error: "Failed to save demo business", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

