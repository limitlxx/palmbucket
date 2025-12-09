"use client"

import { motion } from "framer-motion"
import { useAccount, useChainId } from "wagmi"
import { useBucketVault } from "@/lib/hooks/useBucketVault"
import { Skeleton } from "@/components/ui/skeleton"
import { formatUnits } from "viem"
import { getContractAddresses } from "@/lib/contracts/addresses"

export default function HeroSection() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const addresses = getContractAddresses(chainId)
  
  // Get balances from all buckets
  const { shareBalance: billsBalance, isLoading: billsLoading } = useBucketVault(addresses?.billsVault)
  const { shareBalance: savingsBalance, isLoading: savingsLoading } = useBucketVault(addresses?.savingsVault)
  const { shareBalance: growthBalance, isLoading: growthLoading } = useBucketVault(addresses?.growthVault)
  const { shareBalance: spendableBalance, isLoading: spendableLoading } = useBucketVault(addresses?.spendableVault)

  const isLoading = billsLoading || savingsLoading || growthLoading || spendableLoading

  // Calculate total portfolio value
  const totalPortfolio = isConnected && !isLoading
    ? Number(formatUnits(
        (billsBalance || 0n) + 
        (savingsBalance || 0n) + 
        (growthBalance || 0n) + 
        (spendableBalance || 0n),
        6 // USDC decimals
      ))
    : 0

  // TODO: Calculate month-over-month percentage from transaction history
  const monthlyChange = 4.7 // Placeholder

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-8 max-w-7xl mx-auto"
    >
      <div className="glass p-8">
        <p className="text-muted-foreground text-sm mb-2">Total Portfolio</p>
        {!isConnected ? (
          <>
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-4">$0.00</h2>
            <p className="text-muted-foreground text-sm">Connect wallet to see your portfolio</p>
          </>
        ) : isLoading ? (
          <>
            <Skeleton className="h-16 w-64 mb-4" />
            <Skeleton className="h-6 w-32" />
          </>
        ) : (
          <>
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-4">
              ${totalPortfolio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-semibold text-sm">
                📈 +{monthlyChange}%
              </span>
              <span className="text-muted-foreground text-sm">this month</span>
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}
