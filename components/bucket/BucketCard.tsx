'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useBucketVault } from '@/lib/hooks/useBucketVault'
import { useHapticFeedback } from '@/lib/hooks'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { Address } from 'viem'
import { formatEther } from 'viem'
import { BucketCardSkeleton } from './BucketCardSkeleton'
import { BucketDetailView } from './BucketDetailView'
import { MultiAssetDepositModal } from '@/components/deposit'

export type BucketType = 'bills' | 'savings' | 'growth' | 'spendable'

interface BucketCardProps {
  type: BucketType
  className?: string
  onTransferInitiate?: (sourceBucket: BucketType, sourceBalance: bigint) => void
  onClick?: () => void
}

const bucketConfig = {
  bills: {
    name: 'Bills',
    description: '7-day delay, 2% fee',
    color: 'bg-red-500',
    lightColor: 'bg-red-50',
    textColor: 'text-red-700',
    expectedAPY: '4-6%',
  },
  savings: {
    name: 'Savings',
    description: 'Ondo USDY integration',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    expectedAPY: '8-12%',
  },
  growth: {
    name: 'Growth',
    description: 'mETH staking',
    color: 'bg-green-500',
    lightColor: 'bg-green-50',
    textColor: 'text-green-700',
    expectedAPY: '4-6%',
  },
  spendable: {
    name: 'Spendable',
    description: 'Instant access',
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    expectedAPY: '0%',
  },
}

export function BucketCard({ type, className = '', onTransferInitiate, onClick: onClickProp }: BucketCardProps) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { triggerHaptic } = useHapticFeedback()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDetailView, setShowDetailView] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)
  
  const config = bucketConfig[type]
  const contractAddresses = getContractAddresses(chainId)
  const vaultAddress = contractAddresses?.buckets[type] as Address
  
  const {
    shareBalance,
    totalAssets,
    yieldRate,
    blockNumber,
    isLoading,
    isLoadingBalance,
    hasError,
    refetchAll,
  } = useBucketVault(vaultAddress)

  // Convert share balance to display format with loading state
  const displayBalance = shareBalance ? formatEther(shareBalance) : '0.00'
  const displayYieldRate = yieldRate ? (Number(yieldRate) / 100).toFixed(2) : config.expectedAPY
  
  // Calculate progress (mock calculation for now)
  const progress = Math.min((Number(displayBalance) / 1000) * 100, 100)
  
  // Track balance changes for animations
  const [previousBalance, setPreviousBalance] = useState(displayBalance)
  const [isBalanceUpdating, setIsBalanceUpdating] = useState(false)
  
  useEffect(() => {
    if (displayBalance !== previousBalance) {
      setIsBalanceUpdating(true)
      setPreviousBalance(displayBalance)
      const timer = setTimeout(() => setIsBalanceUpdating(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [displayBalance, previousBalance])

  // Show skeleton loading state
  if (!isConnected || !contractAddresses || isLoading) {
    return <BucketCardSkeleton type={type} className={className} />
  }
  
  // Show error state
  if (hasError) {
    return (
      <div className={`p-6 rounded-lg shadow-lg ${config.lightColor} ${className}`}>
        <div className="text-center">
          <div className={`text-lg font-semibold mb-2 ${config.textColor}`}>
            {config.name} Bucket
          </div>
          <div className="text-gray-600 mb-4">
            Unable to load data
          </div>
          <button
            onClick={() => {
              triggerHaptic('medium')
              refetchAll()
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium text-white ${config.color} hover:opacity-90 transition-colors`}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Handle drag start for transfer
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!onTransferInitiate) return
    
    triggerHaptic('light')
    
    const pos = 'touches' in e ? 
      { x: e.touches[0].clientX, y: e.touches[0].clientY } :
      { x: e.clientX, y: e.clientY }
    
    setDragStartPos(pos)
    setIsDragging(true)
  }

  // Handle drag end - check if dragged to another bucket
  const handleDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !dragStartPos || !onTransferInitiate) return
    
    const endPos = 'changedTouches' in e ?
      { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } :
      { x: e.clientX, y: e.clientY }
    
    // Calculate drag distance
    const distance = Math.sqrt(
      Math.pow(endPos.x - dragStartPos.x, 2) + 
      Math.pow(endPos.y - dragStartPos.y, 2)
    )
    
    // If dragged more than 50px, initiate transfer
    if (distance > 50 && shareBalance) {
      onTransferInitiate(type, shareBalance)
    }
    
    setIsDragging(false)
    setDragStartPos(null)
  }

  return (
    <>
      {showDetailView && (
        <BucketDetailView
          type={type}
          vaultAddress={vaultAddress}
          onClose={() => setShowDetailView(false)}
        />
      )}
      
      {showDepositModal && (
        <MultiAssetDepositModal
          vaultAddress={vaultAddress}
          vaultName={`${config.name} Bucket`}
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
        />
      )}
      
      <div 
        className={`p-6 rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer ${config.lightColor} ${className} ${isDragging ? 'scale-105 shadow-2xl' : ''}`}
        onClick={() => {
          if (isDragging) return
          triggerHaptic('light')
          if (onClickProp) {
            onClickProp()
          } else {
            setIsExpanded(!isExpanded)
          }
        }}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${config.color}`}></div>
          <h3 className={`font-semibold text-lg ${config.textColor}`}>
            {config.name}
          </h3>
        </div>
        <div className={`text-sm font-medium ${config.textColor}`}>
          {displayYieldRate}% APY
        </div>
      </div>

      {/* Balance with real-time update animation */}
      <div className="mb-4">
        <div className={`text-3xl font-bold ${config.textColor} transition-all duration-500 ${isBalanceUpdating ? 'scale-105 text-green-600' : ''}`}>
          ${displayBalance}
          {isLoadingBalance && (
            <span className="ml-2 text-sm text-gray-500">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {config.description}
          {blockNumber && (
            <span className="ml-2 text-xs text-gray-400">
              Block: {blockNumber.toString()}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-700 ${config.color}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Expandable Detail View */}
      {isExpanded && (
        <div className="mt-6 pt-4 border-t border-gray-200 animate-in slide-in-from-top-2 duration-300">
          <h4 className={`font-medium mb-3 ${config.textColor}`}>
            Quick Actions
          </h4>
          
          {/* Deposit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              triggerHaptic('medium')
              setShowDepositModal(true)
            }}
            className={`w-full mb-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${config.color} text-white hover:opacity-90`}
          >
            Deposit Funds
          </button>
          
          {/* View Details Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              triggerHaptic('light')
              setShowDetailView(true)
            }}
            className={`w-full mb-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300`}
          >
            View Full Details
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              triggerHaptic('light')
              refetchAll()
            }}
            disabled={isLoading}
            className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                Refreshing...
              </span>
            ) : (
              'Refresh Data'
            )}
          </button>
        </div>
      )}

      {/* Mobile Responsive Indicator */}
      <div className="flex justify-center mt-2">
        <div className={`w-6 h-1 rounded-full transition-transform duration-300 ${config.color} ${isExpanded ? 'rotate-180' : ''}`}>
        </div>
      </div>
      </div>
    </>
  )
}