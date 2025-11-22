import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Update business settings using admin client to bypass RLS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, ...updateData } = body;

    if (!business_id) {
      return NextResponse.json(
        { error: "business_id is required" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (server-side only)
    const supabaseAdmin = getSupabaseAdminClient();

    // Update the business
    // @ts-ignore - Supabase types don't support dynamic update data
    const { data: updatedBusiness, error: updateError } = await supabaseAdmin
      .from("businesses")
      // @ts-ignore
      .update(updateData)
      .eq("id", business_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating business:", updateError);
      return NextResponse.json(
        { 
          error: "Failed to update business",
          details: updateError.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      business: updatedBusiness,
    });
  } catch (error) {
    console.error("Business update error:", error);
    return NextResponse.json(
      { 
        error: "Failed to update business",
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
