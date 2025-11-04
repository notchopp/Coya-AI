"use client";

import { motion } from "framer-motion";
import { GitBranch, Lock } from "lucide-react";

export default function FlowchartPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md mx-auto p-8"
      >
        <div className="mb-6 flex justify-center">
          <div className="p-4 rounded-2xl glass border border-white/10 bg-white/5">
            <Lock className="h-12 w-12 text-white/40" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Flowchart</h1>
        <p className="text-white/60 text-lg mb-6">
          This feature is currently archived and will be revisited at a later date.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
          <GitBranch className="h-4 w-4" />
          <span>Coming Soon</span>
        </div>
      </motion.div>
    </div>
  );
}