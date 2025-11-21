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

    // Use the single demo phone number for all demo sessions
    const demoPhoneNumber = "+12159862752"; // +1 (215) 986 2752

    const sessionData = session as any;
    let businessId = sessionData.demo_business_id;

    if (businessId) {
      // Update existing demo business
      const { data: business, error: updateError } = await (supabaseAdmin
        .from("businesses") as any)
        .update({
          ...body,
          is_demo: true,
          demo_session_id: sessionData.id,
          demo_phone_number: demoPhoneNumber,
        })
        .eq("id", businessId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating demo business:", updateError);
        return NextResponse.json(
          { error: "Failed to update demo business", details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, business });
    } else {
      // Create new demo business
      const { data: business, error: createError } = await (supabaseAdmin
        .from("businesses") as any)
        .insert({
          ...body,
          is_demo: true,
          demo_session_id: sessionData.id,
          demo_phone_number: demoPhoneNumber,
          to_number: demoPhoneNumber,
          is_active: true,
          vertical: body.vertical || "medspa",
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating demo business:", createError);
        return NextResponse.json(
          { error: "Failed to create demo business", details: createError.message },
          { status: 500 }
        );
      }

      // Update session with business ID
      await (supabaseAdmin
        .from("demo_sessions") as any)
        .update({ demo_business_id: business.id })
        .eq("id", sessionData.id);

      return NextResponse.json({ success: true, business });
    }
  } catch (error) {
    console.error("Demo business error:", error);
    return NextResponse.json(
      { error: "Failed to save demo business", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

