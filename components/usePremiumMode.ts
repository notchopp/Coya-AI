"use client";

import { useState, useEffect } from "react";

/**
 * Premium Mode Hook - AI Insights Mode (available everywhere)
 * Toggle premium animations and effects
 */
export function usePremiumMode() {
  const [isPremium, setIsPremium] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("premiumMode");
    return saved === "true";
  });
  const [isLocalhost] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("localhost")
    );
  });

  const togglePremium = () => {
    // Allow toggling everywhere, not just localhost
    const newValue = !isPremium;
    setIsPremium(newValue);
    localStorage.setItem("premiumMode", String(newValue));
  };

  return {
    isPremium, // No longer restricted to localhost
    isLocalhost,
    togglePremium,
  };
}

