import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * Test Call API Endpoint
 * Initiates a test call for onboarding Step 5
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = body;

    if (!business_id) {
      return NextResponse.json(
        { error: "business_id is required" },
        { status: 400 }
      );
    }

    // Get business phone number
    const supabase = getSupabaseClient();
    const businessResult = await supabase
      .from("businesses")
      .select("to_number")
      .eq("id", business_id)
      .single();

    const business = businessResult.data as { to_number: string } | null;
    const businessError = businessResult.error;

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    if (!business.to_number) {
      return NextResponse.json(
        { error: "Business phone number not configured" },
        { status: 400 }
      );
    }

    // TODO: Integrate with Vapi API to initiate test call
    // For now, return a mock call_id
    // In production, you would:
    // 1. Call Vapi API to create a test call
    // 2. Return the actual call_id from Vapi
    
    const mockCallId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create a test call record in database
    const { data: callData, error: callError } = await supabase
      .from("calls")
      .insert({
        business_id: business_id,
        call_id: mockCallId,
        status: "active",
        to_number: business.to_number,
        route: "F1",
      })
      .select()
      .single();

    if (callError) {
      console.error("Error creating test call record:", callError);
      // Continue anyway - return mock call_id
    }

    return NextResponse.json({
      success: true,
      call_id: callData?.call_id || mockCallId,
      message: "Test call initiated",
    });

  } catch (error) {
    console.error("Error in test-call API:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

