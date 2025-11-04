"use client";

import { motion } from "framer-motion";
import Image from "next/image";

type CoyalogoProps = {
  size?: number;
  className?: string;
  src?: string; // Path to custom PNG/GIF/MP4 image/video
  alt?: string;
};

export default function Coyalogo({ size = 24, className = "", src, alt = "COYA AI Logo" }: CoyalogoProps) {
  // If custom image/video provided, use it instead of SVG
  if (src) {
    const isVideo = src.endsWith('.mp4') || src.endsWith('.webm') || src.endsWith('.mov') || src.includes('video');
    
    if (isVideo) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={className}
          style={{ width: size, height: size, position: "relative", overflow: "hidden", background: "transparent" }}
        >
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
            style={{ width: size, height: size, background: "transparent" }}
          />
        </motion.div>
      );
    }
    
    // For images (PNG, GIF, etc.)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={className}
        style={{ width: size, height: size, position: "relative" }}
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-contain"
          unoptimized={src.endsWith('.gif')} // Allow GIF animations
        />
      </motion.div>
    );
  }

  // Fallback to SVG logo if no image provided
  // Create many dense parallel ribbon layers for the 3D C shape
  const ribbonLayers = 40;
  
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <defs>
        {/* Yellow gradient - golden to bright yellow */}
        <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ca8a04" stopOpacity="1" />
          <stop offset="25%" stopColor="#eab308" stopOpacity="1" />
          <stop offset="60%" stopColor="#fde047" stopOpacity="1" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0.95" />
        </linearGradient>
        
        {/* Radial gradient for speckles */}
        <radialGradient id="speckleGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      {/* Black background with animated yellow speckles */}
      <rect width="100" height="100" fill="black" />
      
      {/* Background speckles/stars */}
      {Array.from({ length: 25 }).map((_, i) => {
        const x = (i * 17 + 13) % 90 + 5;
        const y = (i * 23 + 19) % 90 + 5;
        const size = 0.8 + (i % 3) * 0.3;
        
        return (
          <motion.circle
            key={`speckle-${i}`}
            cx={x}
            cy={y}
            r={size}
            fill="url(#speckleGradient)"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.4, 0.2, 0.4],
              scale: [0.8, 1.2, 1, 1.1],
            }}
            transition={{
              duration: 4 + (i % 3),
              delay: i * 0.15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}

      {/* Multiple dense parallel ribbon layers creating a 3D C shape */}
      {Array.from({ length: ribbonLayers }).map((_, i) => {
        const progress = i / (ribbonLayers - 1);
        const depth = progress;
        
        // C shape parameters - more vertical, slightly tilted
        // Top tip: sharp and pointed
        const topTipX = 48 - depth * 7;
        const topTipY = 12 + depth * 1.5;
        
        // Bottom tip: sharp and pointed
        const bottomTipX = 48 - depth * 7;
        const bottomTipY = 88 - depth * 1.5;
        
        // Left curve (deepest part)
        const leftCurveX = 18 - depth * 2.5;
        const leftCurveY = 50;
        
        // Control points for smooth C curve with sharp tips
        const control1X = 32 - depth * 4;
        const control1Y = 18 + depth * 2;
        const control2X = 18 - depth * 2.5;
        const control2Y = 50;
        const control3X = 32 - depth * 4;
        const control3Y = 82 - depth * 2;

        // Opacity decreases with depth for 3D effect
        const opacity = 0.98 - depth * 0.5;
        
        return (
          <motion.path
            key={i}
            d={`M ${topTipX} ${topTipY} 
                Q ${control1X} ${control1Y} ${control2X} ${control2Y}
                Q ${control3X} ${control3Y} ${bottomTipX} ${bottomTipY}`}
            fill="none"
            stroke="url(#yellowGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={opacity}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: opacity,
            }}
            transition={{
              pathLength: { duration: 2, delay: i * 0.03, ease: "easeInOut" },
              opacity: { duration: 0.7, delay: i * 0.03 },
            }}
          />
        );
      })}

      {/* Additional highlight ribbons for inner glow */}
      {Array.from({ length: 8 }).map((_, i) => {
        const progress = i / 7;
        const depth = progress * 0.25;
        
        const topTipX = 46 - depth * 5;
        const topTipY = 14 + depth * 1;
        const bottomTipX = 46 - depth * 5;
        const bottomTipY = 86 - depth * 1;
        
        const control1X = 30 - depth * 3;
        const control1Y = 16 + depth * 1.5;
        const control2X = 20 - depth * 2;
        const control2Y = 50;
        const control3X = 30 - depth * 3;
        const control3Y = 84 - depth * 1.5;

        const opacity = 0.6 - depth * 0.4;
        
        return (
          <motion.path
            key={`highlight-${i}`}
            d={`M ${topTipX} ${topTipY} 
                Q ${control1X} ${control1Y} ${control2X} ${control2Y}
                Q ${control3X} ${control3Y} ${bottomTipX} ${bottomTipY}`}
            fill="none"
            stroke="#fde047"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={opacity}
            initial={{ pathLength: 0 }}
            animate={{
              pathLength: 1,
            }}
            transition={{
              duration: 1.5,
              delay: 1.2 + i * 0.05,
              ease: "easeInOut",
            }}
          />
        );
      })}

      {/* Subtle continuous wave animation on ribbons */}
      {Array.from({ length: ribbonLayers }).map((_, i) => {
        const progress = i / (ribbonLayers - 1);
        const depth = progress;
        
        const topTipX = 48 - depth * 7;
        const topTipY = 12 + depth * 1.5;
        const bottomTipX = 48 - depth * 7;
        const bottomTipY = 88 - depth * 1.5;
        
        const control1X = 32 - depth * 4;
        const control1Y = 18 + depth * 2;
        const control2X = 18 - depth * 2.5;
        const control2Y = 50;
        const control3X = 32 - depth * 4;
        const control3Y = 82 - depth * 2;

        const opacity = 0.15 - depth * 0.1;
        
        return (
          <motion.path
            key={`wave-${i}`}
            d={`M ${topTipX} ${topTipY} 
                Q ${control1X} ${control1Y} ${control2X} ${control2Y}
                Q ${control3X} ${control3Y} ${bottomTipX} ${bottomTipY}`}
            fill="none"
            stroke="#fde047"
            strokeWidth="0.8"
            opacity={opacity}
            initial={{ pathLength: 0 }}
            animate={{
              pathLength: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              delay: 2 + i * 0.02,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </motion.svg>
  );
}

