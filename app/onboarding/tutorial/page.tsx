"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { updateOnboardingStep } from "@/lib/onboarding";
import { ArrowRight, X } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";
import WelcomeOnboarding, { showTutorial } from "@/components/WelcomeOnboarding";

export default function TutorialPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();

  const handleSkip = async () => {
    const businessId = sessionStorage.getItem("business_id");
    if (businessId) {
      await updateOnboardingStep(businessId, 6);
      router.push("/onboarding/go-live");
    }
  };

  const handleComplete = async () => {
    const businessId = sessionStorage.getItem("business_id");
    if (businessId) {
      await updateOnboardingStep(businessId, 6);
      router.push("/onboarding/go-live");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black rounded-3xl p-6 sm:p-8 border border-yellow-400/20"
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Take a Quick Tour</h1>
        <p className="text-white/50">
          Learn how to use your dashboard (optional - you can skip this)
        </p>
      </div>

      <div className="text-center py-12">
        <p className="text-white/60 mb-6 font-medium">
          The tutorial will show you how to navigate your dashboard and use key features.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={() => {
              // Trigger the welcome onboarding modal
              showTutorial();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 font-bold transition-all shadow-lg"
            style={{
              backgroundColor: `${accentColor}33`,
              borderColor: `${accentColor}66`,
              color: accentColor,
              boxShadow: `0 4px 12px ${accentColor}33`,
            }}
          >
            Start Tutorial
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          <motion.button
            onClick={handleSkip}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl bg-white/5 border border-yellow-400/20 hover:bg-yellow-400/10 hover:border-yellow-400/40 transition-all text-white font-semibold"
          >
            Skip Tutorial
          </motion.button>
        </div>
      </div>

      {/* Use existing WelcomeOnboarding component */}
      <WelcomeOnboarding />
    </motion.div>
  );
}

