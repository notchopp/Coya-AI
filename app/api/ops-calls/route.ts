import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

type TimeRange = "today" | "week" | "month" | "all";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get("range") || "week") as TimeRange;
    const businessId = searchParams.get("business_id") || null;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabaseAdmin = getSupabaseAdminClient();

    const getDateRange = (range: TimeRange) => {
      if (range === "all") return null;
      const now = new Date();
      switch (range) {
        case "today":
          return { start: startOfDay(now), end: now };
        case "week":
          return { start: startOfWeek(now), end: now };
        case "month":
          return { start: startOfMonth(now), end: now };
        default:
          return null;
      }
    };

    const dateRange = getDateRange(timeRange);

    // Build query
    let query = supabaseAdmin
      .from("calls")
      .select(`
        *,
        businesses:business_id (
          id,
          name,
          vertical,
          to_number
        )
      `)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    if (dateRange) {
      query = query
        .gte("started_at", dateRange.start.toISOString())
        .lte("started_at", dateRange.end.toISOString());
    }

    const { data: callsData, error: callsError } = await query;

    if (callsError) {
      console.error("Error loading calls:", callsError);
      return NextResponse.json(
        { error: "Failed to load calls", details: callsError.message },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from("calls")
      .select("*", { count: "exact", head: true });

    if (businessId) {
      countQuery = countQuery.eq("business_id", businessId);
    }

    if (dateRange) {
      countQuery = countQuery
        .gte("started_at", dateRange.start.toISOString())
        .lte("started_at", dateRange.end.toISOString());
    }

    const { count } = await countQuery;

    return NextResponse.json({
      calls: callsData || [],
      total: count || 0,
      limit,
      offset,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in ops-calls API:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

