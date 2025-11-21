import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseClient } from "@/lib/supabase";

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

    // Verify the user has permission to update this business
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has access to this business
    const { data: userBusiness, error: userError } = await supabase
      .from("users")
      .select("business_id, role")
      .eq("auth_user_id", user.id)
      .eq("business_id", business_id)
      .maybeSingle();

    if (userError || !userBusiness) {
      return NextResponse.json(
        { error: "You don't have permission to update this business" },
        { status: 403 }
      );
    }

    // Only admins and owners can update business settings
    if (userBusiness.role !== "admin" && userBusiness.role !== "owner") {
      return NextResponse.json(
        { error: "Only admins and owners can update business settings" },
        { status: 403 }
      );
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = getSupabaseAdminClient();

    console.log("🔄 Updating business:", {
      business_id,
      updateData,
    });

    const { data: updatedBusiness, error: updateError } = await (supabaseAdmin as any)
      .from("businesses")
      .update(updateData as any)
      .eq("id", business_id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating business:", updateError);
      return NextResponse.json(
        { 
          error: "Failed to update business",
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    if (!updatedBusiness) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    console.log("✅ Business updated successfully:", updatedBusiness);

    return NextResponse.json({
      success: true,
      business: updatedBusiness,
    });
  } catch (error) {
    console.error("Business update API error:", error);
    return NextResponse.json(
      {
        error: "Failed to update business",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

