"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { completeOnboarding } from "@/lib/onboarding";
import { CheckCircle2, Loader2, Rocket, ArrowRight, ArrowLeft, Clock, Users, Tag, Phone } from "lucide-react";
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
    const supabase = getSupabaseClient();
    const authUserId = (await supabase.auth.getUser()).data.user?.id;

    if (!businessId) {
      router.push("/login");
      return;
    }

    try {
      // Complete onboarding (this also sets owner_onboarding_completed if user is owner)
      const success = await completeOnboarding(businessId);

      if (success) {
        // Also explicitly set owner_onboarding_completed to true for owners
        if (authUserId) {
          const { data: userData } = await supabase
            .from("users")
            .select("role")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          
          if (userData && (userData as any).role === "owner") {
            // Use admin client to update owner_onboarding_completed
            try {
              const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
              const supabaseAdmin = getSupabaseAdminClient();
              
              const { error: ownerError } = await (supabaseAdmin
                .from("users") as any)
                .update({ owner_onboarding_completed: true })
                .eq("auth_user_id", authUserId)
                .eq("role", "owner");

              if (ownerError) {
                console.error("Error setting owner_onboarding_completed:", ownerError);
                // Don't fail the whole operation, but log the error
              } else {
                console.log("✅ Owner onboarding marked as completed");
              }
            } catch (adminError) {
              console.error("Error getting admin client:", adminError);
              // Don't fail the whole operation
            }
          }
        }
        
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
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  const allComplete = Object.values(checklist).every((item) => item);

  const handleNavigateToStep = (step: string) => {
    if (step === "hours" || step === "staff" || step === "services") {
      router.push("/onboarding/business-config");
    } else if (step === "testCall") {
      router.push("/onboarding/test-call");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black rounded-3xl p-6 sm:p-8 border border-yellow-400/20"
    >
      {/* Back Button */}
      <div className="mb-6">
        <motion.button
          onClick={() => router.push("/onboarding/tutorial")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-yellow-400/20 hover:bg-yellow-400/10 hover:border-yellow-400/40 transition-all text-yellow-400 font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </motion.button>
      </div>

      <div className="mb-8 text-center">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-yellow-400/20 border-2 border-yellow-400/40"
        >
          <Rocket className="h-10 w-10 text-yellow-400" />
        </motion.div>
        <h1 className="text-3xl font-bold text-white mb-2">Ready to Activate Your AI Receptionist?</h1>
        <p className="text-white/50">
          Once activated, your AI receptionist will start handling real calls.
        </p>
      </div>

      {/* Checklist */}
      <div className="mb-8 space-y-3">
        <h2 className="text-xl font-bold text-white mb-4">Setup Checklist</h2>
        {[
          { key: "hours", label: "Hours configured", icon: Clock, route: "business-config" },
          { key: "staff", label: "At least one staff member added", icon: Users, route: "business-config" },
          { key: "services", label: "At least one service configured", icon: Tag, route: "business-config" },
          { key: "testCall", label: "Test call completed (recommended)", icon: Phone, route: "test-call" },
        ].map((item) => {
          const Icon = item.icon;
          const isComplete = checklist[item.key as keyof typeof checklist];

          return (
            <motion.div
              key={item.key}
              onClick={() => !isComplete && handleNavigateToStep(item.key)}
              whileHover={!isComplete ? { scale: 1.02, x: 4 } : {}}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                isComplete
                  ? "border-yellow-400/30 bg-yellow-400/10 cursor-default"
                  : "border-yellow-400/20 bg-white/5 cursor-pointer hover:border-yellow-400/40 hover:bg-yellow-400/10"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-yellow-400" />
              ) : (
                <Icon className="h-5 w-5 text-yellow-400/60" />
              )}
              <span
                className={`flex-1 font-semibold ${
                  isComplete ? "text-white" : "text-yellow-400/80"
                }`}
              >
                {item.label}
              </span>
              {isComplete ? (
                <span className="text-xs px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 font-bold">
                  Complete
                </span>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 font-bold"
                >
                  <span>Complete</span>
                  <ArrowRight className="h-3 w-3" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Activation Button */}
      <div className="text-center">
        <motion.button
          onClick={handleActivate}
          disabled={activating || !allComplete}
          whileHover={activating || !allComplete ? {} : { scale: 1.05 }}
          whileTap={activating || !allComplete ? {} : { scale: 0.95 }}
          className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl border-2 font-bold text-lg transition-all shadow-lg ${
            allComplete && !activating
              ? "bg-yellow-400 border-yellow-400 text-black hover:bg-yellow-300 hover:border-yellow-300 cursor-pointer"
              : "bg-yellow-400/20 border-yellow-400/30 text-yellow-400/50 cursor-not-allowed"
          }`}
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
          <p className="text-sm text-yellow-400/60 mt-4 font-semibold">
            Click incomplete items above to finish setup
          </p>
        )}
      </div>
    </motion.div>
  );
}

