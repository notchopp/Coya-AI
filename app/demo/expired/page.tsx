"use client";

import { motion } from "framer-motion";
import { Calendar, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function DemoExpired() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <h1 className="text-4xl font-bold mb-4">Demo Ended</h1>
        <p className="text-white/60 mb-8">
          Your 1-hour demo session has expired. Ready to activate your AI receptionist?
        </p>
        
        <div className="space-y-4">
          <Link
            href="/signup?founder=true"
            className="block w-full px-6 py-4 rounded-lg bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <Calendar className="h-5 w-5" />
            Book Your Founder Slot
          </Link>
          
          <Link
            href="mailto:founders@coya.ai"
            className="block w-full px-6 py-4 rounded-lg bg-black border border-white/10 hover:border-white/20 transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-5 w-5" />
            Talk to the Coya Team
          </Link>
        </div>
      </motion.div>
    </div>
  );
}


