"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAccount, useChainId, useWatchContractEvent, useReadContract } from "wagmi"
import { Address, formatUnits, parseAbiItem } from "viem"
import { bucketVaultAbi, paymentRouterAbi, sweepKeeperAbi } from "@/lib/contracts/abis"
import { getContractAddresses } from "@/lib/contracts/addresses"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { BucketType } from "@/types"

interface BucketDetailModalProps {
  bucketType: BucketType
  isOpen: boolean
  onClose: () => void
  onDeposit?: () => void
  onWithdraw?: () => void
  onTransfer?: () => void
}

interface TransactionEvent {
  type: "deposit" | "withdraw" | "yield" | "sweep" | "payment"
  amount: bigint
  timestamp: number
  txHash: string
  description: string
}

const BUCKET_CONFIG = {
  bills: {
    name: "Bills",
    icon: "💰",
    color: "blue",
    borderColor: "border-blue-500/40",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
  },
  savings: {
    name: "Savings",
    icon: "🏦",
    color: "emerald",
    borderColor: "border-emerald-500/40",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
  },
  growth: {
    name: "Growth",
    icon: "📊",
    color: "purple",
    borderColor: "border-purple-500/40",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
  },
  spendable: {
    name: "Spendable",
    icon: "💸",
    color: "amber",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
  },
} as const

export default function BucketDetailModal({
  bucketType,
  isOpen,
  onClose,
  onDeposit,
  onWithdraw,
  onTransfer,
}: BucketDetailModalProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const config = BUCKET_CONFIG[bucketType]
  const addresses = getContractAddresses(chainId)

  // Get vault address for this bucket type
  const vaultAddress = addresses?.buckets?.[bucketType] as Address | undefined

  const [transactions, setTransactions] = useState<TransactionEvent[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Read user's share balance
  const { data: shareBalance, isLoading: isLoadingBalance } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!vaultAddress,
    },
  })

  // Read current yield rate from contract
  const { data: yieldRate, isLoading: isLoadingYieldRate } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: "getYieldRate",
    query: {
      enabled: !!vaultAddress,
    },
  })

  const isLoading = isLoadingBalance || isLoadingYieldRate

  // Calculate APY percentage from yield rate
  const apyPercent = yieldRate ? Number(yieldRate) / 100 : 0

  // Calculate projected returns
  const projectedReturns = useMemo(() => {
    if (!shareBalance || !yieldRate) return { daily: 0, monthly: 0, yearly: 0 }

    const rate = Number(yieldRate) / 10000 // Convert basis points to decimal
    const balanceNum = Number(formatUnits(shareBalance, 6))

    const yearly = balanceNum * rate
    const monthly = yearly / 12
    const daily = yearly / 365

    return { daily, monthly, yearly }
  }, [shareBalance, yieldRate])

  // Load transaction history from localStorage
  useEffect(() => {
    if (!address) return

    const storageKey = `palmbudget_${bucketType}_history_${address}`
    const stored = localStorage.getItem(storageKey)

    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const history = parsed.map((e: any) => ({
          ...e,
          amount: BigInt(e.amount),
        }))
        setTransactions(history)
      } catch (error) {
        console.error("Failed to load transaction history:", error)
      }
    }

    setIsLoadingHistory(false)
  }, [bucketType, address])

  // Save transaction history to localStorage
  useEffect(() => {
    if (transactions.length > 0 && address) {
      const storageKey = `palmbudget_${bucketType}_history_${address}`
      const serializable = transactions.map((e) => ({
        ...e,
        amount: e.amount.toString(),
      }))
      localStorage.setItem(storageKey, JSON.stringify(serializable))
    }
  }, [transactions, bucketType, address])

  // Watch for Transfer events (deposits and withdrawals)
  useWatchContractEvent({
    address: vaultAddress!,
    abi: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)") as any,
    eventName: "Transfer",
    enabled: !!vaultAddress,
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (!address) return

        const from = log.args?.from as Address
        const to = log.args?.to as Address
        const value = log.args?.value as bigint

        if (to.toLowerCase() === address.toLowerCase() && from !== address) {
          const event: TransactionEvent = {
            type: "deposit",
            amount: value,
            timestamp: Date.now(),
            txHash: log.transactionHash || "",
            description: "Deposit to bucket",
          }

          setTransactions((prev) => {
            const exists = prev.some((e) => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }

        if (from.toLowerCase() === address.toLowerCase() && to !== address) {
          const event: TransactionEvent = {
            type: "withdraw",
            amount: value,
            timestamp: Date.now(),
            txHash: log.transactionHash || "",
            description: "Withdrawal from bucket",
          }

          setTransactions((prev) => {
            const exists = prev.some((e) => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
      })
    },
  })

  // Watch for PaymentRouted events
  useWatchContractEvent({
    address: addresses?.paymentRouter,
    abi: paymentRouterAbi,
    eventName: "PaymentRouted",
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (!address) return

        const user = log.args?.user as Address
        if (user.toLowerCase() !== address.toLowerCase()) return

        const amounts = Array.from(log.args?.amounts || []) as bigint[]
        const bucketIndex = ["bills", "savings", "growth", "spendable"].indexOf(bucketType)

        if (bucketIndex >= 0 && amounts[bucketIndex] > 0n) {
          const event: TransactionEvent = {
            type: "payment",
            amount: amounts[bucketIndex],
            timestamp: Date.now(),
            txHash: log.transactionHash || "",
            description: "Auto-split payment",
          }

          setTransactions((prev) => {
            const exists = prev.some((e) => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
      })
    },
  })

  // Watch for SweepExecuted events
  useWatchContractEvent({
    address: addresses?.sweepKeeper,
    abi: sweepKeeperAbi,
    eventName: "SweepExecuted",
    enabled: !!addresses?.sweepKeeper && !!vaultAddress,
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (!address || !vaultAddress) return

        const user = log.args?.user as Address
        const toBucket = log.args?.toBucket as Address
        const fromBucket = log.args?.fromBucket as Address
        const amount = log.args?.amount as bigint

        if (user.toLowerCase() !== address.toLowerCase()) return

        if (toBucket.toLowerCase() === vaultAddress.toLowerCase()) {
          const event: TransactionEvent = {
            type: "sweep",
            amount: amount,
            timestamp: Date.now(),
            txHash: log.transactionHash || "",
            description: "Auto-sweep deposit",
          }

          setTransactions((prev) => {
            const exists = prev.some((e) => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        } else if (fromBucket.toLowerCase() === vaultAddress.toLowerCase()) {
          const event: TransactionEvent = {
            type: "sweep",
            amount: amount,
            timestamp: Date.now(),
            txHash: log.transactionHash || "",
            description: "Auto-sweep withdrawal",
          }

          setTransactions((prev) => {
            const exists = prev.some((e) => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
      })
    },
  })

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return "Just now"
  }

  const getTransactionIcon = (txType: TransactionEvent["type"]) => {
    switch (txType) {
      case "deposit":
      case "payment":
        return "💰"
      case "withdraw":
        return "💵"
      case "yield":
        return "📈"
      case "sweep":
        return "🔄"
      default:
        return "📝"
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 glass border-b border-white/10 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{config.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{config.name} Bucket</h2>
                  <p className="text-sm text-muted-foreground">View details and manage funds</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Current Balance */}
              <div className="glass p-6">
                <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
                {isLoading ? (
                  <Skeleton className="h-12 w-48" />
                ) : (
                  <p className="text-4xl font-bold text-foreground">
                    ${shareBalance ? Number(formatUnits(shareBalance, 6)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                  </p>
                )}
                {apyPercent > 0 && (
                  <span className={`inline-flex mt-3 px-3 py-1 rounded-full text-sm font-semibold ${config.bgColor} ${config.textColor}`}>
                    {apyPercent.toFixed(2)}% APY
                  </span>
                )}
              </div>

              {/* Projected Returns */}
              {apyPercent > 0 && (
                <div className="glass p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Projected Returns</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Daily</p>
                      <p className={`text-xl font-bold ${config.textColor}`}>
                        ${projectedReturns.daily.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                      <p className={`text-xl font-bold ${config.textColor}`}>
                        ${projectedReturns.monthly.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Yearly</p>
                      <p className={`text-xl font-bold ${config.textColor}`}>
                        ${projectedReturns.yearly.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={onDeposit}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Deposit
                </Button>
                <Button
                  onClick={onWithdraw}
                  variant="outline"
                  className="w-full border-white/20 hover:bg-white/10"
                >
                  Withdraw
                </Button>
                <Button
                  onClick={onTransfer}
                  variant="outline"
                  className="w-full border-white/20 hover:bg-white/10"
                >
                  Transfer
                </Button>
              </div>

              {/* Transaction History */}
              <div className="glass p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Transaction History</h3>

                {isLoadingHistory ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-6 h-6 rounded" />
                          <div>
                            <Skeleton className="h-4 w-32 mb-1" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">No transactions yet</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Your transactions will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {transactions.slice(0, 10).map((tx, index) => (
                      <motion.div
                        key={`${tx.txHash}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{getTransactionIcon(tx.type)}</span>
                          <div>
                            <p className="font-medium text-foreground text-sm capitalize">
                              {tx.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(tx.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold text-sm ${
                              tx.type === "deposit" || tx.type === "payment" || tx.type === "yield"
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {tx.type === "deposit" || tx.type === "payment" || tx.type === "yield"
                              ? "+"
                              : "-"}
                            ${Number(formatUnits(tx.amount, 6)).toFixed(2)}
                          </p>
                          {tx.txHash && (
                            <a
                              href={`https://explorer.mantle.xyz/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View TX
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
