"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface Program {
  id: string;
  name: string;
  extension: string | null;
  business_id: string;
  description?: string | null;
}

interface ProgramContextType {
  program: Program | null;
  programId: string | null;
  businessId: string | null;
  hasPrograms: boolean;
  loading: boolean;
  setProgram: (program: Program | null) => void;
  setProgramId: (id: string | null) => void;
  refreshPrograms: () => Promise<void>;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const [program, setProgramState] = useState<Program | null>(null);
  const [programId, setProgramIdState] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hasPrograms, setHasPrograms] = useState(false);
  const [loading, setLoading] = useState(true);

  // Define functions first (using useCallback to prevent recreation)
  const loadProgram = useCallback(async (id: string) => {
    const supabase = getSupabaseClient();
    const query = (supabase as any).from("programs");
    const { data, error } = await query
      .select("id, name, extension, business_id, description")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error loading program:", error);
      setLoading(false);
      return;
    }

    if (data) {
      setProgramState(data as Program);
      setProgramIdState(id);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("program_id", id);
      }
    } else {
      // Program not found, clear it
      setProgramState(null);
      setProgramIdState(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("program_id");
      }
    }
    setLoading(false);
  }, []);

  const checkForPrograms = useCallback(async (businessId: string) => {
    const supabase = getSupabaseClient();
    const query = (supabase as any).from("programs");
    const { data, error } = await query
      .select("id")
      .eq("business_id", businessId)
      .limit(1);

    if (error) {
      console.error("Error checking for programs:", error);
      setHasPrograms(false);
      setLoading(false);
      return;
    }

    setHasPrograms((data?.length || 0) > 0);
    setLoading(false);
  }, []);

  // Load program from sessionStorage on mount
  useEffect(() => {
    // Only access sessionStorage in browser
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    const storedProgramId = sessionStorage.getItem("program_id");
    const storedBusinessId = sessionStorage.getItem("business_id");
    
    if (storedBusinessId) {
      setBusinessId(storedBusinessId);
    }
    
    if (storedProgramId) {
      setProgramIdState(storedProgramId);
      loadProgram(storedProgramId);
    } else {
      // Check if business has programs
      if (storedBusinessId) {
        checkForPrograms(storedBusinessId);
      } else {
        setLoading(false);
      }
    }
  }, [loadProgram, checkForPrograms]);

  const setProgram = useCallback((newProgram: Program | null) => {
    setProgramState(newProgram);
    if (typeof window !== "undefined") {
      if (newProgram) {
        setProgramIdState(newProgram.id);
        sessionStorage.setItem("program_id", newProgram.id);
      } else {
        setProgramIdState(null);
        sessionStorage.removeItem("program_id");
      }
    }
  }, []);

  const setProgramId = useCallback((id: string | null) => {
    setProgramIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        sessionStorage.setItem("program_id", id);
        loadProgram(id);
      } else {
        sessionStorage.removeItem("program_id");
        setProgramState(null);
      }
    }
  }, [loadProgram]);

  const refreshProgramsMemo = useCallback(async () => {
    if (typeof window !== "undefined") {
      const storedBusinessId = sessionStorage.getItem("business_id");
      if (storedBusinessId) {
        await checkForPrograms(storedBusinessId);
      }
    }
  }, [checkForPrograms]);

  const contextValue = useMemo(() => ({
    program,
    programId,
    businessId,
    hasPrograms,
    loading,
    setProgram,
    setProgramId,
    refreshPrograms: refreshProgramsMemo,
  }), [program, programId, businessId, hasPrograms, loading, setProgram, setProgramId, refreshProgramsMemo]);

  return (
    <ProgramContext.Provider value={contextValue}>
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (context === undefined) {
    // Return default values instead of throwing to prevent hooks violations
    return {
      program: null,
      programId: null,
      businessId: null,
      hasPrograms: false,
      loading: false,
      setProgram: () => {},
      setProgramId: () => {},
      refreshPrograms: async () => {},
    };
  }
  return context;
}
