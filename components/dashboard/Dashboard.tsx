'use client'

import { useState, useCallback } from 'react'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BucketCard, BucketErrorBoundary } from '@/components/bucket'
import { WalletConnectButton } from '@/components/wallet/ConnectButton'
import { TransferModal } from '@/components/transfer'
import { SweepNotifications, SweepHistory } from '@/components/sweep'
import { YieldRateComparison } from '@/components/yield/YieldRateComparison'
import { PortfolioSummary } from '@/components/portfolio'
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator'
import { MultiAssetDepositModal } from '@/components/deposit/MultiAssetDepositModal'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { formatEther, Address } from 'viem'
import { useBucketVault } from '@/lib/hooks/useBucketVault'
import { useBucketTransfer } from '@/lib/hooks/useBucketTransfer'
import { useHapticFeedback, usePullToRefresh, useIsMobile } from '@/lib/hooks'
import { BucketType } from '@/types'

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const contractAddresses = getContractAddresses(chainId)
  
  // Mobile optimizations
  const { triggerHaptic } = useHapticFeedback()
  const isMobile = useIsMobile()
  
  // Transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferSource, setTransferSource] = useState<BucketType | null>(null)
  const [transferDestination, setTransferDestination] = useState<BucketType | null>(null)
  const [transferSourceBalance, setTransferSourceBalance] = useState<bigint>(0n)
  const [showDestinationSelector, setShowDestinationSelector] = useState(false)
  
  // Deposit modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [depositBucket, setDepositBucket] = useState<BucketType | null>(null)
  
  const { 
    executeTransfer, 
    estimateFees, 
    isTransferring, 
    isComplete,
    getStatusMessage,
    conversionInfo,
  } = useBucketTransfer()

  // Bucket vault addresses
  const bucketVaultAddresses = {
    bills: contractAddresses?.buckets.bills,
    savings: contractAddresses?.buckets.savings,
    growth: contractAddresses?.buckets.growth,
    spendable: contractAddresses?.buckets.spendable,
  }

  // Get bucket vault data for portfolio calculation
  const billsVault = useBucketVault(contractAddresses?.buckets.bills)
  const savingsVault = useBucketVault(contractAddresses?.buckets.savings)
  const growthVault = useBucketVault(contractAddresses?.buckets.growth)
  const spendableVault = useBucketVault(contractAddresses?.buckets.spendable)
  
  // Pull to refresh functionality
  const handleRefresh = useCallback(async () => {
    // Trigger haptic feedback
    triggerHaptic('medium')
    
    // Refetch all data
    billsVault.refetchAll()
    savingsVault.refetchAll()
    growthVault.refetchAll()
    spendableVault.refetchAll()
    
    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500))
  }, [billsVault, savingsVault, growthVault, spendableVault, triggerHaptic])
  
  const { isRefreshing, pullDistance } = usePullToRefresh(handleRefresh)

  // Handle deposit initiation
  const handleDepositInitiate = (bucket: BucketType) => {
    triggerHaptic('light')
    setDepositBucket(bucket)
    setIsDepositModalOpen(true)
  }

  // Close deposit modal
  const handleCloseDepositModal = () => {
    setIsDepositModalOpen(false)
    setDepositBucket(null)
  }

  // Authentication gate - show connect wallet if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
          <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
        </div>
        <div className="text-center flex flex-col items-center justify-center max-w-md relative z-10">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            PalmBudget
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Connect your wallet to access your gesture-controlled budgeting dashboard
          </p>
          <WalletConnectButton />
          <p className="text-sm text-muted-foreground mt-4">
            Powered by RainbowKit on Mantle Network
          </p>
        </div>
      </div>
    )
  }

  // Show error if no contract addresses available
  if (!contractAddresses) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center max-w-md glass p-8">
          <h2 className="text-2xl font-bold text-red-400 mb-4">
            Network Error
          </h2>
          <p className="text-muted-foreground mb-4">
            Unable to load contract addresses for the current network.
          </p>
          <p className="text-sm text-muted-foreground">
            Please ensure you're connected to Mantle Network.
          </p>
        </div>
      </div>
    )
  }

  // Handle transfer initiation from bucket card
  const handleTransferInitiate = (sourceBucket: BucketType, sourceBalance: bigint) => {
    triggerHaptic('light')
    setTransferSource(sourceBucket)
    setTransferSourceBalance(sourceBalance)
    setShowDestinationSelector(true)
  }

  // Handle destination bucket selection
  const handleDestinationSelect = (destinationBucket: BucketType) => {
    if (destinationBucket === transferSource) {
      triggerHaptic('heavy')
      alert('Cannot transfer to the same bucket')
      return
    }
    triggerHaptic('medium')
    setTransferDestination(destinationBucket)
    setShowDestinationSelector(false)
    setIsTransferModalOpen(true)
  }

  // Handle transfer execution
  const handleTransfer = async (amount: bigint) => {
    if (!transferSource || !transferDestination || !contractAddresses) return
    
    const sourceVault = contractAddresses.buckets[transferSource]
    const destinationVault = contractAddresses.buckets[transferDestination]
    
    try {
      await executeTransfer({
        sourceVault,
        destinationVault,
        amount,
        sourceBucket: transferSource,
        destinationBucket: transferDestination,
      })
    } catch (error) {
      console.error('Transfer failed:', error)
      // Error is handled by the hook and displayed in the modal
    }
  }

  // Close transfer modal
  const handleCloseTransferModal = () => {
    setIsTransferModalOpen(false)
    setTransferSource(null)
    setTransferDestination(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
      </div>

      {/* Pull to refresh indicator */}
      {isMobile && <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />}

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your buckets and track your portfolio
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/mint"
                className="flex items-center px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm font-semibold"
              >
                🪙 Mint Tokens
              </Link>
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 bg-background border border-white/10 rounded-lg text-foreground hover:border-white/20 transition-colors text-sm font-semibold"
              >
                ⚙️ Settings
              </Link>
              <div className="flex items-center">
                <WalletConnectButton />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Portfolio Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-6"
          >
            <PortfolioSummary />
          </motion.div>

          {/* Bucket Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass p-6"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Your Buckets</h2>
              {showDestinationSelector && (
                <p className="text-emerald-400 text-sm">
                  👆 Select destination bucket for transfer
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <BucketErrorBoundary bucketType="bills">
                <div className="relative group">
                  <BucketCard 
                    type="bills" 
                    onTransferInitiate={handleTransferInitiate}
                    className={showDestinationSelector && transferSource !== 'bills' ? 'ring-2 ring-blue-500 cursor-pointer' : ''}
                    onClick={showDestinationSelector && transferSource !== 'bills' ? () => handleDestinationSelect('bills') : undefined}
                  />
                  {!showDestinationSelector && (
                    <button
                      onClick={() => handleDepositInitiate('bills')}
                      className="absolute top-2 right-2 px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors text-xs font-semibold opacity-0 group-hover:opacity-100"
                    >
                      + Deposit
                    </button>
                  )}
                </div>
              </BucketErrorBoundary>
              
              <BucketErrorBoundary bucketType="savings">
                <div className="relative group">
                  <BucketCard 
                    type="savings" 
                    onTransferInitiate={handleTransferInitiate}
                    className={showDestinationSelector && transferSource !== 'savings' ? 'ring-2 ring-emerald-500 cursor-pointer' : ''}
                    onClick={showDestinationSelector && transferSource !== 'savings' ? () => handleDestinationSelect('savings') : undefined}
                  />
                  {!showDestinationSelector && (
                    <button
                      onClick={() => handleDepositInitiate('savings')}
                      className="absolute top-2 right-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-colors text-xs font-semibold opacity-0 group-hover:opacity-100"
                    >
                      + Deposit
                    </button>
                  )}
                </div>
              </BucketErrorBoundary>
              
              <BucketErrorBoundary bucketType="growth">
                <div className="relative group">
                  <BucketCard 
                    type="growth" 
                    onTransferInitiate={handleTransferInitiate}
                    className={showDestinationSelector && transferSource !== 'growth' ? 'ring-2 ring-purple-500 cursor-pointer' : ''}
                    onClick={showDestinationSelector && transferSource !== 'growth' ? () => handleDestinationSelect('growth') : undefined}
                  />
                  {!showDestinationSelector && (
                    <button
                      onClick={() => handleDepositInitiate('growth')}
                      className="absolute top-2 right-2 px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors text-xs font-semibold opacity-0 group-hover:opacity-100"
                    >
                      + Deposit
                    </button>
                  )}
                </div>
              </BucketErrorBoundary>
              
              <BucketErrorBoundary bucketType="spendable">
                <div className="relative group">
                  <BucketCard 
                    type="spendable" 
                    onTransferInitiate={handleTransferInitiate}
                    className={showDestinationSelector && transferSource !== 'spendable' ? 'ring-2 ring-amber-500 cursor-pointer' : ''}
                    onClick={showDestinationSelector && transferSource !== 'spendable' ? () => handleDestinationSelect('spendable') : undefined}
                  />
                  {!showDestinationSelector && (
                    <button
                      onClick={() => handleDepositInitiate('spendable')}
                      className="absolute top-2 right-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/30 transition-colors text-xs font-semibold opacity-0 group-hover:opacity-100"
                    >
                      + Deposit
                    </button>
                  )}
                </div>
              </BucketErrorBoundary>
            </div>
            
            {showDestinationSelector && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setShowDestinationSelector(false)
                    setTransferSource(null)
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Cancel Transfer
                </button>
              </div>
            )}
          </motion.div>

          {/* Yield Summary Section with Dynamic Tracking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass p-6"
        >
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Yield Performance & Sweep Destination
          </h2>
          <YieldRateComparison showDetails={true} />
        </motion.div>

        {/* Sweep History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <SweepHistory />
        </motion.div>

          {/* Sweep Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <SweepNotifications />
          </motion.div>
        </div>
      </div>

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={handleCloseTransferModal}
        sourceBucket={transferSource}
        destinationBucket={transferDestination}
        sourceBalance={transferSourceBalance}
        onTransfer={handleTransfer}
        isTransferring={isTransferring}
        transferComplete={isComplete}
        statusMessage={getStatusMessage()}
        conversionInfo={conversionInfo || undefined}
        estimatedFees={transferSource && transferDestination ? estimateFees(transferSource, transferDestination) : undefined}
      />

      {/* Deposit Modal */}
      <MultiAssetDepositModal
        isOpen={isDepositModalOpen}
        onClose={handleCloseDepositModal}
        vaultAddress={depositBucket ? contractAddresses.buckets[depositBucket] : '0x' as Address}
        vaultName={depositBucket ? depositBucket.charAt(0).toUpperCase() + depositBucket.slice(1) : ''}
      />
    </div>
  )
}