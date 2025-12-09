import { useReadContract, useBlockNumber } from 'wagmi'
import { sweepKeeperAbi, bucketVaultAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { Address } from 'viem'
import { useEffect, useState } from 'react'

export interface BucketYieldInfo {
  address: Address
  name: string
  yieldRate: bigint
  isLoading: boolean
  error: Error | null
}

export interface YieldComparison {
  highest: BucketYieldInfo | null
  buckets: BucketYieldInfo[]
  isLoading: boolean
  hasError: boolean
}

/**
 * Custom hook for tracking yield rates across all buckets
 * Monitors yield rates in real-time and identifies the highest-yielding bucket
 * Automatically recalculates sweep destination when rates change
 * 
 * @param chainId - Current chain ID
 * @returns Yield rate tracking data and comparison logic
 */
export function useYieldRateTracking(chainId: number | undefined) {
  const [yieldComparison, setYieldComparison] = useState<YieldComparison>({
    highest: null,
    buckets: [],
    isLoading: true,
    hasError: false,
  })

  // Get contract addresses
  const addresses = chainId ? getContractAddresses(chainId) : null
  const sweepKeeperAddress = addresses?.sweepKeeper
  const billsVaultAddress = addresses?.billsVault
  const savingsVaultAddress = addresses?.savingsVault
  const growthVaultAddress = addresses?.growthVault

  // Get current block number for real-time updates
  const { data: blockNumber } = useBlockNumber({ watch: true })

  // Read highest yield bucket from SweepKeeper (optimized calculation)
  const { 
    data: highestYieldData, 
    refetch: refetchHighestYield,
    isLoading: isLoadingHighest,
    error: highestError
  } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'getHighestYieldBucket',
    query: {
      enabled: !!sweepKeeperAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  })

  // Read Bills vault yield rate
  const { 
    data: billsYieldRate, 
    refetch: refetchBillsYield,
    isLoading: isLoadingBills,
    error: billsError
  } = useReadContract({
    address: billsVaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!billsVaultAddress,
      refetchInterval: 30000,
    },
  })

  // Read Savings vault yield rate
  const { 
    data: savingsYieldRate, 
    refetch: refetchSavingsYield,
    isLoading: isLoadingSavings,
    error: savingsError
  } = useReadContract({
    address: savingsVaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!savingsVaultAddress,
      refetchInterval: 30000,
    },
  })

  // Read Growth vault yield rate
  const { 
    data: growthYieldRate, 
    refetch: refetchGrowthYield,
    isLoading: isLoadingGrowth,
    error: growthError
  } = useReadContract({
    address: growthVaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!growthVaultAddress,
      refetchInterval: 30000,
    },
  })

  // Refetch all yield rates when new blocks are mined
  useEffect(() => {
    if (blockNumber) {
      refetchHighestYield()
      refetchBillsYield()
      refetchSavingsYield()
      refetchGrowthYield()
    }
  }, [blockNumber, refetchHighestYield, refetchBillsYield, refetchSavingsYield, refetchGrowthYield])

  // Update yield comparison when data changes
  useEffect(() => {
    if (!addresses) {
      setYieldComparison({
        highest: null,
        buckets: [],
        isLoading: false,
        hasError: true,
      })
      return
    }

    const isLoading = isLoadingHighest || isLoadingBills || isLoadingSavings || isLoadingGrowth
    const hasError = !!highestError || !!billsError || !!savingsError || !!growthError

    // Build bucket info array
    const buckets: BucketYieldInfo[] = [
      {
        address: billsVaultAddress as Address,
        name: 'Bills',
        yieldRate: billsYieldRate || 0n,
        isLoading: isLoadingBills,
        error: billsError,
      },
      {
        address: savingsVaultAddress as Address,
        name: 'Savings',
        yieldRate: savingsYieldRate || 0n,
        isLoading: isLoadingSavings,
        error: savingsError,
      },
      {
        address: growthVaultAddress as Address,
        name: 'Growth',
        yieldRate: growthYieldRate || 0n,
        isLoading: isLoadingGrowth,
        error: growthError,
      },
    ]

    // Sort buckets by yield rate (highest first)
    const sortedBuckets = [...buckets].sort((a, b) => {
      if (a.yieldRate > b.yieldRate) return -1
      if (a.yieldRate < b.yieldRate) return 1
      return 0
    })

    // Determine highest yield bucket
    let highest: BucketYieldInfo | null = null
    
    if (highestYieldData && Array.isArray(highestYieldData) && highestYieldData.length === 2) {
      const [highestAddress, highestRate] = highestYieldData
      const bucketInfo = buckets.find(b => 
        b.address.toLowerCase() === (highestAddress as string).toLowerCase()
      )
      
      if (bucketInfo) {
        highest = {
          ...bucketInfo,
          yieldRate: highestRate as bigint,
        }
      }
    } else if (sortedBuckets.length > 0 && !isLoading) {
      // Fallback to local calculation if SweepKeeper data unavailable
      highest = sortedBuckets[0]
    }

    setYieldComparison({
      highest,
      buckets: sortedBuckets,
      isLoading,
      hasError,
    })
  }, [
    addresses,
    highestYieldData,
    billsYieldRate,
    savingsYieldRate,
    growthYieldRate,
    isLoadingHighest,
    isLoadingBills,
    isLoadingSavings,
    isLoadingGrowth,
    highestError,
    billsError,
    savingsError,
    growthError,
    billsVaultAddress,
    savingsVaultAddress,
    growthVaultAddress,
  ])

  /**
   * Manually refetch all yield rates
   */
  const refetchAll = () => {
    refetchHighestYield()
    refetchBillsYield()
    refetchSavingsYield()
    refetchGrowthYield()
  }

  /**
   * Get yield rate for a specific bucket address
   */
  const getYieldRateForBucket = (bucketAddress: Address): bigint | null => {
    const bucket = yieldComparison.buckets.find(
      b => b.address.toLowerCase() === bucketAddress.toLowerCase()
    )
    return bucket ? bucket.yieldRate : null
  }

  /**
   * Compare two buckets and return the one with higher yield
   */
  const compareYields = (bucket1: Address, bucket2: Address): Address | null => {
    const rate1 = getYieldRateForBucket(bucket1)
    const rate2 = getYieldRateForBucket(bucket2)
    
    if (rate1 === null || rate2 === null) return null
    
    return rate1 > rate2 ? bucket1 : bucket2
  }

  /**
   * Calculate expected yield increase from moving funds
   */
  const calculateYieldIncrease = (
    amount: bigint,
    fromBucket: Address,
    toBucket: Address
  ): bigint => {
    const fromRate = getYieldRateForBucket(fromBucket)
    const toRate = getYieldRateForBucket(toBucket)
    
    if (fromRate === null || toRate === null) return 0n
    
    // Calculate annual yield difference
    // yieldRate is in basis points (1/10000), so we need to scale appropriately
    const fromYield = (amount * fromRate) / 10000n
    const toYield = (amount * toRate) / 10000n
    
    return toYield > fromYield ? toYield - fromYield : 0n
  }

  return {
    // Yield comparison data
    yieldComparison,
    highest: yieldComparison.highest,
    buckets: yieldComparison.buckets,
    
    // Loading and error states
    isLoading: yieldComparison.isLoading,
    hasError: yieldComparison.hasError,
    
    // Utility functions
    refetchAll,
    getYieldRateForBucket,
    compareYields,
    calculateYieldIncrease,
    
    // Block number for external sync
    blockNumber,
  }
}
