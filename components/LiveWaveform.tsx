"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  isActive: boolean;
  amplitude?: number; // 0-1
};

export default function LiveWaveform({ isActive, amplitude = 0.5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive) {
      setBars(Array(20).fill(0));
      return;
    }

    // Initialize bars with random heights
    const initialBars = Array(20).fill(0).map(() => Math.random() * 0.3);
    setBars(initialBars);

    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map((bar) => {
          // Simulate waveform with some randomness
          const change = (Math.random() - 0.5) * 0.2;
          const newValue = Math.max(0.1, Math.min(1, bar + change));
          return newValue * amplitude;
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, amplitude]);

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="w-1 bg-yellow-400 rounded-full"
          animate={{
            height: `${height * 100}%`,
            opacity: isActive ? 0.6 + height * 0.4 : 0.2,
          }}
          transition={{
            duration: 0.15,
            ease: "easeOut",
          }}
          style={{ minHeight: "4px" }}
        />
      ))}
    </div>
  );
}

