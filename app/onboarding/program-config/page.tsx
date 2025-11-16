"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { updateOnboardingStep } from "@/lib/onboarding";
import { Layers, Plus, X, ArrowRight, ArrowLeft, Loader2, Clock, Users, HelpCircle } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

interface Program {
  id?: string;
  name: string;
  description: string;
  extension: string;
  hours: Record<string, string>;
  appointment_lengths: number[];
  staff: any[];
  faqs: Array<{ question: string; answer: string }>;
}

export default function ProgramConfigPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [currentProgramIndex, setCurrentProgramIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPrograms() {
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");

      if (!businessId) {
        router.push("/login");
        return;
      }

      // Load existing programs
      const { data, error } = await (supabase as any)
        .from("programs")
        .select("*")
        .eq("business_id", businessId);

      if (error) {
        console.error("Error loading programs:", error);
      }

      if (data && data.length > 0) {
        setPrograms(
          data.map((p: any) => ({
            id: p.id,
            name: p.name || "",
            description: p.description || "",
            extension: p.extension || "",
            hours: p.hours || {},
            appointment_lengths: p.appointment_lengths || [60],
            staff: p.staff || [],
            faqs: p.faqs || [],
          }))
        );
      } else {
        // Start with one empty program
        setPrograms([
          {
            name: "",
            description: "",
            extension: "",
            hours: {},
            appointment_lengths: [60],
            staff: [],
            faqs: [],
          },
        ]);
      }

      setLoading(false);
    }

    loadPrograms();
  }, [router]);

  const addProgram = () => {
    setPrograms([
      ...programs,
      {
        name: "",
        description: "",
        extension: "",
        hours: {},
        appointment_lengths: [60],
        staff: [],
        faqs: [],
      },
    ]);
    setCurrentProgramIndex(programs.length);
  };

  const removeProgram = (index: number) => {
    if (programs.length === 1) return; // Keep at least one
    const updated = programs.filter((_, i) => i !== index);
    setPrograms(updated);
    if (currentProgramIndex >= updated.length) {
      setCurrentProgramIndex(updated.length - 1);
    }
  };

  const updateProgram = (index: number, field: keyof Program, value: any) => {
    const updated = [...programs];
    updated[index] = { ...updated[index], [field]: value };
    setPrograms(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = getSupabaseClient();
    const businessId = sessionStorage.getItem("business_id");

    if (!businessId) {
      router.push("/login");
      return;
    }

    // Save all programs
    for (const program of programs) {
      if (!program.name.trim()) continue; // Skip empty programs

      const programData: any = {
        business_id: businessId,
        name: program.name.trim(),
        description: program.description.trim() || null,
        extension: program.extension.trim() || null,
        hours: Object.keys(program.hours).length > 0 ? program.hours : null,
        appointment_lengths: program.appointment_lengths,
        staff: program.staff.length > 0 ? program.staff : null,
        faqs: program.faqs.length > 0 ? program.faqs : null,
      };

      if (program.id) {
        // Update existing
        await (supabase as any).from("programs").update(programData).eq("id", program.id);
      } else {
        // Create new
        await (supabase as any).from("programs").insert(programData);
      }
    }

    // Update onboarding step
    await updateOnboardingStep(businessId, 4);

    // Navigate to test call
    router.push("/onboarding/test-call");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  const currentProgram = programs[currentProgramIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-6 sm:p-8 border border-white/10"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Add Your Programs</h1>
        <p className="text-white/60">
          Set up each program or department in your clinic.
        </p>
      </div>

      {/* Program Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {programs.map((program, index) => (
          <button
            key={index}
            onClick={() => setCurrentProgramIndex(index)}
            className={`px-4 py-2 rounded-lg border transition-colors whitespace-nowrap ${
              currentProgramIndex === index
                ? "border-white/30 bg-white/10"
                : "border-white/10 hover:border-white/20"
            }`}
            style={
              currentProgramIndex === index
                ? {
                    borderColor: `${accentColor}66`,
                    backgroundColor: `${accentColor}1A`,
                  }
                : {}
            }
          >
            <span className="text-sm font-medium text-white">
              {program.name || `Program ${index + 1}`}
            </span>
            {programs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeProgram(index);
                }}
                className="ml-2 text-white/40 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </button>
        ))}
        <button
          onClick={addProgram}
          className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors text-white/60 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Program Form */}
      {currentProgram && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Program Name *
            </label>
            <input
              type="text"
              value={currentProgram.name}
              onChange={(e) => updateProgram(currentProgramIndex, "name", e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
              placeholder="e.g., Outpatient Therapy, Psychiatry, Intake"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Description
            </label>
            <textarea
              value={currentProgram.description}
              onChange={(e) => updateProgram(currentProgramIndex, "description", e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all min-h-[100px]"
              placeholder="Brief description of this program..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Extension (Optional)
            </label>
            <input
              type="text"
              value={currentProgram.extension}
              onChange={(e) => updateProgram(currentProgramIndex, "extension", e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all"
              placeholder="e.g., 101, 201"
            />
            <p className="text-xs text-white/40 mt-1">
              Extension number for direct routing to this program
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Appointment Lengths (minutes)
            </label>
            <div className="flex flex-wrap gap-2">
              {[30, 45, 60, 90, 120].map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => {
                    const lengths = currentProgram.appointment_lengths || [];
                    if (lengths.includes(length)) {
                      updateProgram(
                        currentProgramIndex,
                        "appointment_lengths",
                        lengths.filter((l) => l !== length)
                      );
                    } else {
                      updateProgram(currentProgramIndex, "appointment_lengths", [...lengths, length]);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    currentProgram.appointment_lengths?.includes(length)
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 hover:border-white/20"
                  }`}
                  style={
                    currentProgram.appointment_lengths?.includes(length)
                      ? {
                          borderColor: `${accentColor}66`,
                          backgroundColor: `${accentColor}1A`,
                          color: accentColor,
                        }
                      : { color: "white" }
                  }
                >
                  {length} min
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl glass border border-white/10 bg-white/5">
            <p className="text-sm text-white/60">
              <strong className="text-white">Note:</strong> You can configure hours, staff, and FAQs for each program after completing onboarding in the Programs section.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-white/10">
        <motion.button
          onClick={() => router.push("/onboarding/mode-selection")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 hover:bg-white/10 transition-colors text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </motion.button>

        <motion.button
          onClick={handleSave}
          disabled={saving || !currentProgram?.name.trim()}
          whileHover={{ scale: saving ? 1 : 1.02 }}
          whileTap={{ scale: saving ? 1 : 0.98 }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all disabled:opacity-50"
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
              Continue to Test Call
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

