"use client"

import { motion } from "framer-motion"
import { useBucketVault } from "@/lib/hooks/useBucketVault"
import { useYieldRateTracking } from "@/lib/hooks/useYieldRateTracking"
import { Skeleton } from "@/components/ui/skeleton"
import { formatUnits } from "viem"
import type { BucketType } from "@/types"

interface BucketCardProps {
  bucketType: BucketType
  onClick: () => void
}

const BUCKET_CONFIG = {
  bills: {
    name: "Bills",
    icon: "💰",
    color: "blue",
    borderColor: "border-blue-500/40",
    bgColor: "bg-blue-500/10",
  },
  savings: {
    name: "Savings",
    icon: "🏦",
    color: "emerald",
    borderColor: "border-emerald-500/40",
    bgColor: "bg-emerald-500/10",
  },
  growth: {
    name: "Growth",
    icon: "📊",
    color: "purple",
    borderColor: "border-purple-500/40",
    bgColor: "bg-purple-500/10",
  },
  spendable: {
    name: "Spendable",
    icon: "💸",
    color: "amber",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/10",
  },
} as const

export default function BucketCard({ bucketType, onClick }: BucketCardProps) {
  const config = BUCKET_CONFIG[bucketType]
  const { balance, isLoading: balanceLoading } = useBucketVault(bucketType)
  const { rates, isLoading: ratesLoading } = useYieldRateTracking()

  const isLoading = balanceLoading || ratesLoading

  const balanceFormatted = balance 
    ? Number(formatUnits(balance, 6)).toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })
    : "0"

  const apy = rates?.[bucketType] || 0

  if (isLoading) {
    return (
      <div className="glass border-2 border-white/10 p-5 flex flex-col h-full">
        <Skeleton className="w-8 h-8 mb-2" />
        <Skeleton className="h-4 w-20 mb-3" />
        <Skeleton className="h-8 w-24 mb-auto" />
        <Skeleton className="h-6 w-16" />
      </div>
    )
  }

  return (
    <motion.div 
      whileHover={{ y: -8 }} 
      whileTap={{ scale: 0.95 }} 
      onClick={onClick} 
      className="cursor-pointer"
    >
      <div className={`glass border-2 ${config.borderColor} p-5 flex flex-col h-full overflow-hidden group`}>
        <div className="text-3xl mb-2">{config.icon}</div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">{config.name}</h3>
        <p className="text-2xl md:text-3xl font-bold text-foreground mb-auto">
          ${balanceFormatted}
        </p>
        {apy > 0 && (
          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${config.bgColor} text-white w-fit`}>
            {apy.toFixed(1)}% APY
          </span>
        )}
      </div>
    </motion.div>
  )
}
