"use client"

import { motion } from "framer-motion"

interface GestureToggleButtonProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export default function GestureToggleButton({ enabled, onToggle }: GestureToggleButtonProps) {
  return (
    <motion.button
      onClick={() => onToggle(!enabled)}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`fixed bottom-6 right-6 w-16 h-16 rounded-full font-bold text-2xl shadow-xl flex items-center justify-center z-50 transition-colors ${
        enabled 
          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 animate-pulse" 
          : "bg-gray-600"
      }`}
      aria-label={enabled ? "Disable gesture controls" : "Enable gesture controls"}
    >
      <div className={enabled ? "pulse-soft" : ""}>
        {enabled ? "✋" : "🚫"}
      </div>
    </motion.button>
  )
}
