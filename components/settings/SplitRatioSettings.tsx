'use client'

import { useState, useEffect } from 'react'
import { usePaymentRouter } from '@/lib/hooks'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { useChainId, useAccount } from 'wagmi'
import { parseUnits } from 'viem'

interface RatioPreset {
  name: string
  ratios: [number, number, number, number]
  description: string
}

const RATIO_PRESETS: RatioPreset[] = [
  {
    name: 'Default',
    ratios: [50, 20, 20, 10],
    description: '50% Bills, 20% Savings, 20% Growth, 10% Spendable'
  },
  {
    name: 'Conservative',
    ratios: [40, 30, 20, 10],
    description: '40% Bills, 30% Savings, 20% Growth, 10% Spendable'
  },
  {
    name: 'Aggressive Growth',
    ratios: [30, 20, 40, 10],
    description: '30% Bills, 20% Savings, 40% Growth, 10% Spendable'
  },
  {
    name: 'High Liquidity',
    ratios: [30, 20, 20, 30],
    description: '30% Bills, 20% Savings, 20% Growth, 30% Spendable'
  },
  {
    name: 'Balanced',
    ratios: [25, 25, 25, 25],
    description: '25% each bucket'
  },
]

const BUCKET_NAMES = ['Bills', 'Savings', 'Growth', 'Spendable']
const BUCKET_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B']

/**
 * Split Ratio Settings Component
 * Allows users to configure how incoming payments are split across buckets
 * 
 * **Validates: Requirements 1.5**
 */
export function SplitRatioSettings() {
  const chainId = useChainId()
  const { address } = useAccount()
  const addresses = getContractAddresses(chainId)
  
  const {
    userRatios,
    setSplitRatios,
    routePaymentStatus,
    refetchRatios,
  } = usePaymentRouter(addresses?.paymentRouter)

  const [ratios, setRatios] = useState<[number, number, number, number]>([50, 20, 20, 10])
  const [isDirty, setIsDirty] = useState(false)

  // Load user's current ratios
  useEffect(() => {
    if (userRatios) {
      const currentRatios = userRatios.map(r => Number(r)) as [number, number, number, number]
      setRatios(currentRatios)
    }
  }, [userRatios])

  // Calculate total percentage
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0)
  const isValid = total === 100

  // Handle slider change
  const handleRatioChange = (index: number, value: number) => {
    const newRatios = [...ratios] as [number, number, number, number]
    newRatios[index] = value
    setRatios(newRatios)
    setIsDirty(true)
  }

  // Apply preset
  const applyPreset = (preset: RatioPreset) => {
    setRatios(preset.ratios)
    setIsDirty(true)
  }

  // Save ratios
  const handleSave = async () => {
    if (!isValid) return

    try {
      const bigintRatios = ratios.map(r => BigInt(r)) as [bigint, bigint, bigint, bigint]
      await setSplitRatios(bigintRatios)
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to save ratios:', error)
    }
  }

  // Auto-balance: distribute remaining percentage equally
  const autoBalance = () => {
    const remaining = 100 - total
    if (remaining === 0) return

    const perBucket = Math.floor(remaining / 4)
    const extra = remaining % 4

    const newRatios = ratios.map((r, i) => r + perBucket + (i < extra ? 1 : 0)) as [number, number, number, number]
    setRatios(newRatios)
    setIsDirty(true)
  }

  if (!address) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please connect your wallet to configure split ratios
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Split Ratio Configuration</h2>
        <p className="text-gray-600">
          Configure how your incoming payments are automatically split across your buckets
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Quick Presets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {RATIO_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors text-left"
            >
              <div className="font-semibold mb-1">{preset.name}</div>
              <div className="text-sm text-gray-600">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Ratios */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Custom Ratios</h3>
        
        {ratios.map((ratio, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-medium flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: BUCKET_COLORS[index] }}
                />
                {BUCKET_NAMES[index]}
              </label>
              <span className="text-lg font-bold">{ratio}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ratio}
              onChange={(e) => handleRatioChange(index, parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${BUCKET_COLORS[index]} 0%, ${BUCKET_COLORS[index]} ${ratio}%, #e5e7eb ${ratio}%, #e5e7eb 100%)`
              }}
            />
          </div>
        ))}
      </div>

      {/* Total Indicator */}
      <div className="p-4 rounded-lg border-2" style={{
        borderColor: isValid ? '#10B981' : '#EF4444',
        backgroundColor: isValid ? '#F0FDF4' : '#FEF2F2'
      }}>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total:</span>
          <span className="text-2xl font-bold" style={{
            color: isValid ? '#10B981' : '#EF4444'
          }}>
            {total}%
          </span>
        </div>
        {!isValid && (
          <div className="mt-2 text-sm text-red-600">
            Total must equal 100%. Current: {total}%
            {total < 100 && ` (${100 - total}% remaining)`}
            {total > 100 && ` (${total - 100}% over)`}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={autoBalance}
          disabled={total === 100}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Auto-Balance
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid || !isDirty || routePaymentStatus.status === 'pending'}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {routePaymentStatus.status === 'pending' ? 'Saving...' : 
           routePaymentStatus.status === 'confirming' ? 'Confirming...' :
           'Save Ratios'}
        </button>
      </div>

      {/* Status Messages */}
      {routePaymentStatus.status === 'success' && (
        <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg text-green-700">
          ✓ Split ratios saved successfully!
        </div>
      )}
      {routePaymentStatus.status === 'error' && (
        <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-700">
          ✗ Failed to save ratios. Please try again.
        </div>
      )}
    </div>
  )
}
