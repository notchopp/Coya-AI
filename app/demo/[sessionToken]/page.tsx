"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Phone, ArrowRight, Loader2 } from "lucide-react";

export default function DemoLanding() {
  const params = useParams();
  const router = useRouter();
  const sessionToken = params?.sessionToken as string;
  
  const [session, setSession] = useState<any>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;

    async function loadSession() {
      try {
        const response = await fetch(`/api/demo/${sessionToken}`);
        const data = await response.json();
        
        if (!response.ok) {
          if (data.message?.includes("migration")) {
            setError("Demo system not initialized. Please run the database migration.");
          } else {
            setError(data.error || data.message || "Failed to load demo session");
          }
          setLoading(false);
          return;
        }
        
        if (data.error || data.session?.isExpired) {
          router.push("/demo/expired");
          return;
        }

        setSession(data.session);
        setRemainingSeconds(data.session.remainingSeconds);
        setLoading(false);
        setError(null);
      } catch (error) {
        console.error("Error loading session:", error);
        setError("Failed to connect to server. Please check your connection.");
        setLoading(false);
      }
    }

    loadSession();
    const interval = setInterval(loadSession, 1000); // Update every second
    return () => clearInterval(interval);
  }, [sessionToken, router]);

  // Countdown timer and cleanup on expiration
  useEffect(() => {
    if (remainingSeconds <= 0) {
      // Trigger cleanup when session expires
      async function cleanupDemo() {
        try {
          await fetch(`/api/demo/${sessionToken}/cleanup`, {
            method: "POST",
          });
        } catch (error) {
          console.error("Error cleaning up demo:", error);
        }
      }
      cleanupDemo();
      router.push("/demo/expired");
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Trigger cleanup when session expires
          async function cleanupDemo() {
            try {
              await fetch(`/api/demo/${sessionToken}/cleanup`, {
                method: "POST",
              });
            } catch (error) {
              console.error("Error cleaning up demo:", error);
            }
          }
          cleanupDemo();
          router.push("/demo/expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, router, sessionToken]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    router.push(`/demo/${sessionToken}/configure`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <h1 className="text-2xl font-bold mb-4 text-red-400">Error</h1>
          <p className="text-white/60 mb-4">{error}</p>
          {error.includes("migration") && (
            <div className="mt-4 p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-left">
              <p className="text-sm text-white/80 mb-2">To fix this:</p>
              <ol className="text-sm text-white/60 list-decimal list-inside space-y-1">
                <li>Open your Supabase dashboard</li>
                <li>Go to SQL Editor</li>
                <li>Run the migration file: <code className="text-yellow-400">supabase/migrations/add_demo_system.sql</code></li>
              </ol>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            initial={{ opacity: 0, y: Math.random() * 200 - 100, x: Math.random() * 200 - 100 }}
            animate={{
              opacity: [0, 0.6, 0],
              y: [Math.random() * 200 - 100, Math.random() * 200 - 100 + 300],
              x: [Math.random() * 200 - 100, Math.random() * 200 - 100 + 100],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 8,
              height: 4 + Math.random() * 8,
              background: `linear-gradient(to bottom right, #eab308, #fde047)`,
              boxShadow: `0 0 10px #eab308`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center max-w-2xl"
      >
        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/20 border border-red-500/30">
            <Clock className="h-5 w-5 text-red-400" />
            <span className="text-2xl font-bold">{formatTime(remainingSeconds)}</span>
          </div>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-7xl font-bold mb-4"
          style={{
            background: `linear-gradient(to right, #eab308, #fde047, #eab308)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          COYA AI
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl md:text-3xl font-semibold mb-8"
          style={{
            background: `linear-gradient(to right, #eab308, #fde047, #eab308)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          EXPERIENCE IT LIVE
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/60 text-lg mb-6"
        >
          Configure your business and experience your AI receptionist in real-time
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-12 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-black/50 border border-yellow-500/30"
        >
          <Phone className="h-6 w-6 text-yellow-500" />
          <div className="text-left">
            <p className="text-sm text-white/60">Demo Number</p>
            <p className="text-xl font-bold">+1 (215) 986 2752</p>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleStart}
          className="px-8 py-4 rounded-xl bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-500/40 text-white font-semibold hover:from-yellow-500/40 hover:to-yellow-600/40 transition-all flex items-center gap-3 mx-auto text-lg"
        >
          Get Started
          <ArrowRight className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </div>
  );
}
