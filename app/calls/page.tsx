"use client";

import { motion } from "framer-motion";
import RealtimeCalls from "@/components/RealtimeCalls";
import LiveWaveform from "@/components/LiveWaveform";
import { PhoneIncoming } from "lucide-react";

export default function CallsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-white">Live Calls</h1>
            <span className="beta-badge">Beta</span>
          </div>
        </div>
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 backdrop-blur-xl"
        >
          <LiveWaveform isActive={true} amplitude={0.7} />
          <span className="text-sm font-medium text-yellow-400">Live</span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <RealtimeCalls />
      </motion.div>
    </div>
  );
}

