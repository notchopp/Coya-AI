"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";
import { useAccentColor } from "@/components/AccentColorProvider";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps?: number;
}

const steps = [
  { number: 1, label: "Account", route: "/onboarding/business-setup" },
  { number: 2, label: "Business", route: "/onboarding/business-setup" },
  { number: 3, label: "Mode", route: "/onboarding/mode-selection" },
  { number: 4, label: "Setup", route: "/onboarding/business-config" },
  { number: 5, label: "Test", route: "/onboarding/test-call" },
  { number: 6, label: "Tutorial", route: "/onboarding/tutorial" },
  { number: 7, label: "Go Live", route: "/onboarding/go-live" },
];

export default function OnboardingProgress({ 
  currentStep, 
  totalSteps = 7 
}: OnboardingProgressProps) {
  const { accentColor } = useAccentColor();

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.number <= currentStep;
          const isCurrent = step.number === currentStep;
          
          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {isCompleted ? (
                      <CheckCircle2
                        className="h-8 w-8"
                        style={{ color: accentColor }}
                      />
                    ) : (
                      <Circle
                        className={`h-8 w-8 ${
                          isCurrent ? "text-white" : "text-white/30"
                        }`}
                      />
                    )}
                  </motion.div>
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundColor: `${accentColor}33`,
                        boxShadow: `0 0 12px ${accentColor}66`,
                      }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCompleted || isCurrent
                      ? "text-white"
                      : "text-white/40"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    step.number < currentStep
                      ? "bg-white/20"
                      : "bg-white/10"
                  }`}
                  style={
                    step.number < currentStep
                      ? { backgroundColor: `${accentColor}66` }
                      : {}
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}




