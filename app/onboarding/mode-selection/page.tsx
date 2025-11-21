"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { updateOnboardingStep } from "@/lib/onboarding";
import { Building2, Layers, ArrowRight, Loader2 } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

export default function ModeSelectionPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [selectedMode, setSelectedMode] = useState<"business" | "program" | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selectedMode) return;

    setSaving(true);
    const businessId = sessionStorage.getItem("business_id");

    if (!businessId) {
      router.push("/login");
      return;
    }

    // Update onboarding step
    await updateOnboardingStep(businessId, 3);

    // Store mode in sessionStorage
    sessionStorage.setItem("onboarding_mode", selectedMode);

    // Navigate to appropriate configurator
    if (selectedMode === "business") {
      router.push("/onboarding/business-config");
    } else {
      router.push("/onboarding/program-config");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-6 sm:p-8 border border-white/10"
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">How is your clinic structured?</h1>
        <p className="text-white/60">
          This helps us set up your AI receptionist correctly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <motion.button
          onClick={() => setSelectedMode("business")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`p-6 rounded-2xl border-2 transition-all text-left ${
            selectedMode === "business"
              ? "border-white/30 bg-white/10"
              : "border-white/10 hover:border-white/20"
          }`}
          style={
            selectedMode === "business"
              ? {
                  borderColor: `${accentColor}66`,
                  backgroundColor: `${accentColor}1A`,
                }
              : {}
          }
        >
          <Building2
            className="h-12 w-12 mb-4"
            style={selectedMode === "business" ? { color: accentColor } : { color: "white" }}
          />
          <h3 className="text-xl font-bold text-white mb-2">One Unified Program</h3>
          <p className="text-white/60 text-sm">
            Your clinic operates as a single, unified practice. All services, staff, and hours are shared across the business.
          </p>
          {selectedMode === "business" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center gap-2 text-sm"
              style={{ color: accentColor }}
            >
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
              Selected
            </motion.div>
          )}
        </motion.button>

        <motion.button
          onClick={() => setSelectedMode("program")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`p-6 rounded-2xl border-2 transition-all text-left ${
            selectedMode === "program"
              ? "border-white/30 bg-white/10"
              : "border-white/10 hover:border-white/20"
          }`}
          style={
            selectedMode === "program"
              ? {
                  borderColor: `${accentColor}66`,
                  backgroundColor: `${accentColor}1A`,
                }
              : {}
          }
        >
          <Layers
            className="h-12 w-12 mb-4"
            style={selectedMode === "program" ? { color: accentColor } : { color: "white" }}
          />
          <h3 className="text-xl font-bold text-white mb-2">Multiple Programs/Departments</h3>
          <p className="text-white/60 text-sm">
            Your clinic has separate departments or programs (e.g., Therapy, Psychiatry, Intake, Weight Loss) with different staff, hours, or services.
          </p>
          {selectedMode === "program" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center gap-2 text-sm"
              style={{ color: accentColor }}
            >
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
              Selected
            </motion.div>
          )}
        </motion.button>
      </div>

      <div className="flex justify-end">
        <motion.button
          onClick={handleContinue}
          disabled={!selectedMode || saving}
          whileHover={{ scale: saving || !selectedMode ? 1 : 1.02 }}
          whileTap={{ scale: saving || !selectedMode ? 1 : 0.98 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}




