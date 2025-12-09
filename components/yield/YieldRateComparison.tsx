'use client'

import { useChainId } from 'wagmi'
import { useYieldRateTracking } from '@/lib/hooks'
import { formatUnits } from 'viem'

interface YieldRateComparisonProps {
  showDetails?: boolean
  className?: string
}

/**
 * Component for displaying yield rate comparison across all buckets
 * Shows real-time yield rates and highlights the highest-yielding bucket
 * Automatically updates when yield rates change
 */
export function YieldRateComparison({ 
  showDetails = true,
  className = '' 
}: YieldRateComparisonProps) {
  const chainId = useChainId()
  const { 
    yieldComparison, 
    highest, 
    buckets, 
    isLoading, 
    hasError 
  } = useYieldRateTracking(chainId)

  // Format yield rate from basis points to percentage
  const formatYieldRate = (rate: bigint): string => {
    // Rate is in basis points (1/10000)
    // Convert to percentage: rate / 100
    const percentage = Number(rate) / 100
    return percentage.toFixed(2)
  }

  // Get color for bucket based on yield rate
  const getYieldColor = (rate: bigint): string => {
    const percentage = Number(rate) / 100
    if (percentage >= 8) return 'text-green-600'
    if (percentage >= 5) return 'text-blue-600'
    return 'text-gray-600'
  }

  // Get background color for bucket card
  const getBucketBgColor = (name: string): string => {
    switch (name) {
      case 'Bills':
        return 'bg-yellow-50 border-yellow-200'
      case 'Savings':
        return 'bg-blue-50 border-blue-200'
      case 'Growth':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  if (hasError) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-800 text-sm">
          Unable to load yield rates. Please check your connection.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Highest Yield Bucket Highlight */}
      {highest && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">🏆 Best Yield Destination</p>
              <p className="text-2xl font-bold text-green-700">{highest.name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-600">
                {formatYieldRate(highest.yieldRate)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">APY</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Auto-sweep will move leftover funds here at month-end
          </p>
        </div>
      )}

      {/* Detailed Yield Comparison */}
      {showDetails && buckets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            All Bucket Yields
          </h4>
          {buckets.map((bucket, index) => (
            <div
              key={bucket.address}
              className={`p-3 border rounded-lg transition-all ${getBucketBgColor(bucket.name)} ${
                highest?.address.toLowerCase() === bucket.address.toLowerCase()
                  ? 'ring-2 ring-green-400'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {highest?.address.toLowerCase() === bucket.address.toLowerCase() && (
                    <span className="text-lg">👑</span>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{bucket.name}</p>
                    <p className="text-xs text-gray-500">
                      Rank #{index + 1}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${getYieldColor(bucket.yieldRate)}`}>
                    {formatYieldRate(bucket.yieldRate)}%
                  </p>
                  <p className="text-xs text-gray-500">APY</p>
                </div>
              </div>
              
              {bucket.isLoading && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
                </div>
              )}
              
              {bucket.error && (
                <p className="text-xs text-red-600 mt-2">
                  Error loading yield rate
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Yield Rate Update Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          💡 <strong>Auto-Update:</strong> Yield rates refresh every 30 seconds and with each new block.
          The sweep destination automatically adjusts to the highest yield.
        </p>
      </div>
    </div>
  )
}
