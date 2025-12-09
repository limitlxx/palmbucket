'use client'

import { useState, useCallback } from 'react'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { BucketCard, BucketErrorBoundary } from '@/components/bucket'
import { WalletConnectButton } from '@/components/wallet/ConnectButton'
import { TransferModal } from '@/components/transfer'
import { SweepNotifications, SweepHistory } from '@/components/sweep'
import { YieldRateComparison } from '@/components/yield/YieldRateComparison'
import { PortfolioSummary } from '@/components/portfolio'
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { formatEther } from 'viem'
import { useBucketVault } from '@/lib/hooks/useBucketVault'
import { useBucketTransfer } from '@/lib/hooks/useBucketTransfer'
import { useHapticFeedback, usePullToRefresh, useIsMobile, useMobileAnimations } from '@/lib/hooks'
import { BucketType } from '@/types'

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const contractAddresses = getContractAddresses(chainId)
  
  // Mobile optimizations
  const { triggerHaptic } = useHapticFeedback()
  const isMobile = useIsMobile()
  const { shouldAnimate, animationDuration } = useMobileAnimations()
  
  // Transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferSource, setTransferSource] = useState<BucketType | null>(null)
  const [transferDestination, setTransferDestination] = useState<BucketType | null>(null)
  const [transferSourceBalance, setTransferSourceBalance] = useState<bigint>(0n)
  const [showDestinationSelector, setShowDestinationSelector] = useState(false)
  
  const { 
    executeTransfer, 
    estimateFees, 
    isTransferring, 
    isComplete,
    getStatusMessage,
    conversionInfo,
    error: transferError
  } = useBucketTransfer()

  // Get native balance for total portfolio calculation
  const { data: nativeBalance } = useBalance({
    address,
    query: {
      enabled: !!address,
    },
  })

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

  // Calculate total portfolio value
  const calculateTotalPortfolio = () => {
    let total = 0
    
    if (billsVault.shareBalance) {
      total += Number(formatEther(billsVault.shareBalance))
    }
    if (savingsVault.shareBalance) {
      total += Number(formatEther(savingsVault.shareBalance))
    }
    if (growthVault.shareBalance) {
      total += Number(formatEther(growthVault.shareBalance))
    }
    if (spendableVault.shareBalance) {
      total += Number(formatEther(spendableVault.shareBalance))
    }
    
    return total.toFixed(2)
  }

  // Calculate yield summary
  const calculateYieldSummary = () => {
    const yields = [
      { name: 'Bills', rate: billsVault.yieldRate, balance: billsVault.shareBalance },
      { name: 'Savings', rate: savingsVault.yieldRate, balance: savingsVault.shareBalance },
      { name: 'Growth', rate: growthVault.yieldRate, balance: growthVault.shareBalance },
    ]

    let totalYieldEarning = 0
    let weightedYieldRate = 0
    let totalBalance = 0

    yields.forEach(({ rate, balance }) => {
      if (rate && balance) {
        const balanceNum = Number(formatEther(balance))
        const rateNum = Number(rate) / 100
        totalYieldEarning += balanceNum * (rateNum / 100) // Monthly yield approximation
        weightedYieldRate += balanceNum * rateNum
        totalBalance += balanceNum
      }
    })

    const avgYieldRate = totalBalance > 0 ? (weightedYieldRate / totalBalance).toFixed(2) : '0.00'

    return {
      monthlyYield: totalYieldEarning.toFixed(2),
      avgYieldRate,
    }
  }

  // Authentication gate - show connect wallet if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PalmBudget
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Connect your wallet to access your gesture-controlled budgeting dashboard
          </p>
          <WalletConnectButton />
          <p className="text-sm text-gray-500 mt-4">
            Powered by RainbowKit on Mantle Network
          </p>
        </div>
      </div>
    )
  }

  // Show error if no contract addresses available
  if (!contractAddresses) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Network Error
          </h2>
          <p className="text-gray-600 mb-4">
            Unable to load contract addresses for the current network.
          </p>
          <p className="text-sm text-gray-500">
            Please ensure you're connected to Mantle Network.
          </p>
        </div>
      </div>
    )
  }

  const totalPortfolio = calculateTotalPortfolio()
  const yieldSummary = calculateYieldSummary()

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Pull to refresh indicator */}
      {isMobile && <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />}
      
      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                PalmBudget
              </h1>
              <span className="ml-2 sm:ml-3 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                {isMobile ? '✓' : 'Connected'}
              </span>
            </div>
            
            {/* Navigation - Hidden on mobile */}
            <nav className="hidden md:flex space-x-8">
              <a href="#dashboard" className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Dashboard
              </a>
              <a href="#settings" className="text-gray-500 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                Settings
              </a>
            </nav>

            {/* Wallet Info - Mobile Optimized */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {!isMobile && <SweepNotifications />}
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Summary with comprehensive analytics */}
        <div className="mb-8">
          <PortfolioSummary />
        </div>

        {/* Bucket Cards Grid - Mobile Optimized */}
        <div className="mb-8">
          <h2 className={`font-semibold text-gray-900 mb-4 sm:mb-6 ${isMobile ? 'text-lg' : 'text-xl'}`}>
            Your Buckets
            {showDestinationSelector && (
              <span className={`ml-2 sm:ml-4 text-blue-600 font-normal ${isMobile ? 'text-xs block mt-1' : 'text-sm'}`}>
                👆 Select destination bucket for transfer
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <BucketErrorBoundary bucketType="bills">
              <BucketCard 
                type="bills" 
                onTransferInitiate={handleTransferInitiate}
                className={showDestinationSelector && transferSource !== 'bills' ? 'ring-2 ring-blue-500 cursor-pointer' : ''}
                onClick={showDestinationSelector && transferSource !== 'bills' ? () => handleDestinationSelect('bills') : undefined}
              />
            </BucketErrorBoundary>
            
            <BucketErrorBoundary bucketType="savings">
              <BucketCard 
                type="savings" 
                onTransferInitiate={handleTransferInitiate}
                className={showDestinationSelector && transferSource !== 'savings' ? 'ring-2 ring-blue-500 cursor-pointer' : ''}
                onClick={showDestinationSelector && transferSource !== 'savings' ? () => handleDestinationSelect('savings') : undefined}
              />
            </BucketErrorBoundary>
            
            <BucketErrorBoundary bucketType="growth">
              <BucketCard 
                type="growth" 
                onTransferInitiate={handleTransferInitiate}
                className={showDestinationSelector && transferSource !== 'growth' ? 'ring-2 ring-blue-500 cursor-pointer' : ''}
                onClick={showDestinationSelector && transferSource !== 'growth' ? () => handleDestinationSelect('growth') : undefined}
              />
            </BucketErrorBoundary>
            
            <BucketErrorBoundary bucketType="spendable">
              <BucketCard 
                type="spendable" 
                onTransferInitiate={handleTransferInitiate}
                className={showDestinationSelector && transferSource !== 'spendable' ? 'ring-2 ring-blue-500 cursor-pointer' : ''}
                onClick={showDestinationSelector && transferSource !== 'spendable' ? () => handleDestinationSelect('spendable') : undefined}
              />
            </BucketErrorBoundary>
          </div>
          
          {showDestinationSelector && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setShowDestinationSelector(false)
                  setTransferSource(null)
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Cancel Transfer
              </button>
            </div>
          )}
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

        {/* Yield Summary Section with Dynamic Tracking */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Yield Performance & Sweep Destination
            </h2>
            <YieldRateComparison showDetails={true} />
          </div>
        </div>

        {/* Sweep History */}
        <div className="mb-8">
          <SweepHistory />
        </div>

        {/* Quick Actions - Mobile Optimized */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          <h2 className={`font-semibold text-gray-900 mb-4 ${isMobile ? 'text-lg' : 'text-xl'}`}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <button 
              onClick={() => triggerHaptic('light')}
              className="p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors active:scale-95"
            >
              <div className="text-center">
                <div className={`mb-1 sm:mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>💸</div>
                <div className={`font-medium text-gray-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>Transfer Funds</div>
              </div>
            </button>
            
            <button 
              onClick={() => triggerHaptic('light')}
              className="p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors active:scale-95"
            >
              <div className="text-center">
                <div className={`mb-1 sm:mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>⚙️</div>
                <div className={`font-medium text-gray-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>Split Settings</div>
              </div>
            </button>
            
            <button 
              onClick={() => triggerHaptic('light')}
              className="p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors active:scale-95"
            >
              <div className="text-center">
                <div className={`mb-1 sm:mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>🤖</div>
                <div className={`font-medium text-gray-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>Auto-Sweep</div>
              </div>
            </button>
            
            <button 
              onClick={() => triggerHaptic('light')}
              className="p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors active:scale-95"
            >
              <div className="text-center">
                <div className={`mb-1 sm:mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>👋</div>
                <div className={`font-medium text-gray-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>Gesture Control</div>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Footer - Mobile Optimized */}
      <footer className="bg-white border-t mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="text-center text-gray-500">
            <p className={isMobile ? 'text-xs' : 'text-sm'}>
              PalmBudget - Gesture-Controlled Budgeting on Mantle Network
            </p>
            {!isMobile && (
              <p className="mt-1 text-sm">
                Connected to {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Wallet'}
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}