"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useChainId } from "wagmi"
import { getContractAddresses } from "@/lib/contracts/addresses"
import Header from "./Header"
import HeroSection from "./HeroSection"
import BucketGrid from "./BucketGrid"
import ActivityFeed from "./ActivityFeed"
import GestureToggleButton from "./GestureToggleButton"
import BucketDetailModal from "./BucketDetailModal"
import DepositModal from "./DepositModal"
import TransferModal from "./TransferModal"
import type { BucketType } from "@/types"
import { useReadContract } from "wagmi"
import { bucketVaultAbi } from "@/lib/contracts/abis"

export default function V0Dashboard() {
  const chainId = useChainId()
  const addresses = getContractAddresses(chainId)

  const [selectedBucket, setSelectedBucket] = useState<BucketType | null>(null)
  const [depositBucket, setDepositBucket] = useState<BucketType | null>(null)
  const [transferBucket, setTransferBucket] = useState<BucketType | null>(null)
  const [gestureEnabled, setGestureEnabled] = useState(false)

  // Get balance for transfer modal
  const transferVaultAddress = transferBucket && addresses?.buckets?.[transferBucket]
  const { data: transferBalance } = useReadContract({
    address: transferVaultAddress || undefined,
    abi: bucketVaultAbi,
    functionName: "balanceOf",
    args: transferVaultAddress && transferBucket ? [addresses?.buckets?.[transferBucket]!] : undefined,
    query: {
      enabled: !!transferVaultAddress,
    },
  })

  const handleDeposit = () => {
    if (selectedBucket) {
      setDepositBucket(selectedBucket)
      setSelectedBucket(null) // Close detail modal
    }
  }

  const handleWithdraw = () => {
    // TODO: Open withdraw modal
    console.log("Withdraw clicked for", selectedBucket)
  }

  const handleTransfer = () => {
    if (selectedBucket) {
      setTransferBucket(selectedBucket)
      setSelectedBucket(null) // Close detail modal
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <Header />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <HeroSection />

        <section className="px-4 py-6 max-w-7xl mx-auto">
          <BucketGrid onBucketSelect={setSelectedBucket} />
        </section>

        <section className="px-4 py-6 max-w-7xl mx-auto">
          <ActivityFeed />
        </section>
        
      </motion.main>

      <GestureToggleButton enabled={gestureEnabled} onToggle={setGestureEnabled} />
     

      {/* Bucket Detail Modal */}
      {selectedBucket && (
        <BucketDetailModal
          bucketType={selectedBucket}
          isOpen={!!selectedBucket}
          onClose={() => setSelectedBucket(null)}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onTransfer={handleTransfer}
        />
      )}

      {/* Deposit Modal */}
      {depositBucket && addresses?.buckets?.[depositBucket] && (
        <DepositModal
          bucketType={depositBucket}
          vaultAddress={addresses.buckets[depositBucket]}
          isOpen={!!depositBucket}
          onClose={() => setDepositBucket(null)}
        />
      )}

      {/* Transfer Modal */}
      {transferBucket && (
        <TransferModal
          sourceBucket={transferBucket}
          sourceBalance={transferBalance || 0n}
          isOpen={!!transferBucket}
          onClose={() => setTransferBucket(null)}
        />
      )}
    </div>
  )
}
