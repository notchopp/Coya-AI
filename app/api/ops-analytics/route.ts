import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from "date-fns";

type TimeRange = "today" | "week" | "month";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get("range") || "week") as TimeRange;
    const businessId = searchParams.get("business_id") || null;

    const supabaseAdmin = getSupabaseAdminClient();

    const getDateRange = (range: TimeRange) => {
      const now = new Date();
      switch (range) {
        case "today":
          return { start: startOfDay(now), end: now };
        case "week":
          return { start: startOfWeek(now), end: now };
        case "month":
          return { start: startOfMonth(now), end: now };
      }
    };

    const { start, end } = getDateRange(timeRange);

    // Build base query
    let query = supabaseAdmin
      .from("calls")
      .select("*")
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString());

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data: callsData, error: callsError } = await query;

    if (callsError) {
      console.error("Error loading analytics:", callsError);
      return NextResponse.json(
        { error: "Failed to load analytics", details: callsError.message },
        { status: 500 }
      );
    }

    const calls = (callsData || []) as any[];
    const totalCalls = calls.length;

    // Calculate metrics
    const successfulCalls = calls.filter((c: any) => c.success === true).length;
    const failedCalls = calls.filter((c: any) => c.success === false).length;
    const escalatedCalls = calls.filter((c: any) => c.escalate === true).length;
    const upsellCalls = calls.filter((c: any) => c.upsell === true).length;
    const bookings = calls.filter((c: any) => c.schedule !== null).length;

    // Calculate average duration
    const durations = calls
      .filter((c: any) => c.duration_sec && c.duration_sec > 0)
      .map((c: any) => c.duration_sec || 0);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Calculate success rate
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    // Group by intent
    const intentCounts: Record<string, number> = {};
    calls.forEach((call: any) => {
      if (call.last_intent) {
        intentCounts[call.last_intent] = (intentCounts[call.last_intent] || 0) + 1;
      }
    });

    // Group by business (if not filtered)
    const businessStats: Record<string, any> = {};
    if (!businessId) {
      calls.forEach((call: any) => {
        if (!businessStats[call.business_id]) {
          businessStats[call.business_id] = {
            business_id: call.business_id,
            total_calls: 0,
            successful_calls: 0,
            failed_calls: 0,
            bookings: 0,
            escalated_calls: 0,
            upsell_calls: 0,
          };
        }
        const stats = businessStats[call.business_id];
        stats.total_calls++;
        if (call.success === true) stats.successful_calls++;
        if (call.success === false) stats.failed_calls++;
        if (call.schedule) stats.bookings++;
        if (call.escalate) stats.escalated_calls++;
        if (call.upsell) stats.upsell_calls++;
      });
    }

    // Daily breakdown for trends
    const dailyBreakdown: Record<string, { calls: number; successful: number; bookings: number }> = {};
    calls.forEach((call: any) => {
      const date = new Date(call.started_at).toISOString().split('T')[0];
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = { calls: 0, successful: 0, bookings: 0 };
      }
      dailyBreakdown[date].calls++;
      if (call.success === true) dailyBreakdown[date].successful++;
      if (call.schedule) dailyBreakdown[date].bookings++;
    });

    // Get business names if needed
    let businessNames: Record<string, string> = {};
    if (!businessId && Object.keys(businessStats).length > 0) {
      const businessIds = Object.keys(businessStats);
      const { data: businessesData } = await supabaseAdmin
        .from("businesses")
        .select("id, name")
        .in("id", businessIds);
      
      if (businessesData) {
        (businessesData as any[]).forEach((b: any) => {
          businessNames[b.id] = b.name || "Unknown";
        });
      }
    }

    return NextResponse.json({
      summary: {
        total_calls: totalCalls,
        successful_calls: successfulCalls,
        failed_calls: failedCalls,
        escalated_calls: escalatedCalls,
        upsell_calls: upsellCalls,
        bookings: bookings,
        avg_duration: avgDuration,
        success_rate: successRate,
      },
      intent_breakdown: intentCounts,
      business_stats: Object.values(businessStats).map(stat => ({
        ...stat,
        business_name: businessNames[stat.business_id] || "Unknown",
      })),
      daily_breakdown: dailyBreakdown,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in ops-analytics API:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

