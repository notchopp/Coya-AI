"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AccentColorContextType {
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const AccentColorContext = createContext<AccentColorContextType | undefined>(undefined);

export function AccentColorProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("accentColor");
      return saved || "#eab308";
    }
    return "#eab308"; // Default gold/yellow
  });

  useEffect(() => {
    // Update CSS variable when accentColor changes
    document.documentElement.style.setProperty("--accent-color", accentColor);
  }, [accentColor]);

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    localStorage.setItem("accentColor", color);
  };

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  const context = useContext(AccentColorContext);
  if (context === undefined) {
    throw new Error("useAccentColor must be used within AccentColorProvider");
  }
  return context;
}













