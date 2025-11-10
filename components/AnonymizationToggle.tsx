"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

type Props = {
  onToggle?: (isAnonymized: boolean) => void;
};

export function AnonymizationToggle({ onToggle }: Props) {
  const { accentColor } = useAccentColor();
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from sessionStorage only after mount (prevents hydration mismatch)
    const saved = sessionStorage.getItem("anonymization_enabled");
    if (saved === "true") {
      setIsAnonymized(true);
      onToggle?.(true);
    }
  }, [onToggle]);

  const handleToggle = () => {
    const newValue = !isAnonymized;
    setIsAnonymized(newValue);
    sessionStorage.setItem("anonymization_enabled", newValue.toString());
    onToggle?.(newValue);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-white/20 opacity-50">
        <Eye className="h-4 w-4" />
        <span>Full Data</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border"
      style={{
        backgroundColor: isAnonymized ? `${accentColor}33` : "transparent",
        borderColor: isAnonymized ? `${accentColor}4D` : "rgba(255, 255, 255, 0.2)",
        color: isAnonymized ? accentColor : "rgba(255, 255, 255, 0.7)",
      }}
      title={isAnonymized ? "Show anonymized data" : "Show full data"}
    >
      {isAnonymized ? (
        <>
          <EyeOff className="h-4 w-4" />
          <span>Anonymized</span>
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          <span>Full Data</span>
        </>
      )}
    </button>
  );
}

/**
 * Utility function to anonymize data for display based on session toggle
 */
export function applyAnonymization(data: any, isAnonymized: boolean): any {
  if (!isAnonymized || !data) return data;

  const anonymized = { ...data };

  // Anonymize phone numbers
  if (anonymized.phone && !anonymized.phone.startsWith("PH-")) {
    const phone = anonymized.phone.toString().replace(/\D/g, '');
    anonymized.phone = phone.length >= 4 ? `***-***-${phone.slice(-4)}` : '***-***-****';
  }

  // Anonymize email
  if (anonymized.email && !anonymized.email.startsWith("EM-")) {
    const [local, domain] = anonymized.email.split('@');
    anonymized.email = domain ? `***@${domain}` : '***@***.com';
  }

  // Anonymize name
  if (anonymized.patient_name && !anonymized.patient_name.startsWith("NM-")) {
    const name = anonymized.patient_name.trim();
    anonymized.patient_name = name.length > 0 ? `${name[0]}***` : '***';
  }

  // Anonymize transcript (basic - just remove names/phones/emails)
  if (anonymized.transcript) {
    let transcript = anonymized.transcript;
    transcript = transcript.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');
    transcript = transcript.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.com');
    // Simple name anonymization - replace capitalized words that might be names
    transcript = transcript.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, (match: string) => {
      const commonWords = ['User', 'AI', 'Assistant', 'Hello', 'Hi', 'Yes', 'No', 'Okay', 'Thanks'];
      if (commonWords.includes(match)) return match;
      const words = match.split(' ');
      return words.map(w => w[0] + '***').join(' ');
    });
    anonymized.transcript = transcript;
  }

  // Anonymize summary
  if (anonymized.last_summary) {
    let summary = anonymized.last_summary;
    summary = summary.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');
    summary = summary.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.com');
    anonymized.last_summary = summary;
  }

  return anonymized;
}

