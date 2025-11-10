"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { useProgram } from "@/components/ProgramProvider";
import { useAccentColor } from "@/components/AccentColorProvider";

type Program = {
  id: string;
  name: string;
  extension: string | null;
  business_id: string;
  description: string | null;
};

export default function SelectProgramPage() {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const { setProgram, businessId } = useProgram();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    async function loadPrograms() {
      if (!businessId) {
        // Try to get from sessionStorage
        const storedBusinessId = sessionStorage.getItem("business_id");
        if (!storedBusinessId) {
          router.push("/");
          return;
        }
      }

      const supabase = getSupabaseClient();
      const id = businessId || sessionStorage.getItem("business_id");

      const query = (supabase as any).from("programs");
      const { data, error } = await query
        .select("id, name, extension, business_id, description")
        .eq("business_id", id!)
        .order("name");

      if (error) {
        console.error("Error loading programs:", error);
        setLoading(false);
        return;
      }

      setPrograms(data || []);
      setLoading(false);
    }

    loadPrograms();
  }, [businessId, router]);

  async function handleSelectProgram(program: Program) {
    setSelecting(true);
    setProgram(program);
    
    // Small delay to ensure state is set
    setTimeout(() => {
      router.push("/");
    }, 100);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: accentColor }} />
          <p className="text-white/60">Loading programs...</p>
        </div>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-md mx-auto p-8">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-white/40" />
          <h1 className="text-2xl font-bold text-white mb-2">No Programs Found</h1>
          <p className="text-white/60 mb-6">
            This business doesn't have any programs set up yet.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-lg border text-white hover:bg-white/10 transition-colors"
            style={{ borderColor: accentColor }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Select Program
          </h1>
          <p className="text-white/60">
            Choose which program you want to view
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((program, index) => (
            <motion.button
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleSelectProgram(program)}
              disabled={selecting}
              className="p-6 rounded-xl glass-strong border border-white/10 hover:border-white/20 transition-all text-left group relative overflow-hidden"
              style={{
                borderColor: selecting ? "transparent" : undefined,
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: `${accentColor}33`,
                    borderColor: `${accentColor}4D`,
                  }}
                >
                  <Building2 className="h-6 w-6" style={{ color: accentColor }} />
                </div>
                {selecting && (
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
                )}
                {!selecting && (
                  <ArrowRight className="h-5 w-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{program.name}</h3>
              
              {program.extension && (
                <p className="text-sm text-white/60 mb-2">
                  Extension: {program.extension}
                </p>
              )}
              
              {program.description && (
                <p className="text-sm text-white/80 line-clamp-2">
                  {program.description}
                </p>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

