"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { checkOnboardingStatus, getStepRoute } from "@/lib/onboarding";
import { motion } from "framer-motion";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOnboardingStatus() {
      const businessId = sessionStorage.getItem("business_id");
      const supabase = getSupabaseClient();
      const authUserId = (await supabase.auth.getUser()).data.user?.id;
      
      if (!businessId) {
        router.push("/login");
        return;
      }

      // Check if owner needs to complete onboarding
      if (authUserId) {
        const { data: userData } = await supabase
          .from("users")
          .select("role, owner_onboarding_completed")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        
        // If owner hasn't completed onboarding, ensure they stay in onboarding flow
        if (userData && (userData as any).role === "owner" && !(userData as any).owner_onboarding_completed) {
          // Force them to stay in onboarding - don't redirect away
          // Continue with onboarding flow
        } else if (userData && (userData as any).role === "owner" && (userData as any).owner_onboarding_completed) {
          // Owner has completed onboarding, check business onboarding status
          const status = await checkOnboardingStatus(businessId);
          if (status.completed) {
            router.push("/");
            return;
          }
        }
      }

      const status = await checkOnboardingStatus(businessId);
      
      // If onboarding is completed and user is not an owner who needs onboarding, redirect to dashboard
      if (status.completed) {
        // Double-check owner status before redirecting
        if (authUserId) {
          const { data: userData } = await supabase
            .from("users")
            .select("role, owner_onboarding_completed")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          
          // If owner hasn't completed their personal onboarding, keep them in flow
          if (userData && (userData as any).role === "owner" && !(userData as any).owner_onboarding_completed) {
            // Stay in onboarding
            setLoading(false);
            return;
          }
        }
        router.push("/");
        return;
      }

      // Get current step from URL pathname
      let step = 2; // Default to step 2 (Business Setup)
      
      // Map URL to step number
      if (pathname.includes("business-setup")) step = 2;
      else if (pathname.includes("mode-selection")) step = 3;
      else if (pathname.includes("business-config") || pathname.includes("program-config")) step = 4;
      else if (pathname.includes("test-call")) step = 5;
      else if (pathname.includes("tutorial")) step = 6;
      else if (pathname.includes("go-live")) step = 7;

      setCurrentStep(step);
      setLoading(false);
    }

    loadOnboardingStatus();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="text-white/60">Loading onboarding...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <OnboardingProgress currentStep={currentStep} />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

