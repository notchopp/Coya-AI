import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    // Get all businesses with their details
    const { data: businessesData, error: businessesError } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .order("name");

    if (businessesError) {
      console.error("Error loading businesses:", businessesError);
      return NextResponse.json(
        { error: "Failed to load businesses", details: businessesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      businesses: businessesData || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in ops-businesses API:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

