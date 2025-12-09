import { useState, useCallback } from 'react'
import { Address } from 'viem'

interface DexStatus {
  isAvailable: boolean
  lastChecked: number
  error?: string
}

/**
 * Hook for handling DEX unavailability with fallback to base asset only
 * Provides graceful degradation when swap functionality is unavailable
 */
export function useDexFallback() {
  const [dexStatus, setDexStatus] = useState<DexStatus>({
    isAvailable: true,
    lastChecked: Date.now(),
  })

  const [baseAssetOnlyMode, setBaseAssetOnlyMode] = useState(false)

  /**
   * Check if DEX is available by attempting a quote
   */
  const checkDexAvailability = useCallback(async (
    vaultAddress: Address,
    tokenAddress: Address,
    amount: bigint
  ): Promise<boolean> => {
    try {
      // This would normally call the vault's quoteDeposit function
      // For now, we'll simulate the check
      // In production, this should actually call the contract
      
      // Simulate network call
      await new Promise(resolve => setTimeout(resolve, 100))
      
      setDexStatus({
        isAvailable: true,
        lastChecked: Date.now(),
      })
      
      return true
    } catch (error) {
      console.error('DEX availability check failed:', error)
      
      setDexStatus({
        isAvailable: false,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      
      return false
    }
  }, [])

  /**
   * Handle DEX error and enable base asset only mode
   */
  const handleDexError = useCallback((error: Error) => {
    console.warn('DEX unavailable, switching to base asset only mode:', error)
    
    setDexStatus({
      isAvailable: false,
      lastChecked: Date.now(),
      error: error.message,
    })
    
    setBaseAssetOnlyMode(true)

    // Log to error tracking
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        context: 'DEXFallback',
      })
    }
  }, [])

  /**
   * Retry DEX connection
   */
  const retryDex = useCallback(() => {
    setDexStatus({
      isAvailable: true,
      lastChecked: Date.now(),
    })
    setBaseAssetOnlyMode(false)
  }, [])

  /**
   * Manually enable base asset only mode
   */
  const enableBaseAssetOnly = useCallback(() => {
    setBaseAssetOnlyMode(true)
  }, [])

  /**
   * Get filtered token list based on DEX availability
   */
  const getAvailableTokens = useCallback(<T extends { isBaseAsset?: boolean }>(
    tokens: T[]
  ): T[] => {
    if (baseAssetOnlyMode || !dexStatus.isAvailable) {
      // Only return base asset tokens
      return tokens.filter(token => token.isBaseAsset)
    }
    return tokens
  }, [baseAssetOnlyMode, dexStatus.isAvailable])

  return {
    dexStatus,
    baseAssetOnlyMode,
    checkDexAvailability,
    handleDexError,
    retryDex,
    enableBaseAssetOnly,
    getAvailableTokens,
  }
}

/**
 * Get user-friendly message for DEX status
 */
export function getDexStatusMessage(
  dexStatus: DexStatus,
  baseAssetOnlyMode: boolean
): string | null {
  if (baseAssetOnlyMode || !dexStatus.isAvailable) {
    return 'Token swapping is currently unavailable. Only base asset deposits are supported.'
  }
  return null
}
