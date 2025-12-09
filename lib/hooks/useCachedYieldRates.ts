import { useState, useEffect, useCallback } from 'react'
import { Address } from 'viem'
import { useReadContract } from 'wagmi'
import { bucketVaultAbi } from '@/lib/contracts/abis'

interface YieldRateCache {
  rate: bigint
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const STALE_CACHE_DURATION = 30 * 60 * 1000 // 30 minutes - use stale data if fresh fetch fails

/**
 * Hook for yield rates with caching and fallback to stale data
 * Provides graceful degradation when RPC calls fail
 */
export function useCachedYieldRate(vaultAddress: Address | undefined) {
  const [cache, setCache] = useState<YieldRateCache | null>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined' && vaultAddress) {
      const stored = localStorage.getItem(`yield_rate_${vaultAddress}`)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          return null
        }
      }
    }
    return null
  })

  const [isUsingCache, setIsUsingCache] = useState(false)

  // Fetch current yield rate
  const {
    data: currentRate,
    isError,
    isLoading,
    refetch,
  } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!vaultAddress,
      staleTime: CACHE_DURATION,
      retry: 2,
    },
  })

  /**
   * Update cache with new rate
   */
  const updateCache = useCallback(
    (rate: bigint) => {
      const newCache: YieldRateCache = {
        rate,
        timestamp: Date.now(),
      }
      setCache(newCache)
      setIsUsingCache(false)

      // Persist to localStorage
      if (typeof window !== 'undefined' && vaultAddress) {
        localStorage.setItem(`yield_rate_${vaultAddress}`, JSON.stringify(newCache))
      }
    },
    [vaultAddress]
  )

  /**
   * Check if cache is fresh
   */
  const isCacheFresh = useCallback((cache: YieldRateCache | null): boolean => {
    if (!cache) return false
    return Date.now() - cache.timestamp < CACHE_DURATION
  }, [])

  /**
   * Check if cache is stale but usable
   */
  const isCacheStale = useCallback((cache: YieldRateCache | null): boolean => {
    if (!cache) return false
    const age = Date.now() - cache.timestamp
    return age >= CACHE_DURATION && age < STALE_CACHE_DURATION
  }, [])

  /**
   * Get yield rate with fallback logic
   */
  const getYieldRate = useCallback((): bigint | undefined => {
    // Use fresh data if available
    if (currentRate !== undefined && !isError) {
      return currentRate as bigint
    }

    // If loading, use fresh cache if available
    if (isLoading && cache && isCacheFresh(cache)) {
      setIsUsingCache(true)
      return cache.rate
    }

    // If error, use stale cache as fallback
    if (isError && cache && isCacheStale(cache)) {
      console.warn(`Using stale yield rate cache for ${vaultAddress} (age: ${Date.now() - cache.timestamp}ms)`)
      setIsUsingCache(true)
      return cache.rate
    }

    // No data available
    return undefined
  }, [currentRate, isError, isLoading, cache, vaultAddress, isCacheFresh, isCacheStale])

  /**
   * Update cache when new data arrives
   */
  useEffect(() => {
    if (currentRate !== undefined && !isError) {
      updateCache(currentRate as bigint)
    }
  }, [currentRate, isError, updateCache])

  /**
   * Retry fetching if using stale cache
   */
  useEffect(() => {
    if (isUsingCache && cache && isCacheStale(cache)) {
      // Try to refresh in background
      const timer = setTimeout(() => {
        refetch()
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [isUsingCache, cache, isCacheStale, refetch])

  return {
    yieldRate: getYieldRate(),
    isLoading: isLoading && !cache,
    isError: isError && !cache,
    isUsingCache,
    cacheAge: cache ? Date.now() - cache.timestamp : null,
    refetch,
  }
}

/**
 * Hook for multiple vault yield rates with caching
 */
export function useCachedYieldRates(vaultAddresses: Address[]) {
  const rates = vaultAddresses.map(address => useCachedYieldRate(address))

  return {
    rates: rates.map(r => r.yieldRate),
    isLoading: rates.some(r => r.isLoading),
    isError: rates.every(r => r.isError),
    isUsingCache: rates.some(r => r.isUsingCache),
    refetchAll: () => rates.forEach(r => r.refetch()),
  }
}
