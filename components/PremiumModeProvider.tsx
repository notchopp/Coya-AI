"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type PremiumModeContextType = {
  isPremium: boolean;
  isLocalhost: boolean;
  togglePremium: () => void;
};

const PremiumModeContext = createContext<PremiumModeContextType | undefined>(undefined);

export function PremiumModeProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    // Check if running on localhost
    const isLocal = 
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1" ||
       window.location.hostname.includes("localhost"));

    setIsLocalhost(isLocal);

    // Load premium mode preference from localStorage
    const saved = localStorage.getItem("premiumMode");
    if (saved === "true") {
      setIsPremium(true);
    }

    // Listen for storage changes (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "premiumMode") {
        setIsPremium(e.newValue === "true");
      }
    };

    // Listen for custom events (same-tab sync)
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.isPremium !== undefined) {
        setIsPremium(customEvent.detail.isPremium);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("premiumModeChange", handleCustomChange);
      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("premiumModeChange", handleCustomChange);
      };
    }
  }, []);

  const togglePremium = () => {
    const newValue = !isPremium;
    setIsPremium(newValue);
    localStorage.setItem("premiumMode", String(newValue));
    // Dispatch custom event for same-tab sync
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("premiumModeChange", {
        detail: { isPremium: newValue }
      }));
    }
  };

  return (
    <PremiumModeContext.Provider value={{ isPremium, isLocalhost, togglePremium }}>
      {children}
    </PremiumModeContext.Provider>
  );
}

export function usePremiumMode() {
  const context = useContext(PremiumModeContext);
  if (context === undefined) {
    // Fallback to hook implementation if context not available
    const [isPremium, setIsPremium] = useState(false);
    const [isLocalhost, setIsLocalhost] = useState(false);

    useEffect(() => {
      const isLocal = 
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
         window.location.hostname === "127.0.0.1" ||
         window.location.hostname.includes("localhost"));

      setIsLocalhost(isLocal);

      const saved = localStorage.getItem("premiumMode");
      if (saved === "true") {
        setIsPremium(true);
      }
    }, []);

    const togglePremium = () => {
      const newValue = !isPremium;
      setIsPremium(newValue);
      localStorage.setItem("premiumMode", String(newValue));
    };

    return { isPremium, isLocalhost, togglePremium };
  }
  return context;
}

