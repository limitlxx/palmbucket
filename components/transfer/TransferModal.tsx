'use client'

import { useState, useEffect, useCallback } from 'react'
import { BucketType } from '@/types'
import { formatEther, parseEther } from 'viem'
import { useAccount } from 'wagmi'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  sourceBucket: BucketType | null
  destinationBucket: BucketType | null
  sourceBalance: bigint
  onTransfer: (amount: bigint) => void
  isTransferring: boolean
  transferComplete?: boolean
  statusMessage?: string
  conversionInfo?: {
    expectedAssets: bigint
    conversionFee: bigint
    slippage: string
    netAmount: bigint
  }
  estimatedFees?: {
    conversionFee: string
    slippage: string
  }
}

const bucketConfig = {
  bills: {
    name: 'Bills',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
  },
  savings: {
    name: 'Savings',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
  },
  growth: {
    name: 'Growth',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    borderColor: 'border-green-500',
  },
  spendable: {
    name: 'Spendable',
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-500',
  },
}

export function TransferModal({
  isOpen,
  onClose,
  sourceBucket,
  destinationBucket,
  sourceBalance,
  onTransfer,
  isTransferring,
  transferComplete,
  statusMessage,
  conversionInfo,
  estimatedFees,
}: TransferModalProps) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [showSwipeFeedback, setShowSwipeFeedback] = useState(false)
  const [showNotification, setShowNotification] = useState(false)

  // Show success notification when transfer completes
  useEffect(() => {
    if (transferComplete) {
      setShowNotification(true)
      setTimeout(() => {
        setShowNotification(false)
        onClose()
      }, 3000)
    }
  }, [transferComplete, onClose])

  // Listen for gesture events
  useEffect(() => {
    if (!isOpen) return

    const handleGesture = (event: Event) => {
      const customEvent = event as CustomEvent
      const { gestureType } = customEvent.detail

      if (gestureType === 'swipe_right') {
        // Confirm transfer
        setSwipeDirection('right')
        setShowSwipeFeedback(true)
        setTimeout(() => {
          handleConfirm()
          setShowSwipeFeedback(false)
        }, 500)
      } else if (gestureType === 'swipe_left') {
        // Cancel transfer
        setSwipeDirection('left')
        setShowSwipeFeedback(true)
        setTimeout(() => {
          handleCancel()
          setShowSwipeFeedback(false)
        }, 500)
      }
    }

    document.addEventListener('gesture', handleGesture)
    return () => document.removeEventListener('gesture', handleGesture)
  }, [isOpen, amount])

  const handleConfirm = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }
    
    try {
      const amountBigInt = parseEther(amount)
      if (amountBigInt > sourceBalance) {
        alert('Insufficient balance')
        return
      }
      
      // Check minimum balance requirement
      const minBalance = parseEther('0.01')
      if (sourceBalance - amountBigInt < minBalance && sourceBalance - amountBigInt > 0n) {
        alert('Transfer would leave less than minimum balance. Transfer all or leave at least $0.01')
        return
      }
      
      onTransfer(amountBigInt)
    } catch (error) {
      console.error('Invalid amount:', error)
      alert('Invalid amount')
    }
  }, [amount, sourceBalance, onTransfer])

  const handleCancel = useCallback(() => {
    setAmount('')
    onClose()
  }, [onClose])

  const handleMaxClick = () => {
    setAmount(formatEther(sourceBalance))
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  if (!isOpen || !sourceBucket || !destinationBucket) return null

  const sourceConfig = bucketConfig[sourceBucket]
  const destConfig = bucketConfig[destinationBucket]
  const balanceDisplay = formatEther(sourceBalance)
  const amountNum = parseFloat(amount || '0')
  const balanceNum = parseFloat(balanceDisplay)
  const isValidAmount = amountNum > 0 && amountNum <= balanceNum

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200 relative">
        {/* Success Notification */}
        {showNotification && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-green-500/95 animate-in fade-in zoom-in-95 duration-300 z-10">
            <div className="text-center text-white p-6">
              <div className="text-6xl mb-4">✓</div>
              <div className="text-2xl font-bold mb-2">Transfer Complete!</div>
              <div className="text-sm opacity-90">
                Funds successfully moved to {destConfig.name}
              </div>
            </div>
          </div>
        )}

        {/* Swipe Feedback Overlay */}
        {showSwipeFeedback && (
          <div className={`absolute inset-0 rounded-2xl flex items-center justify-center ${
            swipeDirection === 'right' 
              ? 'bg-green-500/90' 
              : 'bg-red-500/90'
          } animate-in fade-in zoom-in-95 duration-300 z-10`}>
            <div className="text-white text-6xl">
              {swipeDirection === 'right' ? '✓' : '✗'}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Transfer Funds
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isTransferring}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Source and Destination Display */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">From</div>
              <div className={`flex items-center gap-2 p-3 rounded-lg border-2 ${sourceConfig.borderColor} bg-gray-50`}>
                <div className={`w-3 h-3 rounded-full ${sourceConfig.color}`}></div>
                <span className={`font-semibold ${sourceConfig.textColor}`}>
                  {sourceConfig.name}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Balance: ${balanceDisplay}
              </div>
            </div>

            <div className="px-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>

            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">To</div>
              <div className={`flex items-center gap-2 p-3 rounded-lg border-2 ${destConfig.borderColor} bg-gray-50`}>
                <div className={`w-3 h-3 rounded-full ${destConfig.color}`}></div>
                <span className={`font-semibold ${destConfig.textColor}`}>
                  {destConfig.name}
                </span>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transfer Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-lg">$</span>
              </div>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="w-full pl-8 pr-20 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={isTransferring}
              />
              <button
                onClick={handleMaxClick}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm"
                disabled={isTransferring}
              >
                MAX
              </button>
            </div>
            {!isValidAmount && amount && (
              <p className="mt-1 text-sm text-red-600">
                {amountNum > balanceNum ? 'Insufficient balance' : 'Enter a valid amount'}
              </p>
            )}
          </div>

          {/* Conversion Info (if available) */}
          {conversionInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-800 mb-2">
                Conversion Details
              </div>
              <div className="space-y-1 text-sm text-blue-700">
                <div className="flex justify-between">
                  <span>Expected Assets:</span>
                  <span>${formatEther(conversionInfo.expectedAssets)}</span>
                </div>
                {conversionInfo.conversionFee > 0n && (
                  <div className="flex justify-between">
                    <span>Conversion Fee:</span>
                    <span>-${formatEther(conversionInfo.conversionFee)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Slippage:</span>
                  <span>{conversionInfo.slippage}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-blue-300 pt-1 mt-1">
                  <span>Net Amount:</span>
                  <span>${formatEther(conversionInfo.netAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Estimated Fees (if applicable and no conversion info yet) */}
          {estimatedFees && !conversionInfo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm font-medium text-yellow-800 mb-2">
                Estimated Fees
              </div>
              <div className="space-y-1 text-sm text-yellow-700">
                <div className="flex justify-between">
                  <span>Conversion Fee:</span>
                  <span>{estimatedFees.conversionFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>Slippage:</span>
                  <span>{estimatedFees.slippage}</span>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Status */}
          {isTransferring && statusMessage && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="text-sm font-medium text-gray-700">
                  {statusMessage}
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal Restrictions Warning */}
          {sourceBucket === 'bills' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm font-medium text-orange-800 mb-2">
                ⚠️ Withdrawal Restriction
              </div>
              <div className="text-sm text-orange-700">
                Bills vault has a 7-day withdrawal delay and 2% fee. Ensure your last deposit was more than 7 days ago.
              </div>
            </div>
          )}

          {/* Gesture Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-800 mb-2">
              💡 Gesture Controls
            </div>
            <div className="space-y-1 text-sm text-blue-700">
              <div>👉 Swipe right to confirm transfer</div>
              <div>👈 Swipe left to cancel</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isTransferring}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValidAmount || isTransferring}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isTransferring ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Transferring...
              </>
            ) : (
              'Confirm Transfer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
