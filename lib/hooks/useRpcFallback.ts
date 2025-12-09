import { useState, useEffect, useCallback } from 'react'
import { retryWithBackoff, rpcRetryOptions } from '@/lib/utils/retry'

/**
 * RPC endpoint configuration with fallback support
 */
interface RpcEndpoint {
  url: string
  priority: number
  isHealthy: boolean
  lastChecked: number
}

const HEALTH_CHECK_INTERVAL = 60000 // 1 minute
const HEALTH_CHECK_TIMEOUT = 5000 // 5 seconds

/**
 * Hook for managing RPC endpoint fallbacks
 * Automatically switches to backup endpoints when primary fails
 */
export function useRpcFallback() {
  const [endpoints, setEndpoints] = useState<RpcEndpoint[]>([
    {
      url: process.env.NEXT_PUBLIC_MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
      priority: 1,
      isHealthy: true,
      lastChecked: Date.now(),
    },
    {
      url: 'https://mantle.publicnode.com',
      priority: 2,
      isHealthy: true,
      lastChecked: Date.now(),
    },
    {
      url: 'https://rpc.ankr.com/mantle',
      priority: 3,
      isHealthy: true,
      lastChecked: Date.now(),
    },
  ])

  const [currentEndpoint, setCurrentEndpoint] = useState<RpcEndpoint>(endpoints[0])

  /**
   * Check health of an RPC endpoint
   */
  const checkEndpointHealth = useCallback(async (endpoint: RpcEndpoint): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      return response.ok
    } catch (error) {
      console.warn(`RPC endpoint ${endpoint.url} health check failed:`, error)
      return false
    }
  }, [])

  /**
   * Update endpoint health status
   */
  const updateEndpointHealth = useCallback(
    (url: string, isHealthy: boolean) => {
      setEndpoints(prev =>
        prev.map(ep =>
          ep.url === url
            ? { ...ep, isHealthy, lastChecked: Date.now() }
            : ep
        )
      )
    },
    []
  )

  /**
   * Get the best available endpoint
   */
  const getBestEndpoint = useCallback((): RpcEndpoint => {
    const healthyEndpoints = endpoints.filter(ep => ep.isHealthy)
    
    if (healthyEndpoints.length === 0) {
      // If all endpoints are unhealthy, return the highest priority one
      console.warn('All RPC endpoints are unhealthy, using highest priority')
      return endpoints.sort((a, b) => a.priority - b.priority)[0]
    }

    // Return the highest priority healthy endpoint
    return healthyEndpoints.sort((a, b) => a.priority - b.priority)[0]
  }, [endpoints])

  /**
   * Switch to next available endpoint
   */
  const switchToFallback = useCallback(() => {
    const current = currentEndpoint
    updateEndpointHealth(current.url, false)

    const nextEndpoint = getBestEndpoint()
    setCurrentEndpoint(nextEndpoint)

    console.log(`Switching RPC endpoint from ${current.url} to ${nextEndpoint.url}`)
  }, [currentEndpoint, getBestEndpoint, updateEndpointHealth])

  /**
   * Execute RPC call with automatic fallback
   */
  const executeWithFallback = useCallback(
    async <T,>(fn: (endpoint: string) => Promise<T>): Promise<T> => {
      return retryWithBackoff(
        async () => {
          try {
            return await fn(currentEndpoint.url)
          } catch (error) {
            // If error is network-related, try fallback
            if (error instanceof Error && error.message.includes('fetch')) {
              switchToFallback()
              throw error // Will be retried with new endpoint
            }
            throw error
          }
        },
        rpcRetryOptions
      )
    },
    [currentEndpoint, switchToFallback]
  )

  /**
   * Periodic health checks
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      for (const endpoint of endpoints) {
        const isHealthy = await checkEndpointHealth(endpoint)
        updateEndpointHealth(endpoint.url, isHealthy)
      }

      // Update current endpoint if it's unhealthy
      if (!currentEndpoint.isHealthy) {
        const best = getBestEndpoint()
        if (best.url !== currentEndpoint.url) {
          setCurrentEndpoint(best)
        }
      }
    }, HEALTH_CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [endpoints, currentEndpoint, checkEndpointHealth, updateEndpointHealth, getBestEndpoint])

  return {
    currentEndpoint: currentEndpoint.url,
    endpoints,
    switchToFallback,
    executeWithFallback,
  }
}
