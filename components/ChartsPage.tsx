"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Brain, TrendingUp, Phone, Calendar, DollarSign, BarChart3, ArrowLeft, ArrowRight } from "lucide-react";

interface ChartData {
  labels: string[];
  values: number[];
}

export function ChartsPage() {
  const [selectedMetric, setSelectedMetric] = useState<"calls" | "bookings" | "conversion" | "savings">("calls");
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [chartData, setChartData] = useState<ChartData>({ labels: [], values: [] });
  const [loading, setLoading] = useState(true);

  const metrics = [
    { id: "calls" as const, label: "Total Calls Handled", icon: Phone, color: "text-blue-400" },
    { id: "bookings" as const, label: "Bookings", icon: Calendar, color: "text-green-400" },
    { id: "conversion" as const, label: "Conversion Rate", icon: TrendingUp, color: "text-yellow-400" },
    { id: "savings" as const, label: "Estimated Savings", icon: DollarSign, color: "text-purple-400" },
  ];

  useEffect(() => {
    async function loadChartData() {
      setLoading(true);
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        setLoading(false);
        return;
      }

      const now = new Date();
      let startDate: Date;

      if (timePeriod === "daily") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7); // Last 7 days
      } else if (timePeriod === "weekly") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 28); // Last 4 weeks
      } else {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
      }

      try {
        const { data: calls, error } = await supabase
          .from("calls")
          .select("started_at, schedule")
          .eq("business_id", businessId)
          .gte("started_at", startDate.toISOString())
          .order("started_at", { ascending: true });

        if (error) throw error;

        // Process data based on selected metric and time period
        const processed = processChartData(calls || [], selectedMetric, timePeriod);
        setChartData(processed);
      } catch (error) {
        console.error("Error loading chart data:", error);
        // Fallback to sample data
        setChartData({
          labels: timePeriod === "daily" 
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            : timePeriod === "weekly"
            ? ["Week 1", "Week 2", "Week 3", "Week 4"]
            : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          values: Array(timePeriod === "daily" ? 7 : timePeriod === "weekly" ? 4 : 12)
            .fill(0)
            .map(() => Math.floor(Math.random() * 50) + 10),
        });
      } finally {
        setLoading(false);
      }
    }

    loadChartData();
  }, [selectedMetric, timePeriod]);

  function processChartData(
    calls: Array<{ started_at: string; schedule: any }>,
    metric: typeof selectedMetric,
    period: typeof timePeriod
  ): ChartData {
    const dataMap = new Map<string, number>();

    calls.forEach((call) => {
      const date = new Date(call.started_at);
      let key: string;

      if (period === "daily") {
        key = date.toLocaleDateString("en-US", { weekday: "short" });
      } else if (period === "weekly") {
        const weekNum = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
        key = `Week ${weekNum}`;
      } else {
        key = date.toLocaleDateString("en-US", { month: "short" });
      }

      const currentValue = dataMap.get(key) || 0;

      if (metric === "calls") {
        dataMap.set(key, currentValue + 1);
      } else if (metric === "bookings") {
        if (call.schedule) {
          dataMap.set(key, currentValue + 1);
        }
      } else if (metric === "conversion") {
        // Calculate conversion rate
        const totalCalls = calls.filter((c) => {
          const cDate = new Date(c.started_at);
          const cKey = period === "daily"
            ? cDate.toLocaleDateString("en-US", { weekday: "short" })
            : period === "weekly"
            ? `Week ${Math.floor((cDate.getTime() - new Date(cDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`
            : cDate.toLocaleDateString("en-US", { month: "short" });
          return cKey === key;
        }).length;
        const bookings = calls.filter((c) => {
          const cDate = new Date(c.started_at);
          const cKey = period === "daily"
            ? cDate.toLocaleDateString("en-US", { weekday: "short" })
            : period === "weekly"
            ? `Week ${Math.floor((cDate.getTime() - new Date(cDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`
            : cDate.toLocaleDateString("en-US", { month: "short" });
          return cKey === key && c.schedule;
        }).length;
        dataMap.set(key, totalCalls > 0 ? (bookings / totalCalls) * 100 : 0);
      } else if (metric === "savings") {
        if (call.schedule) {
          dataMap.set(key, currentValue + 300); // $300 per booking
        }
      }
    });

    // Generate labels based on period
    let labels: string[];
    if (period === "daily") {
      labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    } else if (period === "weekly") {
      labels = Array.from({ length: 4 }, (_, i) => `Week ${i + 1}`);
    } else {
      labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    }

    const values = labels.map((label) => dataMap.get(label) || 0);

    return { labels, values };
  }

  const maxValue = Math.max(...chartData.values, 1);
  const currentMetric = metrics.find((m) => m.id === selectedMetric);

  // Generate AI insights based on selected metric and time period
  const generateInsights = () => {
    if (chartData.values.length === 0) return [];

    const values = chartData.values;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const trend = values.length >= 2 
      ? values[values.length - 1] - values[values.length - 2]
      : 0;
    const isIncreasing = trend > 0;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
    const isVolatile = variance > avg * 0.3;

    const insights: string[] = [];

    // Metric-specific insights
    if (selectedMetric === "calls") {
      if (timePeriod === "daily") {
        const peakDay = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakDay} is your busiest day with ${max} calls handled. Consider allocating more resources on this day.`,
          isIncreasing 
            ? `Call volume is trending upward. Last day saw ${values[values.length - 1]} calls, up from ${values[values.length - 2] || 0} the previous day.`
            : `Call volume decreased by ${Math.abs(trend)} calls compared to the previous day. Monitor for patterns.`,
          `Average daily call volume: ${Math.round(avg)} calls. ${isVolatile ? 'High variability suggests inconsistent demand patterns.' : 'Consistent volume indicates stable operations.'}`
        );
      } else if (timePeriod === "weekly") {
        const peakWeek = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakWeek} was your busiest week with ${max} total calls. Analyze what drove this spike.`,
          `Weekly average: ${Math.round(avg)} calls per week. ${isIncreasing ? 'Trending upward suggests growing demand.' : 'Stable trend indicates consistent operations.'}`,
          `Week-over-week change: ${trend > 0 ? '+' : ''}${Math.round(trend)} calls. ${Math.abs(trend) > avg * 0.2 ? 'Significant change detected - investigate external factors.' : 'Normal variation observed.'}`
        );
      } else {
        const peakMonth = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakMonth} was your peak month with ${max} calls. This represents ${((max / values.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}% of total volume.`,
          `Monthly average: ${Math.round(avg)} calls. ${isIncreasing ? 'Sustained growth pattern indicates business expansion.' : 'Consistent monthly volume shows stable operations.'}`,
          `Year-over-year trend: ${trend > 0 ? 'Growing' : 'Declining'} by ${Math.abs(Math.round(trend))} calls monthly. ${Math.abs(trend) > avg * 0.15 ? 'Consider strategic adjustments.' : 'Healthy growth trajectory.'}`
        );
      }
    } else if (selectedMetric === "bookings") {
      if (timePeriod === "daily") {
        const peakDay = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakDay} generates the most bookings (${max}). Focus marketing efforts on this day.`,
          `Daily booking average: ${Math.round(avg)} appointments. ${isIncreasing ? 'Recent uptick suggests effective outreach.' : 'Consistent daily bookings indicate steady demand.'}`,
          `${trend > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(trend)} bookings day-over-day. ${Math.abs(trend) > avg * 0.3 ? 'Significant shift - review booking sources.' : 'Normal daily variation.'}`
        );
      } else if (timePeriod === "weekly") {
        const peakWeek = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakWeek} had ${max} bookings - your best week. Replicate strategies from this period.`,
          `Weekly booking average: ${Math.round(avg)} appointments. ${isIncreasing ? 'Growing weekly bookings show improving conversion.' : 'Stable weekly bookings indicate consistent performance.'}`,
          `Week-over-week: ${trend > 0 ? '+' : ''}${Math.round(trend)} bookings. ${Math.abs(trend) > avg * 0.25 ? 'Notable change - analyze contributing factors.' : 'Expected weekly fluctuation.'}`
        );
      } else {
        const peakMonth = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakMonth} achieved ${max} bookings - peak performance month. Identify success factors.`,
          `Monthly average: ${Math.round(avg)} bookings. ${isIncreasing ? 'Month-over-month growth indicates scaling success.' : 'Consistent monthly bookings show reliable operations.'}`,
          `Monthly trend: ${trend > 0 ? 'Increasing' : 'Decreasing'} by ${Math.abs(Math.round(trend))} bookings. ${Math.abs(trend) > avg * 0.2 ? 'Strategic review recommended.' : 'Healthy booking pattern maintained.'}`
        );
      }
    } else if (selectedMetric === "conversion") {
      if (timePeriod === "daily") {
        const peakDay = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakDay} has the highest conversion rate at ${max.toFixed(1)}%. Study what makes this day effective.`,
          `Average daily conversion: ${avg.toFixed(1)}%. ${avg > 50 ? 'Above 50% is excellent performance.' : avg > 30 ? 'Good conversion rate - room for improvement.' : 'Below 30% - focus on conversion optimization.'}`,
          `Conversion ${isIncreasing ? 'improved' : 'declined'} by ${Math.abs(trend).toFixed(1)}% day-over-day. ${Math.abs(trend) > 5 ? 'Significant change - review call handling process.' : 'Normal daily variation.'}`
        );
      } else if (timePeriod === "weekly") {
        const peakWeek = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakWeek} achieved ${max.toFixed(1)}% conversion - your best week. Analyze successful tactics.`,
          `Weekly average conversion: ${avg.toFixed(1)}%. ${avg > 50 ? 'Strong weekly performance.' : 'Opportunity to improve weekly conversion rates.'}`,
          `Week-over-week conversion change: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%. ${Math.abs(trend) > 5 ? 'Notable shift - investigate training or process changes.' : 'Stable conversion performance.'}`
        );
      } else {
        const peakMonth = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakMonth} reached ${max.toFixed(1)}% conversion rate - peak performance. Identify key success drivers.`,
          `Monthly average conversion: ${avg.toFixed(1)}%. ${avg > 50 ? 'Consistently high monthly conversion indicates strong operations.' : 'Monthly conversion optimization opportunity exists.'}`,
          `Monthly trend: ${trend > 0 ? 'Improving' : 'Declining'} by ${Math.abs(trend).toFixed(1)}%. ${Math.abs(trend) > 3 ? 'Significant monthly trend - strategic action needed.' : 'Healthy conversion trend maintained.'}`
        );
      }
    } else if (selectedMetric === "savings") {
      if (timePeriod === "daily") {
        const peakDay = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakDay} generated $${max.toLocaleString()} in estimated savings - your most valuable day.`,
          `Daily average savings: $${Math.round(avg).toLocaleString()}. ${isIncreasing ? 'Growing daily savings show improving efficiency.' : 'Consistent daily savings indicate stable value generation.'}`,
          `Savings ${isIncreasing ? 'increased' : 'decreased'} by $${Math.abs(Math.round(trend)).toLocaleString()} day-over-day. ${Math.abs(trend) > avg * 0.3 ? 'Significant daily change - review booking quality.' : 'Normal daily savings variation.'}`
        );
      } else if (timePeriod === "weekly") {
        const peakWeek = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakWeek} saved $${max.toLocaleString()} - your best week. Replicate this week's strategies.`,
          `Weekly average savings: $${Math.round(avg).toLocaleString()}. ${isIncreasing ? 'Growing weekly savings demonstrate ROI improvement.' : 'Stable weekly savings show consistent value delivery.'}`,
          `Week-over-week savings change: ${trend > 0 ? '+' : ''}$${Math.round(trend).toLocaleString()}. ${Math.abs(trend) > avg * 0.25 ? 'Notable weekly shift - analyze booking patterns.' : 'Expected weekly savings fluctuation.'}`
        );
      } else {
        const peakMonth = chartData.labels[values.indexOf(max)];
        insights.push(
          `${peakMonth} achieved $${max.toLocaleString()} in savings - peak value month. Identify what drove this success.`,
          `Monthly average savings: $${Math.round(avg).toLocaleString()}. ${isIncreasing ? 'Month-over-month growth shows scaling success.' : 'Consistent monthly savings indicate reliable operations.'}`,
          `Monthly savings trend: ${trend > 0 ? 'Increasing' : 'Decreasing'} by $${Math.abs(Math.round(trend)).toLocaleString()}. ${Math.abs(trend) > avg * 0.2 ? 'Strategic review of savings drivers recommended.' : 'Healthy savings trajectory maintained.'}`
        );
      }
    }

    return insights;
  };

  const insights = generateInsights();

  return (
    <div className="space-y-6">
      {/* AI Insights Mode Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border border-yellow-500/30 rounded-xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Brain className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">AI Insights Mode</h3>
            <p className="text-xs text-white/60 mt-0.5">
              Interactive charts showing performance trends. Tap metrics to switch views.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Metric Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isSelected = selectedMetric === metric.id;
          return (
            <motion.button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-xl glass border transition-all ${
                isSelected
                  ? "border-yellow-500/50 bg-yellow-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${isSelected ? metric.color : "text-white/60"}`} />
                <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/60"}`}>
                  {metric.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center gap-2">
        {(["daily", "weekly", "monthly"] as const).map((period) => (
          <motion.button
            key={period}
            onClick={() => setTimePeriod(period)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timePeriod === period
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
            }`}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </motion.button>
        ))}
      </div>

      {/* Chart Display */}
      <motion.div
        key={`${selectedMetric}-${timePeriod}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border border-yellow-500/20 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {currentMetric && (
                <>
                  <currentMetric.icon className={`h-5 w-5 ${currentMetric.color}`} />
                  {currentMetric.label}
                </>
              )}
            </h3>
            <p className="text-xs text-white/60 mt-1">
              {timePeriod === "daily"
                ? "Last 7 days"
                : timePeriod === "weekly"
                ? "Last 4 weeks"
                : "Last 12 months"}
            </p>
          </div>
          {chartData.values.length > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-400">
                {selectedMetric === "conversion"
                  ? `${Math.max(...chartData.values).toFixed(1)}%`
                  : selectedMetric === "savings"
                  ? `$${Math.max(...chartData.values).toLocaleString()}`
                  : Math.max(...chartData.values)}
              </div>
              <div className="text-xs text-white/60">Peak Value</div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-64">
              {chartData.labels.map((label, index) => {
                const value = chartData.values[index] || 0;
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                return (
                  <motion.div
                    key={`${label}-${index}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
                    className="flex-1 flex flex-col items-center group"
                  >
                    <motion.div
                      className={`w-full rounded-t-lg ${
                        selectedMetric === "calls"
                          ? "bg-gradient-to-t from-blue-500/80 to-blue-400"
                          : selectedMetric === "bookings"
                          ? "bg-gradient-to-t from-green-500/80 to-green-400"
                          : selectedMetric === "conversion"
                          ? "bg-gradient-to-t from-yellow-500/80 to-yellow-400"
                          : "bg-gradient-to-t from-purple-500/80 to-purple-400"
                      } relative cursor-pointer hover:opacity-80 transition-opacity`}
                      style={{ height: `${height}%` }}
                      whileHover={{ scaleY: 1.05 }}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {selectedMetric === "conversion"
                          ? `${value.toFixed(1)}%`
                          : selectedMetric === "savings"
                          ? `$${value.toLocaleString()}`
                          : value}
                      </div>
                    </motion.div>
                    <div className="mt-2 text-xs text-white/60 text-center">{label}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div>
                <div className="text-xs text-white/60">Average</div>
                <div className="text-lg font-semibold text-white">
                  {chartData.values.length > 0
                    ? selectedMetric === "conversion"
                      ? `${(chartData.values.reduce((a, b) => a + b, 0) / chartData.values.length).toFixed(1)}%`
                      : selectedMetric === "savings"
                      ? `$${Math.round(chartData.values.reduce((a, b) => a + b, 0) / chartData.values.length).toLocaleString()}`
                      : Math.round(chartData.values.reduce((a, b) => a + b, 0) / chartData.values.length)
                    : 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">Total</div>
                <div className="text-lg font-semibold text-white">
                  {selectedMetric === "conversion"
                    ? `${(chartData.values.reduce((a, b) => a + b, 0) / chartData.values.length).toFixed(1)}%`
                    : selectedMetric === "savings"
                    ? `$${chartData.values.reduce((a, b) => a + b, 0).toLocaleString()}`
                    : chartData.values.reduce((a, b) => a + b, 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">Trend</div>
                <div className="text-lg font-semibold flex items-center gap-1">
                  {chartData.values.length >= 2 && (
                    <>
                      {chartData.values[chartData.values.length - 1] >
                      chartData.values[chartData.values.length - 2] ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <span className="text-green-400">Up</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 text-red-400 rotate-180" />
                          <span className="text-red-400">Down</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Navigation Hint */}
      <div className="flex items-center justify-center gap-2 text-xs text-white/40">
        <ArrowLeft className="h-3 w-3" />
        <span>Tap metrics above to switch charts</span>
        <ArrowRight className="h-3 w-3" />
      </div>

      {/* AI Insights Section */}
      <motion.div
        key={`${selectedMetric}-${timePeriod}-insights`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass border border-yellow-500/20 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">
            AI Insights: {currentMetric?.label} ({timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)})
          </h3>
        </div>
        
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <div className="mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              </div>
              <p className="text-sm text-white/90 flex-1 leading-relaxed">{insight}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

