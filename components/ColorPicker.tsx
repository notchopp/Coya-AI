"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccentColor } from "@/components/AccentColorProvider";
import { Palette } from "lucide-react";

const presetColors = [
  "#eab308", // Gold (default)
  "#3b82f6", // Blue
  "#10b981", // Green
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export function ColorPicker() {
  const { accentColor, setAccentColor } = useAccentColor();
  const [customColor, setCustomColor] = useState(accentColor);
  const [previewColor, setPreviewColor] = useState(accentColor); // Separate preview color
  const [showPicker, setShowPicker] = useState(false);

  const handleColorChange = (color: string) => {
    setCustomColor(color);
    setPreviewColor(color); // Update preview immediately
    setAccentColor(color); // Also update the actual color immediately
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="h-5 w-5" style={{ color: accentColor }} />
        <h3 className="text-lg font-semibold text-white">Accent Color</h3>
      </div>

      {/* Preset Colors */}
      <div>
        <label className="text-sm text-white/60 mb-2 block">Preset Colors</label>
        <div className="grid grid-cols-5 gap-3">
          {presetColors.map((color) => (
            <motion.button
              key={color}
              onClick={() => handleColorChange(color)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`w-12 h-12 rounded-lg border-2 transition-all ${
                previewColor === color ? "ring-2 ring-offset-2 ring-offset-black" : ""
              }`}
              style={{
                backgroundColor: color,
                borderColor: previewColor === color ? previewColor : "rgba(255, 255, 255, 0.2)",
              }}
            >
              {previewColor === color && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  <div className="w-3 h-3 rounded-full bg-white" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div>
        <label className="text-sm text-white/60 mb-2 block">Custom Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={customColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-16 h-16 rounded-lg border-2 border-white/20 cursor-pointer"
            style={{ borderColor: previewColor }}
          />
          <div className="flex-1">
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                  handleColorChange(e.target.value);
                } else {
                  setCustomColor(e.target.value);
                }
              }}
              placeholder="#eab308"
              className="w-full px-3 py-2 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2"
              style={{ 
                borderColor: `${previewColor}66`,
              }}
            />
            <p className="text-xs text-white/40 mt-1">Enter hex color code</p>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-4">
        <p className="text-xs text-white/60 mb-2">Preview</p>
        <div className="flex items-center gap-3">
          <div 
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ 
              backgroundColor: `${previewColor}20`,
              color: previewColor,
            }}
          >
            COYA AI
          </div>
          <div 
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ 
              backgroundColor: `${previewColor}15`,
              color: previewColor,
            }}
          >
            Active Tab
          </div>
          <div 
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: previewColor }}
          />
        </div>
      </div>
    </div>
  );
}

