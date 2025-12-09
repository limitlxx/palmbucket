"use client"

import { motion } from "framer-motion"
import { usePaymentMonitor } from "@/lib/hooks/usePaymentMonitor"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"

const TRANSACTION_ICONS = {
  split: "💸",
  yield: "📈",
  transfer: "🔄",
  deposit: "💰",
  withdraw: "💵",
} as const

export default function ActivityFeed() {
  const { transactions, isLoading } = usePaymentMonitor()

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Activity</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  const recentTransactions = transactions?.slice(0, 10) || []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">Activity</h3>

      {recentTransactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No activity yet</p>
          <p className="text-muted-foreground text-xs mt-1">
            Your transactions will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentTransactions.map((tx) => {
            const icon = TRANSACTION_ICONS[tx.type as keyof typeof TRANSACTION_ICONS] || "📝"
            const timeAgo = tx.timestamp 
              ? formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true })
              : "recently"

            return (
              <div 
                key={tx.id} 
                className="flex items-center justify-between p-3 rounded hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-medium text-foreground text-sm capitalize">
                      {tx.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.fromBucket && tx.toBucket 
                        ? `${tx.fromBucket} → ${tx.toBucket}`
                        : tx.toBucket || ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground text-sm">
                    {tx.amount ? `$${Number(tx.amount).toLocaleString()}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
