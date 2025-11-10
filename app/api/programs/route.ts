import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, extension, phone_number, description, business_id, services, staff, hours, faqs, promos } = body;

    if (!name || !business_id) {
      return NextResponse.json(
        { error: "Name and business_id are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await (supabaseAdmin as any)
      .from("programs")
      .insert({
        name,
        extension: extension || null,
        phone_number: phone_number || null,
        description: description || null,
        business_id,
        services: services || null,
        staff: staff || null,
        hours: hours || null,
        faqs: faqs || null,
        promos: promos || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating program:", error);
      return NextResponse.json(
        { error: "Failed to create program", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Unexpected error in programs API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, extension, phone_number, description, services, staff, hours, faqs, promos } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Program id is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const updateData: any = {
      name,
      extension: extension || null,
      phone_number: phone_number || null,
      description: description || null,
      services: services || null,
      staff: staff || null,
      hours: hours || null,
      faqs: faqs || null,
      promos: promos || null,
    };

    const { data, error } = await (supabaseAdmin as any)
      .from("programs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating program:", error);
      return NextResponse.json(
        { error: "Failed to update program", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Unexpected error in programs API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Program id is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { error } = await (supabaseAdmin as any)
      .from("programs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting program:", error);
      return NextResponse.json(
        { error: "Failed to delete program", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in programs API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

