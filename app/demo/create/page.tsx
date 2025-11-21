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
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueToken, setQueueToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Sync timer with active session
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diffMs = expiry.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setWaitTime(null);
        setQueuePosition(null);
        setExpiresAt(null);
        return;
      }

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      setWaitTime({ minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Poll for queue updates and timer sync
  useEffect(() => {
    if (!queueToken) return;

    const pollQueue = async () => {
      try {
        const response = await fetch(`/api/demo/${queueToken}`);
        const data = await response.json();
        
        if (data.session) {
          if (data.session.queuePosition) {
            setQueuePosition(data.session.queuePosition);
          }
          if (data.session.activeSessionExpiresAt) {
            setExpiresAt(data.session.activeSessionExpiresAt);
          } else if (data.session.expires_at) {
            setExpiresAt(data.session.expires_at);
          }
          
          // If session is now active, redirect
          if (data.session.is_active && !data.session.isExpired) {
            router.push(`/demo/${queueToken}`);
          }
        }
      } catch (error) {
        console.error("Error polling queue:", error);
      }
    };

    pollQueue();
    const interval = setInterval(pollQueue, 2000);
    return () => clearInterval(interval);
  }, [queueToken, router]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, queueToken: queueToken || undefined }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.inQueue && data.queueToken) {
          // User is in queue
          setQueueToken(data.queueToken);
          setQueuePosition(data.queuePosition || 1);
          if (data.expiresAt) {
            setExpiresAt(data.expiresAt);
          } else {
            const minutes = data.nextAvailableIn || 0;
            const seconds = data.nextAvailableInSeconds || minutes * 60;
            setWaitTime({ minutes, seconds });
          }
          setLoading(false);
          return;
        } else if (data.nextAvailableIn !== undefined) {
          // Set wait time
          const minutes = data.nextAvailableIn;
          const seconds = data.nextAvailableInSeconds || minutes * 60;
          setWaitTime({ minutes, seconds });
          if (data.expiresAt) {
            setExpiresAt(data.expiresAt);
          }
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
                <p className="text-sm text-red-400 font-medium">
                  {queuePosition ? `You are #${queuePosition} in line` : "Demo Session In Progress"}
                </p>
              </div>
              <p className="text-2xl font-bold text-white mb-1">
                {waitTime.minutes > 0 
                  ? `${waitTime.minutes}:${waitTime.seconds.toString().padStart(2, "0")}`
                  : `${waitTime.seconds}s`
                }
              </p>
              <p className="text-xs text-white/60">
                {queuePosition 
                  ? `Your spot is reserved. Next available in ${waitTime.minutes > 0 ? `${waitTime.minutes} minute${waitTime.minutes !== 1 ? 's' : ''} and ${waitTime.seconds} second${waitTime.seconds !== 1 ? 's' : ''}` : `${waitTime.seconds} second${waitTime.seconds !== 1 ? 's' : ''}`}`
                  : `Next available in ${waitTime.minutes > 0 ? `${waitTime.minutes} minute${waitTime.minutes !== 1 ? 's' : ''} and ${waitTime.seconds} second${waitTime.seconds !== 1 ? 's' : ''}` : `${waitTime.seconds} second${waitTime.seconds !== 1 ? 's' : ''}`}`
                }
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
            onClick={() => {
              if (queueToken) {
                // Try to activate from queue
                handleCreate();
              } else {
                handleCreate();
              }
            }}
            disabled={loading || (waitTime !== null && (waitTime.minutes > 0 || waitTime.seconds > 0) && !queueToken)}
            className="w-full px-6 py-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {queueToken ? "Checking queue..." : "Creating Demo..."}
              </>
            ) : queueToken && waitTime && (waitTime.minutes > 0 || waitTime.seconds > 0) ? (
              <>
                <Clock className="h-5 w-5" />
                Waiting in queue...
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

