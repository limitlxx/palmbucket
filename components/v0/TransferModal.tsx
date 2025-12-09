"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useChainId } from "wagmi"
import { formatUnits, parseUnits } from "viem"
import { getContractAddresses } from "@/lib/contracts/addresses"
import { useBucketTransfer } from "@/lib/hooks/useBucketTransfer"
import { Button } from "@/components/ui/button"
import type { BucketType } from "@/types"

interface TransferModalProps {
  sourceBucket: BucketType
  sourceBalance: bigint
  isOpen: boolean
  onClose: () => void
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

export default function TransferModal({
  sourceBucket,
  sourceBalance,
  isOpen,
  onClose,
}: TransferModalProps) {
  const chainId = useChainId()
  const addresses = getContractAddresses(chainId)
  const sourceConfig = BUCKET_CONFIG[sourceBucket]

  const [destinationBucket, setDestinationBucket] = useState<BucketType | null>(null)
  const [amount, setAmount] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)

  const {
    executeTransfer,
    estimateFees,
    validateTransfer,
    resetTransfer,
    transferState,
    conversionInfo,
    isTransferring,
    isComplete,
    getStatusMessage,
    error,
  } = useBucketTransfer()

  // Get available destination buckets (all except source)
  const availableBuckets = (Object.keys(BUCKET_CONFIG) as BucketType[]).filter(
    (bucket) => bucket !== sourceBucket
  )

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDestinationBucket(null)
      setAmount("")
      setShowSuccess(false)
      resetTransfer()
    }
  }, [isOpen, resetTransfer])

  // Show success animation when transfer completes
  useEffect(() => {
    if (isComplete) {
      setShowSuccess(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }, [isComplete, onClose])

  const handleMaxClick = () => {
    setAmount(formatUnits(sourceBalance, 6))
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  const handleConfirm = useCallback(() => {
    if (!destinationBucket || !addresses) return

    const amountBigInt = parseUnits(amount, 6)
    const validation = validateTransfer(sourceBucket, amountBigInt, sourceBalance)

    if (!validation.valid) {
      alert(validation.error)
      return
    }

    const sourceVault = addresses.buckets[sourceBucket]
    const destVault = addresses.buckets[destinationBucket]

    executeTransfer({
      sourceVault,
      destinationVault: destVault,
      amount: amountBigInt,
      sourceBucket,
      destinationBucket,
    })
  }, [
    destinationBucket,
    addresses,
    amount,
    validateTransfer,
    sourceBucket,
    sourceBalance,
    executeTransfer,
  ])

  const amountNum = parseFloat(amount || "0")
  const balanceNum = parseFloat(formatUnits(sourceBalance, 6))
  const isValidAmount = amountNum > 0 && amountNum <= balanceNum
  const canTransfer = isValidAmount && destinationBucket && !isTransferring

  const fees = destinationBucket ? estimateFees(sourceBucket, destinationBucket) : null

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
            className="glass max-w-md w-full max-h-[90vh] overflow-y-auto relative"
          >
            {/* Success Overlay */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 glass rounded-lg flex items-center justify-center z-10"
                >
                  <div className="text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-10 h-10 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Transfer Complete!</h3>
                    <p className="text-muted-foreground">
                      Funds moved to {destinationBucket && BUCKET_CONFIG[destinationBucket].name}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 glass border-b border-white/10 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Transfer Funds</h2>
                <p className="text-sm text-muted-foreground">Move funds between buckets</p>
              </div>
              <button
                onClick={onClose}
                disabled={isTransferring}
                className="text-muted-foreground hover:text-foreground transition-colors text-2xl disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Source and Destination */}
              <div className="flex items-center gap-3">
                {/* Source */}
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-2">From</label>
                  <div
                    className={`glass border-2 ${sourceConfig.borderColor} p-3 rounded-lg flex items-center gap-2`}
                  >
                    <span className="text-2xl">{sourceConfig.icon}</span>
                    <div className="flex-1">
                      <div className={`font-semibold ${sourceConfig.textColor}`}>
                        {sourceConfig.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${formatUnits(sourceBalance, 6)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="pt-6">
                  <svg
                    className="w-6 h-6 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>

                {/* Destination */}
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-2">To</label>
                  {destinationBucket ? (
                    <div
                      className={`glass border-2 ${BUCKET_CONFIG[destinationBucket].borderColor} p-3 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-card/50 transition-colors`}
                      onClick={() => !isTransferring && setDestinationBucket(null)}
                    >
                      <span className="text-2xl">{BUCKET_CONFIG[destinationBucket].icon}</span>
                      <div className="flex-1">
                        <div className={`font-semibold ${BUCKET_CONFIG[destinationBucket].textColor}`}>
                          {BUCKET_CONFIG[destinationBucket].name}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableBuckets.map((bucket) => (
                        <button
                          key={bucket}
                          onClick={() => setDestinationBucket(bucket)}
                          disabled={isTransferring}
                          className={`w-full glass border ${BUCKET_CONFIG[bucket].borderColor} p-2 rounded-lg flex items-center gap-2 hover:bg-card/50 transition-colors disabled:opacity-50`}
                        >
                          <span className="text-xl">{BUCKET_CONFIG[bucket].icon}</span>
                          <span className={`text-sm font-medium ${BUCKET_CONFIG[bucket].textColor}`}>
                            {BUCKET_CONFIG[bucket].name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Input */}
              {destinationBucket && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-foreground">Amount</label>
                    <button
                      onClick={handleMaxClick}
                      disabled={isTransferring}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-muted-foreground text-lg">$</span>
                    </div>
                    <input
                      type="text"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      disabled={isTransferring}
                      className="w-full pl-8 pr-4 py-3 text-lg glass border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                    />
                  </div>
                  {!isValidAmount && amount && (
                    <p className="mt-1 text-xs text-red-400">
                      {amountNum > balanceNum ? "Insufficient balance" : "Enter a valid amount"}
                    </p>
                  )}
                </div>
              )}

              {/* Conversion Info */}
              {conversionInfo && (
                <div className="glass border border-blue-500/20 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-semibold text-blue-400 mb-2">Conversion Details</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Assets:</span>
                      <span className="text-foreground">
                        ${formatUnits(conversionInfo.expectedAssets, 6)}
                      </span>
                    </div>
                    {conversionInfo.conversionFee > 0n && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conversion Fee:</span>
                        <span className="text-red-400">
                          -${formatUnits(conversionInfo.conversionFee, 6)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Slippage:</span>
                      <span className="text-foreground">{conversionInfo.slippage}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-white/10 pt-2 mt-2">
                      <span className="text-foreground">Net Amount:</span>
                      <span className="text-emerald-400">
                        ${formatUnits(conversionInfo.netAmount, 6)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimated Fees */}
              {fees && !conversionInfo && destinationBucket && (
                <div className="glass border border-yellow-500/20 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-semibold text-yellow-400 mb-2">Estimated Fees</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversion Fee:</span>
                      <span className="text-foreground">{fees.conversionFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Slippage:</span>
                      <span className="text-foreground">{fees.slippage}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Status */}
              {isTransferring && (
                <div className="glass border border-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                    <div className="text-sm font-medium text-foreground">{getStatusMessage()}</div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="glass border border-red-500/20 rounded-lg p-4">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}

              {/* Withdrawal Warning */}
              {sourceBucket === "bills" && (
                <div className="glass border border-orange-500/20 rounded-lg p-4">
                  <div className="text-sm font-semibold text-orange-400 mb-2">
                    ⚠️ Withdrawal Restriction
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Bills vault has a 7-day withdrawal delay and 2% fee. Ensure your last deposit was
                    more than 7 days ago.
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/10 flex gap-3">
              <Button
                onClick={onClose}
                disabled={isTransferring}
                variant="outline"
                className="flex-1 border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canTransfer}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {isTransferring ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Transferring...
                  </span>
                ) : (
                  "Confirm Transfer"
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
