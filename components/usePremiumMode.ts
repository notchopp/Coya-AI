"use client";

import { useState, useEffect } from "react";

/**
 * Premium Mode Hook - AI Insights Mode (available everywhere)
 * Toggle premium animations and effects
 */
export function usePremiumMode() {
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

    // Load premium mode preference from localStorage (available everywhere now)
    const saved = localStorage.getItem("premiumMode");
    if (saved === "true") {
      setIsPremium(true);
    }
  }, []);

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

