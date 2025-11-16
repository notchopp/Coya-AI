"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { completeOnboarding } from "@/lib/onboarding";
import { CheckCircle2, Loader2, Rocket, ArrowRight } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

export default function GoLivePage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [activating, setActivating] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState({
    hours: false,
    staff: false,
    services: false,
    testCall: false,
  });

  useEffect(() => {
    async function loadBusiness() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("businesses")
        .select("name, hours, staff, services")
        .eq("id", businessId)
        .single();

      if (error) {
        console.error("Error loading business:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setBusiness(data);
        setChecklist({
          hours: !!data.hours && Object.keys(data.hours).length > 0,
          staff: Array.isArray(data.staff) && data.staff.length > 0,
          services: Array.isArray(data.services) && data.services.length > 0,
          testCall: true, // Assume test call was completed if they reached this step
        });
      }

      setLoading(false);
    }

    loadBusiness();
  }, [router]);

  const handleActivate = async () => {
    setActivating(true);
    const businessId = sessionStorage.getItem("business_id");

    if (!businessId) {
      router.push("/login");
      return;
    }

    try {
      // Complete onboarding
      const success = await completeOnboarding(businessId);

      if (success) {
        // Redirect to dashboard
        router.push("/");
      } else {
        alert("Failed to activate. Please try again.");
        setActivating(false);
      }
    } catch (error) {
      console.error("Error activating:", error);
      alert("Failed to activate. Please try again.");
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  const allComplete = Object.values(checklist).every((item) => item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-6 sm:p-8 border border-white/10"
    >
      <div className="mb-8 text-center">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
          style={{
            backgroundColor: `${accentColor}33`,
            border: `2px solid ${accentColor}66`,
          }}
        >
          <Rocket className="h-10 w-10" style={{ color: accentColor }} />
        </motion.div>
        <h1 className="text-3xl font-bold text-white mb-2">Ready to Activate Your AI Receptionist?</h1>
        <p className="text-white/60">
          Once activated, your AI receptionist will start handling real calls.
        </p>
      </div>

      {/* Checklist */}
      <div className="mb-8 space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">Setup Checklist</h2>
        {[
          { key: "hours", label: "Hours configured", icon: CheckCircle2 },
          { key: "staff", label: "At least one staff member added", icon: CheckCircle2 },
          { key: "services", label: "At least one service configured", icon: CheckCircle2 },
          { key: "testCall", label: "Test call completed (recommended)", icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          const isComplete = checklist[item.key as keyof typeof checklist];

          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                isComplete
                  ? "border-white/20 bg-white/5"
                  : "border-white/10 bg-white/2"
              }`}
              style={
                isComplete
                  ? {
                      borderColor: `${accentColor}4D`,
                      backgroundColor: `${accentColor}1A`,
                    }
                  : {}
              }
            >
              <Icon
                className={`h-5 w-5 ${isComplete ? "" : "text-white/30"}`}
                style={isComplete ? { color: accentColor } : {}}
              />
              <span
                className={`flex-1 ${isComplete ? "text-white" : "text-white/40"}`}
              >
                {item.label}
              </span>
              {isComplete && (
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Complete
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Activation Button */}
      <div className="text-center">
        <motion.button
          onClick={handleActivate}
          disabled={activating || !allComplete}
          whileHover={{ scale: activating || !allComplete ? 1 : 1.05 }}
          whileTap={{ scale: activating || !allComplete ? 1 : 0.95 }}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl border font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          {activating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              Activate Now
            </>
          )}
        </motion.button>
        {!allComplete && (
          <p className="text-sm text-white/40 mt-3">
            Please complete all setup steps before activating
          </p>
        )}
      </div>
    </motion.div>
  );
}

