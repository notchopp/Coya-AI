"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import Coyalogo from "@/components/Coyalogo";
import { 
  Phone, 
  Calendar, 
  BarChart3, 
  Settings, 
  Users,
  ArrowRight,
  X,
  CheckCircle2,
  Sparkles
} from "lucide-react";

export default function WelcomeOnboarding() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkIfNewUser() {
      // First check if we have a flag to show welcome (from signup/login)
      const showWelcomeFlag = sessionStorage.getItem("show_welcome");
      
      const supabase = getSupabaseClient();
      const businessId = sessionStorage.getItem("business_id");
      
      // If we have the flag, show welcome immediately (don't wait for business check)
      if (showWelcomeFlag === "true") {
        setShowWelcome(true);
        setBusinessName(null);
        // Don't clear flag yet - wait until user dismisses
        return;
      }
      
      if (businessId) {
        const { data: businessData } = await supabase
          .from("businesses")
          .select("name")
          .eq("id", businessId)
          .maybeSingle();
        
        const business = businessData as { name: string | null } | null;
        
        // Show welcome if business name is empty or null (for both users and admins)
        if (!business || !business.name || business.name.trim() === "") {
          setShowWelcome(true);
          setBusinessName(null);
        } else {
          setBusinessName(business.name);
        }
      }
    }

    // Check immediately
    checkIfNewUser();
    
    // Check periodically in case business_id or flag is set after component mounts
    const interval = setInterval(checkIfNewUser, 300);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleGetStarted = () => {
    setShowWelcome(false);
    // Clear the flag
    sessionStorage.removeItem("show_welcome");
    // Redirect to settings to set business name
    router.push("/settings");
  };

  const handleSkipTutorial = () => {
    setShowWelcome(false);
    // Clear the flag
    sessionStorage.removeItem("show_welcome");
  };

  const tutorialSteps = [
    {
      title: "Monitor Live Calls",
      description: "Watch your AI receptionist handle calls in real-time. See patient names, intents, and booking status as calls happen.",
      icon: Phone,
      color: "from-blue-500/30 to-blue-600/30",
      borderColor: "border-blue-500/40"
    },
    {
      title: "Track Bookings",
      description: "View all appointments scheduled through your AI. See booking trends and conversion rates over time.",
      icon: Calendar,
      color: "from-emerald-500/30 to-emerald-600/30",
      borderColor: "border-emerald-500/40"
    },
    {
      title: "Analytics Dashboard",
      description: "Get insights into call patterns, busiest times, and performance metrics to optimize your operations.",
      icon: BarChart3,
      color: "from-purple-500/30 to-purple-600/30",
      borderColor: "border-purple-500/40"
    },
    {
      title: "Manage Settings",
      description: "Configure your business information, hours, and customize your AI receptionist's behavior.",
      icon: Settings,
      color: "from-yellow-500/30 to-yellow-600/30",
      borderColor: "border-yellow-500/40"
    },
    {
      title: "Team Management",
      description: "Invite team members, assign roles, and manage access to your dashboard.",
      icon: Users,
      color: "from-pink-500/30 to-pink-600/30",
      borderColor: "border-pink-500/40"
    }
  ];

  if (!showWelcome) return null;

  return (
    <AnimatePresence>
      {showWelcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-strong rounded-3xl p-8 sm:p-12 border border-white/10 shadow-2xl"
          >
            {/* Close Button */}
            <button
              onClick={handleSkipTutorial}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Skip tutorial"
            >
              <X className="h-5 w-5 text-white/60" />
            </button>

            {/* Welcome Section */}
            {currentStep === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6"
              >
                {/* Logo */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="flex justify-center mb-6"
                >
                  <Coyalogo src="/logo.gif" size={120} />
                </motion.div>

                {/* Brand Name */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-center gap-3 mb-2"
                >
                  <h1 className="text-5xl sm:text-6xl font-bold text-white">
                    COYA
                  </h1>
                  <span className="text-4xl sm:text-5xl font-semibold text-yellow-400/90">
                    AI
                  </span>
                  <span className="beta-badge self-start mt-2">Beta</span>
                </motion.div>

                {/* Description */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-4 max-w-2xl mx-auto"
                >
                  <p className="text-xl sm:text-2xl text-white/90 font-medium">
                    Welcome to Your AI Receptionist Dashboard
                  </p>
                  <p className="text-base sm:text-lg text-white/70 leading-relaxed">
                    COYA AI is an intelligent receptionist that handles your phone calls 24/7, 
                    books appointments, answers questions, and manages patient interactions — 
                    all powered by advanced AI.
                  </p>
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 mt-6">
                    <p className="text-sm text-yellow-400/90">
                      <strong>Beta Note:</strong> You're part of our beta program! We're gathering data 
                      to improve the AI and make it even better. This isn't unfinished software — 
                      it's a working product that gets smarter with every call.
                    </p>
                  </div>
                </motion.div>

                {/* Get Started Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-8"
                >
                  <motion.button
                    onClick={() => setCurrentStep(1)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="h-5 w-5" />
                    Take a Quick Tour
                  </motion.button>
                  <motion.button
                    onClick={handleGetStarted}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    Get Started
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </motion.div>
              </motion.div>
            )}

            {/* Tutorial Steps */}
            {currentStep > 0 && currentStep <= tutorialSteps.length && (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    {tutorialSteps.map((_, index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full transition-all ${
                          index + 1 <= currentStep
                            ? "bg-yellow-500 w-8"
                            : "bg-white/20 w-2"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-white/60">
                    {currentStep} / {tutorialSteps.length}
                  </span>
                </div>

                {(() => {
                  const step = tutorialSteps[currentStep - 1];
                  const Icon = step.icon;
                  return (
                    <div className="text-center space-y-6">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`p-6 rounded-2xl bg-gradient-to-r ${step.color} border ${step.borderColor} inline-block`}
                      >
                        <Icon className="h-12 w-12 mx-auto" style={{ color: "white" }} />
                      </motion.div>
                      <h2 className="text-3xl font-bold text-white">{step.title}</h2>
                      <p className="text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
                        {step.description}
                      </p>
                      <div className="flex gap-3 justify-center mt-8">
                        {currentStep > 1 && (
                          <motion.button
                            onClick={() => setCurrentStep(currentStep - 1)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
                          >
                            Back
                          </motion.button>
                        )}
                        {currentStep < tutorialSteps.length ? (
                          <motion.button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center gap-2"
                          >
                            Next
                            <ArrowRight className="h-5 w-5" />
                          </motion.button>
                        ) : (
                          <motion.button
                            onClick={handleGetStarted}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center gap-2"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                            Get Started
                          </motion.button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

