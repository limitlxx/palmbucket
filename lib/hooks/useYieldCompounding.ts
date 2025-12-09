import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi'
import { Address } from 'viem'
import { useState, useCallback, useEffect } from 'react'

/**
 * ABI for compounding functionality
 */
const compoundingAbi = [
  {
    inputs: [],
    name: 'compoundYield',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' }
    ],
    name: 'YieldCompounded',
    type: 'event'
  }
] as const

/**
 * Interface for compounding history entry
 */
export interface CompoundingEvent {
  amount: bigint
  timestamp: bigint
  txHash: string
  vaultAddress: Address
}

/**
 * Custom hook for yield compounding across vaults
 * Provides automated compounding trigger, history tracking, and event monitoring
 * 
 * @param vaultAddresses - Array of vault addresses to monitor for compounding
 * @returns Hook interface with compounding functions and history
 */
export function useYieldCompounding(vaultAddresses: Address[]) {
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  
  // Track compounding history
  const [compoundingHistory, setCompoundingHistory] = useState<CompoundingEvent[]>([])
  const [lastCompoundedVault, setLastCompoundedVault] = useState<Address | null>(null)

  /**
   * Compound yield for a specific vault
   * @param vaultAddress - Address of the vault to compound
   */
  const compoundVault = useCallback((vaultAddress: Address) => {
    setLastCompoundedVault(vaultAddress)
    return writeContract({
      address: vaultAddress,
      abi: compoundingAbi,
      functionName: 'compoundYield',
    })
  }, [writeContract])

  /**
   * Compound yield for all vaults sequentially
   * Note: This will trigger multiple transactions that need individual approval
   */
  const compoundAllVaults = useCallback(async () => {
    for (const vaultAddress of vaultAddresses) {
      try {
        await compoundVault(vaultAddress)
        // Wait a bit between transactions to avoid nonce issues
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        console.error(`Failed to compound vault ${vaultAddress}:`, error)
        // Continue with next vault even if one fails
      }
    }
  }, [vaultAddresses, compoundVault])

  /**
   * Watch for YieldCompounded events across all vaults
   * This allows us to track compounding history in real-time
   */
  vaultAddresses.forEach(vaultAddress => {
    useWatchContractEvent({
      address: vaultAddress,
      abi: compoundingAbi,
      eventName: 'YieldCompounded',
      onLogs(logs) {
        logs.forEach(log => {
          const event: CompoundingEvent = {
            amount: log.args.amount || 0n,
            timestamp: log.args.timestamp || 0n,
            txHash: log.transactionHash || '',
            vaultAddress: vaultAddress,
          }
          
          setCompoundingHistory(prev => {
            // Avoid duplicates
            const exists = prev.some(e => e.txHash === event.txHash)
            if (exists) return prev
            
            // Add new event and sort by timestamp (newest first)
            return [event, ...prev].sort((a, b) => 
              Number(b.timestamp) - Number(a.timestamp)
            )
          })
        })
      },
    })
  })

  // Load compounding history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('palmbudget_compounding_history')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Convert string bigints back to BigInt
        const history = parsed.map((e: any) => ({
          ...e,
          amount: BigInt(e.amount),
          timestamp: BigInt(e.timestamp),
        }))
        setCompoundingHistory(history)
      } catch (error) {
        console.error('Failed to load compounding history:', error)
      }
    }
  }, [])

  // Save compounding history to localStorage when it changes
  useEffect(() => {
    if (compoundingHistory.length > 0) {
      // Convert BigInt to string for JSON serialization
      const serializable = compoundingHistory.map(e => ({
        ...e,
        amount: e.amount.toString(),
        timestamp: e.timestamp.toString(),
      }))
      localStorage.setItem('palmbudget_compounding_history', JSON.stringify(serializable))
    }
  }, [compoundingHistory])

  /**
   * Get compounding history for a specific vault
   */
  const getVaultHistory = useCallback((vaultAddress: Address) => {
    return compoundingHistory.filter(e => 
      e.vaultAddress.toLowerCase() === vaultAddress.toLowerCase()
    )
  }, [compoundingHistory])

  /**
   * Get total compounded amount across all vaults
   */
  const getTotalCompounded = useCallback(() => {
    return compoundingHistory.reduce((sum, event) => sum + event.amount, 0n)
  }, [compoundingHistory])

  /**
   * Get total compounded amount for a specific vault
   */
  const getVaultTotalCompounded = useCallback((vaultAddress: Address) => {
    return getVaultHistory(vaultAddress).reduce((sum, event) => sum + event.amount, 0n)
  }, [getVaultHistory])

  /**
   * Get last compounding timestamp for a vault
   */
  const getLastCompoundingTime = useCallback((vaultAddress: Address) => {
    const history = getVaultHistory(vaultAddress)
    return history.length > 0 ? history[0].timestamp : 0n
  }, [getVaultHistory])

  /**
   * Clear compounding history (useful for testing or reset)
   */
  const clearHistory = useCallback(() => {
    setCompoundingHistory([])
    localStorage.removeItem('palmbudget_compounding_history')
  }, [])

  return {
    // Compounding functions
    compoundVault,
    compoundAllVaults,
    
    // History data
    compoundingHistory,
    getVaultHistory,
    getTotalCompounded,
    getVaultTotalCompounded,
    getLastCompoundingTime,
    clearHistory,
    
    // Transaction states
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
    lastCompoundedVault,
  }
}

/**
 * Helper hook for a single vault's compounding
 * Simplified interface when you only need to work with one vault
 */
export function useVaultCompounding(vaultAddress: Address) {
  const {
    compoundVault,
    getVaultHistory,
    getVaultTotalCompounded,
    getLastCompoundingTime,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  } = useYieldCompounding([vaultAddress])

  return {
    compound: () => compoundVault(vaultAddress),
    history: getVaultHistory(vaultAddress),
    totalCompounded: getVaultTotalCompounded(vaultAddress),
    lastCompoundingTime: getLastCompoundingTime(vaultAddress),
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  }
}
