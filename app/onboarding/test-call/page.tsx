"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { updateOnboardingStep } from "@/lib/onboarding";
import { TestCallModal } from "@/components/onboarding/TestCallModal";
import { Phone, CheckCircle2, ArrowRight, Loader2, Building2, Clock, Users, Tag, HelpCircle } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

export default function TestCallPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [calling, setCalling] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [testCallId, setTestCallId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBusinessData() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        router.push("/login");
        return;
      }

      // Load business
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("name, hours, staff, services, faqs")
        .eq("id", businessId)
        .single();

      if (businessError) {
        console.error("Error loading business:", businessError);
        setLoading(false);
        return;
      }

      setBusiness(businessData);

      // Load programs if any
      const { data: programsData } = await (supabase as any)
        .from("programs")
        .select("name")
        .eq("business_id", businessId);

      if (programsData) {
        setPrograms(programsData);
      }

      setLoading(false);
    }

    loadBusinessData();
  }, [router]);

  const handleTestCall = async () => {
    setCalling(true);
    const businessId = sessionStorage.getItem("business_id");

    if (!businessId) {
      router.push("/login");
      return;
    }

    try {
      // Call your test call API endpoint
      // This should initiate a test call via Vapi
      const response = await fetch("/api/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to start test call");
      }

      // Open modal with call ID
      setTestCallId(result.call_id);
      setShowModal(true);
    } catch (error) {
      console.error("Error starting test call:", error);
      alert("Failed to start test call. Please try again.");
    } finally {
      setCalling(false);
    }
  };

  const handleContinue = async () => {
    const businessId = sessionStorage.getItem("business_id");
    if (businessId) {
      await updateOnboardingStep(businessId, 5);
      router.push("/onboarding/tutorial");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  const staffCount = Array.isArray(business?.staff) ? business.staff.length : 0;
  const servicesCount = Array.isArray(business?.services) ? business.services.length : 0;
  const faqsCount = Array.isArray(business?.faqs) ? business.faqs.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-6 sm:p-8 border border-white/10"
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Your AI Receptionist Is Ready</h1>
        <p className="text-white/60">
          Review your setup and test your AI receptionist with a live call.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl glass border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-5 w-5" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-white/60">Business</span>
          </div>
          <p className="text-lg font-bold text-white">{business?.name || "Not set"}</p>
        </div>

        <div className="p-4 rounded-xl glass border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-white/60">Hours</span>
          </div>
          <p className="text-lg font-bold text-white">
            {business?.hours ? "Configured" : "Not set"}
          </p>
        </div>

        <div className="p-4 rounded-xl glass border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-white/60">Staff</span>
          </div>
          <p className="text-lg font-bold text-white">{staffCount} member{staffCount !== 1 ? "s" : ""}</p>
        </div>

        <div className="p-4 rounded-xl glass border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Tag className="h-5 w-5" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-white/60">Services</span>
          </div>
          <p className="text-lg font-bold text-white">{servicesCount} service{servicesCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {programs.length > 0 && (
        <div className="mb-8 p-4 rounded-xl glass border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <HelpCircle className="h-5 w-5" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-white/60">Programs</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {programs.map((program, index) => (
              <span
                key={index}
                className="px-3 py-1 rounded-lg bg-white/5 text-white text-sm border border-white/10"
              >
                {program.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Test Call Button */}
      <div className="text-center mb-8">
        <motion.button
          onClick={handleTestCall}
          disabled={calling}
          whileHover={{ scale: calling ? 1 : 1.05 }}
          whileTap={{ scale: calling ? 1 : 0.95 }}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl border font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          {calling ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Phone className="h-5 w-5" />
              Test Call Now
            </>
          )}
        </motion.button>
        <p className="text-sm text-white/40 mt-3">
          Call your AI receptionist to see how it handles real conversations
        </p>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end pt-6 border-t border-white/10">
        <motion.button
          onClick={handleContinue}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all"
          style={{
            backgroundColor: `${accentColor}33`,
            borderColor: `${accentColor}4D`,
            color: accentColor,
          }}
        >
          Continue to Tutorial
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Test Call Modal */}
      {showModal && testCallId && (
        <TestCallModal
          callId={testCallId}
          businessId={sessionStorage.getItem("business_id") || ""}
          onClose={() => {
            setShowModal(false);
            setTestCallId(null);
          }}
        />
      )}
    </motion.div>
  );
}

