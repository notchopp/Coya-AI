"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AccentColorContextType {
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const AccentColorContext = createContext<AccentColorContextType | undefined>(undefined);

export function AccentColorProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState("#eab308"); // Default gold/yellow

  useEffect(() => {
    // Load saved color from localStorage
    const saved = localStorage.getItem("accentColor");
    if (saved) {
      setAccentColorState(saved);
    }
  }, []);

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    localStorage.setItem("accentColor", color);
    
    // Update CSS custom property
    document.documentElement.style.setProperty("--accent-color", color);
  };

  // Set initial CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accentColor);
  }, [accentColor]);

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






