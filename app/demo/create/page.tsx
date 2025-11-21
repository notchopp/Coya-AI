"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Clock } from "lucide-react";

export default function CreateDemo() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [waitTime, setWaitTime] = useState<{ minutes: number; seconds: number } | null>(null);

  // Countdown timer for wait time
  useEffect(() => {
    if (!waitTime) return;

    const interval = setInterval(() => {
      setWaitTime((prev) => {
        if (!prev) return null;
        if (prev.seconds <= 1) {
          if (prev.minutes <= 0) {
            return null; // Wait time expired, allow retry
          }
          return { minutes: prev.minutes - 1, seconds: 59 };
        }
        return { minutes: prev.minutes, seconds: prev.seconds - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [waitTime]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.nextAvailableIn !== undefined) {
          // Set wait time and start countdown
          const minutes = data.nextAvailableIn;
          const seconds = data.nextAvailableInSeconds || minutes * 60;
          setWaitTime({ minutes, seconds });
          setLoading(false);
          return;
        } else {
          alert("Error: " + (data.error || data.message || "Failed to create demo session"));
        }
        setLoading(false);
        return;
      }

      if (data.sessionToken) {
        // Use current origin to navigate (works in both dev and production)
        router.push(`/demo/${data.sessionToken}`);
      } else if (data.demoLink) {
        // Fallback: try to extract path from demoLink
        try {
          const url = new URL(data.demoLink);
          router.push(url.pathname);
        } catch {
          // If demoLink is already a path, use it directly
          router.push(data.demoLink.replace(window.location.origin, ""));
        }
      }
    } catch (error) {
      console.error("Error creating demo:", error);
      alert("Failed to create demo. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-3xl font-bold mb-2">Start Your Demo</h1>
          <p className="text-white/60">Experience Coya AI in a private 1-hour sandbox</p>
        </div>

        <div className="p-6 rounded-xl bg-black border border-white/10 space-y-4">
          {waitTime && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-red-500/20 border border-red-500/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-red-400" />
                <p className="text-sm text-red-400 font-medium">Demo Session In Progress</p>
              </div>
              <p className="text-2xl font-bold text-white mb-1">
                {waitTime.minutes > 0 
                  ? `${waitTime.minutes}:${waitTime.seconds.toString().padStart(2, "0")}`
                  : `${waitTime.seconds}s`
                }
              </p>
              <p className="text-xs text-white/60">
                Next available in {waitTime.minutes > 0 ? `${waitTime.minutes} minute${waitTime.minutes !== 1 ? 's' : ''} and ${waitTime.seconds} second${waitTime.seconds !== 1 ? 's' : ''}` : `${waitTime.seconds} second${waitTime.seconds !== 1 ? 's' : ''}`}
              </p>
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-black border border-white/10 text-white focus:outline-none focus:border-yellow-500/50"
              placeholder="your@email.com"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || (waitTime !== null && (waitTime.minutes > 0 || waitTime.seconds > 0))}
            className="w-full px-6 py-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating Demo...
              </>
            ) : waitTime && (waitTime.minutes > 0 || waitTime.seconds > 0) ? (
              <>
                <Clock className="h-5 w-5" />
                Wait {waitTime.minutes > 0 ? `${waitTime.minutes}:${waitTime.seconds.toString().padStart(2, "0")}` : `${waitTime.seconds}s`}
              </>
            ) : (
              "Start 1-Hour Demo"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

