"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { useProgram } from "@/components/ProgramProvider";
import { ChevronDown, Building2, Check } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

type Program = {
  id: string;
  name: string;
  extension: string | null;
  business_id: string;
};

export default function ProgramSelector() {
  const { program, programId, setProgramId, businessId } = useProgram();
  const { accentColor } = useAccentColor();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPrograms() {
      if (!businessId) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const query = (supabase as any).from("programs");
      const { data, error } = await query
        .select("id, name, extension, business_id")
        .eq("business_id", businessId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading programs:", error);
        setLoading(false);
        return;
      }

      setPrograms(data || []);
      setLoading(false);
    }

    loadPrograms();
  }, [businessId]);

  // Don't show if no programs or only one program
  if (loading || programs.length <= 1) {
    return null;
  }

  const handleSelectProgram = (programIdToSelect: string | null) => {
    setProgramId(programIdToSelect);
    setIsOpen(false);
    // Refresh data without full page reload
    router.refresh();
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 hover:bg-white/10 transition-all"
        style={{ borderColor: `${accentColor}33` }}
      >
        <Building2 className="h-4 w-4" style={{ color: accentColor }} />
        <span className="text-sm font-medium text-white">
          {program?.name || "All Programs"}
        </span>
        <ChevronDown 
          className={`h-4 w-4 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 z-50 min-w-[200px] glass-strong rounded-xl border border-white/10 shadow-2xl overflow-hidden"
              style={{ borderColor: `${accentColor}33` }}
            >
              <div className="p-2">
                <button
                  onClick={() => handleSelectProgram(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    !programId
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <span className="text-white">All Programs</span>
                  {!programId && (
                    <Check className="h-4 w-4" style={{ color: accentColor }} />
                  )}
                </button>
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProgram(p.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      programId === p.id
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-white">{p.name}</span>
                    {programId === p.id && (
                      <Check className="h-4 w-4" style={{ color: accentColor }} />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

