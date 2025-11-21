import { NextRequest, NextResponse } from "next/server";
import { autoInviteOwner } from "@/lib/auto-invite-owner";

/**
 * API endpoint to automatically invite the owner (whochoppa@gmail.com) when a business is created
 * This should be called after a business is created, or can be triggered by a database webhook
 * 
 * POST /api/auto-invite-owner
 * Body: { business_id: string }
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

    const result = await autoInviteOwner(business_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to invite owner" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Owner invitation sent successfully",
    });

  } catch (error) {
    console.error("Unexpected error in auto-invite-owner API:", error);
    return NextResponse.json(
      { 
        error: "An unexpected error occurred", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}


