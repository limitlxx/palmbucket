"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SplitRatioSettings, AutoSplitToggle, SweepAuthorizationToggle, SweepKeeperAdminControls } from '@/components/settings'

export default function SettingsPage() {
  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` || '0x'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your payment splitting, auto-sweep, and bucket preferences
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Auto-Split Toggle Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-6"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Auto-Split Settings</h2>
              <p className="text-muted-foreground">
                Enable or disable automatic payment splitting for your tokens
              </p>
            </div>
            <AutoSplitToggle 
              tokenAddress={USDC_ADDRESS}
              tokenSymbol="USDC"
              tokenDecimals={6}
            />
          </motion.div>

          {/* Split Ratio Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass"
          >
            <SplitRatioSettings />
          </motion.div>

          {/* Auto-Sweep Authorization Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass p-6"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Auto-Sweep Settings</h2>
              <p className="text-muted-foreground">
                Automatically optimize your funds by moving leftover balances to the highest-yielding bucket at month-end
              </p>
            </div>
            <SweepAuthorizationToggle tokenDecimals={6} />
          </motion.div>

          {/* Admin Controls Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass p-6"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">SweepKeeper Admin Controls</h2>
              <p className="text-muted-foreground">
                Administrative controls for the SweepKeeper contract (owner only)
              </p>
            </div>
            <SweepKeeperAdminControls tokenDecimals={6} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
