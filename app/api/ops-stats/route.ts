import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

type TimeRange = "today" | "week" | "month";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get("range") || "today") as TimeRange;

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

    // Get all businesses
    const { data: businessesData, error: businessesError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, vertical, to_number")
      .order("name");

    if (businessesError) {
      console.error("Error loading businesses:", businessesError);
      return NextResponse.json(
        { error: "Failed to load businesses", details: businessesError.message },
        { status: 500 }
      );
    }

    if (!businessesData || businessesData.length === 0) {
      return NextResponse.json({ businesses: [], totalStats: null });
    }

    // Get call stats for each business
    const businessStats = await Promise.all(
      businessesData.map(async (business: any) => {
        const { data: callsData, error: callsError } = await supabaseAdmin
          .from("calls")
          .select("id, status, success, escalate, upsell, schedule, duration_sec, started_at, ended_at")
          .eq("business_id", business.id)
          .gte("started_at", start.toISOString())
          .lte("started_at", end.toISOString());

        if (callsError) {
          console.error(`Error loading calls for ${business.name}:`, callsError);
          return null;
        }

        const calls = callsData || [];
        const totalCalls = calls.length;
        const successfulCalls = calls.filter((c: any) => c.success === true).length;
        const failedCalls = calls.filter((c: any) => c.success === false).length;
        const escalatedCalls = calls.filter((c: any) => c.escalate === true).length;
        const upsellCalls = calls.filter((c: any) => c.upsell === true).length;
        const bookings = calls.filter((c: any) => c.schedule !== null).length;
        
        const durations = calls
          .filter((c: any) => c.duration_sec && c.duration_sec > 0)
          .map((c: any) => c.duration_sec || 0);
        const avgDuration = durations.length > 0
          ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
          : 0;

        const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

        // Get last call timestamp
        const callsWithStart = calls.filter((c: any) => c.started_at);
        const lastCall = callsWithStart.length > 0
          ? callsWithStart.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
          : null;
        const lastCallAt = lastCall ? (lastCall as any).started_at : null;

        // Determine status
        let status: "healthy" | "warning" | "critical" = "healthy";
        if (totalCalls === 0) {
          status = "warning"; // No calls might indicate an issue
        } else if (successRate < 50) {
          status = "critical";
        } else if (successRate < 70 || escalatedCalls / totalCalls > 0.3) {
          status = "warning";
        }

        return {
          id: business.id,
          name: business.name || "Unnamed Business",
          vertical: business.vertical,
          to_number: business.to_number,
          total_calls: totalCalls,
          successful_calls: successfulCalls,
          failed_calls: failedCalls,
          escalated_calls: escalatedCalls,
          upsell_calls: upsellCalls,
          bookings: bookings,
          avg_duration: avgDuration,
          success_rate: successRate,
          last_call_at: lastCallAt,
          status,
        };
      })
    );

    // Filter out nulls and sort by total calls (descending)
    const validStats = businessStats.filter((b): b is NonNullable<typeof b> => b !== null);
    validStats.sort((a, b) => b.total_calls - a.total_calls);

    // Calculate total stats
    const totalStats = {
      total_calls: validStats.reduce((sum, b) => sum + b.total_calls, 0),
      successful_calls: validStats.reduce((sum, b) => sum + b.successful_calls, 0),
      failed_calls: validStats.reduce((sum, b) => sum + b.failed_calls, 0),
      escalated_calls: validStats.reduce((sum, b) => sum + b.escalated_calls, 0),
      upsell_calls: validStats.reduce((sum, b) => sum + b.upsell_calls, 0),
      bookings: validStats.reduce((sum, b) => sum + b.bookings, 0),
      avg_success_rate: validStats.length > 0
        ? validStats.reduce((sum, b) => sum + b.success_rate, 0) / validStats.length
        : 0,
      healthy: validStats.filter(b => b.status === "healthy").length,
      warning: validStats.filter(b => b.status === "warning").length,
      critical: validStats.filter(b => b.status === "critical").length,
    };

    return NextResponse.json({
      businesses: validStats,
      totalStats,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in ops-stats API:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

