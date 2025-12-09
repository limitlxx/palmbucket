"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export default function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 glass border-b border-white/10"
    >
      <div className="px-4 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            🌴
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-foreground">PalmBudget</h1>
            <p className="text-xs text-muted-foreground">DeFi Banking</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Settings"
          >
            ⚙️
          </Link>
          <ConnectButton 
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>
    </motion.header>
  )
}
