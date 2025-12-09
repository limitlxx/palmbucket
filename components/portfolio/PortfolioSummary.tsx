'use client'

import { useMemo } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { Address, formatEther } from 'viem'
import { bucketVaultAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { useYieldRateTracking } from '@/lib/hooks/useYieldRateTracking'

interface BucketData {
  name: string
  balance: bigint
  yieldRate: bigint
  color: string
}

export function PortfolioSummary() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const addresses = getContractAddresses(chainId)
  const { buckets: yieldBuckets, isLoading: isLoadingYield } = useYieldRateTracking(chainId)

  // Read balances for all buckets
  const { data: billsBalance } = useReadContract({
    address: addresses?.buckets.bills,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addresses },
  })

  const { data: savingsBalance } = useReadContract({
    address: addresses?.buckets.savings,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addresses },
  })

  const { data: growthBalance } = useReadContract({
    address: addresses?.buckets.growth,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addresses },
  })

  const { data: spendableBalance } = useReadContract({
    address: addresses?.buckets.spendable,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addresses },
  })

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const buckets: BucketData[] = [
      {
        name: 'Bills',
        balance: billsBalance || 0n,
        yieldRate: yieldBuckets.find(b => b.name === 'Bills')?.yieldRate || 0n,
        color: 'bg-red-500',
      },
      {
        name: 'Savings',
        balance: savingsBalance || 0n,
        yieldRate: yieldBuckets.find(b => b.name === 'Savings')?.yieldRate || 0n,
        color: 'bg-blue-500',
      },
      {
        name: 'Growth',
        balance: growthBalance || 0n,
        yieldRate: yieldBuckets.find(b => b.name === 'Growth')?.yieldRate || 0n,
        color: 'bg-green-500',
      },
      {
        name: 'Spendable',
        balance: spendableBalance || 0n,
        yieldRate: 0n,
        color: 'bg-purple-500',
      },
    ]

    // Calculate total portfolio value
    const totalValue = buckets.reduce((sum, bucket) => sum + bucket.balance, 0n)

    // Calculate weighted average yield rate
    let weightedYieldSum = 0n
    buckets.forEach(bucket => {
      if (totalValue > 0n) {
        const weight = (bucket.balance * 10000n) / totalValue // Scale by 10000 for precision
        weightedYieldSum += (weight * bucket.yieldRate) / 10000n
      }
    })

    // Calculate expected annual return
    const expectedAnnualReturn = buckets.reduce((sum, bucket) => {
      const rate = Number(bucket.yieldRate) / 10000
      const balance = bucket.balance
      const annualReturn = (balance * BigInt(Math.floor(rate * 10000))) / 10000n
      return sum + annualReturn
    }, 0n)

    // Calculate monthly return
    const expectedMonthlyReturn = expectedAnnualReturn / 12n

    // Calculate bucket percentages
    const bucketPercentages = buckets.map(bucket => ({
      ...bucket,
      percentage: totalValue > 0n ? Number((bucket.balance * 10000n) / totalValue) / 100 : 0,
    }))

    // Find best and worst performing buckets
    const sortedByYield = [...buckets].sort((a, b) => {
      if (a.yieldRate > b.yieldRate) return -1
      if (a.yieldRate < b.yieldRate) return 1
      return 0
    })

    return {
      totalValue,
      weightedYieldRate: weightedYieldSum,
      expectedAnnualReturn,
      expectedMonthlyReturn,
      bucketPercentages,
      bestPerforming: sortedByYield[0],
      worstPerforming: sortedByYield[sortedByYield.length - 1],
    }
  }, [billsBalance, savingsBalance, growthBalance, spendableBalance, yieldBuckets])

  // Calculate month-over-month growth (mock data for now - would need historical data)
  const monthOverMonthGrowth = useMemo(() => {
    // This would ideally come from historical data stored in localStorage or backend
    // For now, we'll calculate based on expected monthly return
    const currentValue = portfolioMetrics.totalValue
    const monthlyReturn = portfolioMetrics.expectedMonthlyReturn
    
    if (currentValue === 0n) return 0
    
    return Number((monthlyReturn * 10000n) / currentValue) / 100
  }, [portfolioMetrics])

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-center text-gray-500">Connect your wallet to view portfolio summary</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total Portfolio Value */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-lg font-medium mb-2 opacity-90">Total Portfolio Value</h2>
        <p className="text-4xl font-bold mb-4">
          ${formatEther(portfolioMetrics.totalValue)}
        </p>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="opacity-75">Avg. APY</p>
            <p className="font-semibold">
              {(Number(portfolioMetrics.weightedYieldRate) / 100).toFixed(2)}%
            </p>
          </div>
          <div className="border-l border-white/30 pl-4">
            <p className="opacity-75">Monthly Growth</p>
            <p className="font-semibold">
              {monthOverMonthGrowth > 0 ? '+' : ''}{monthOverMonthGrowth.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Expected Returns */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Expected Returns</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Monthly</p>
            <p className="text-2xl font-bold text-green-600">
              ${formatEther(portfolioMetrics.expectedMonthlyReturn)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Annually</p>
            <p className="text-2xl font-bold text-green-600">
              ${formatEther(portfolioMetrics.expectedAnnualReturn)}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Based on current balances and yield rates
        </p>
      </div>

      {/* Bucket Allocation */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Bucket Allocation</h3>
        
        {/* Visual Bar */}
        <div className="flex h-8 rounded-lg overflow-hidden mb-4">
          {portfolioMetrics.bucketPercentages.map((bucket, index) => (
            bucket.percentage > 0 && (
              <div
                key={index}
                className={`${bucket.color} transition-all duration-500`}
                style={{ width: `${bucket.percentage}%` }}
                title={`${bucket.name}: ${bucket.percentage.toFixed(1)}%`}
              />
            )
          ))}
        </div>

        {/* Bucket Details */}
        <div className="space-y-3">
          {portfolioMetrics.bucketPercentages.map((bucket, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                <span className="font-medium text-gray-700">{bucket.name}</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800">
                  ${formatEther(bucket.balance)}
                </p>
                <p className="text-xs text-gray-500">
                  {bucket.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Yield Comparison */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Yield Comparison</h3>
        
        <div className="space-y-3">
          {portfolioMetrics.bucketPercentages
            .filter(b => b.yieldRate > 0n)
            .sort((a, b) => Number(b.yieldRate - a.yieldRate))
            .map((bucket, index) => {
              const yieldPercent = Number(bucket.yieldRate) / 100
              const maxYield = Number(portfolioMetrics.bestPerforming.yieldRate) / 100
              const barWidth = maxYield > 0 ? (yieldPercent / maxYield) * 100 : 0
              
              return (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{bucket.name}</span>
                    <span className="text-gray-600">{yieldPercent.toFixed(2)}% APY</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${bucket.color} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>

        {portfolioMetrics.bestPerforming && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-green-700">
                {portfolioMetrics.bestPerforming.name}
              </span>
              {' '}is currently your highest-yielding bucket at{' '}
              <span className="font-semibold">
                {(Number(portfolioMetrics.bestPerforming.yieldRate) / 100).toFixed(2)}% APY
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Performance Indicators */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Performance Indicators</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">ROI (Annual)</p>
            <p className="text-2xl font-bold text-blue-600">
              {(Number(portfolioMetrics.weightedYieldRate) / 100).toFixed(2)}%
            </p>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Monthly Growth</p>
            <p className="text-2xl font-bold text-purple-600">
              {monthOverMonthGrowth > 0 ? '+' : ''}{monthOverMonthGrowth.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            💡 <span className="font-medium">Tip:</span> Your portfolio is earning an average of{' '}
            <span className="font-semibold">
              ${formatEther(portfolioMetrics.expectedMonthlyReturn / 30n)}
            </span>
            {' '}per day in passive yield
          </p>
        </div>
      </div>
    </div>
  )
}
