import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from 'wagmi'
import { paymentRouterAbi } from '@/lib/contracts/abis'
import { Address } from 'viem'
import { useEffect, useState, useCallback } from 'react'

export interface RoutePaymentStatus {
  status: 'idle' | 'preparing' | 'pending' | 'confirming' | 'success' | 'error'
  error?: Error
  hash?: Address
}

/**
 * Custom hook for interacting with the PaymentRouter contract
 * Provides functions to set split ratios, route payments, and read user buckets
 * 
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */
export function usePaymentRouter(contractAddress: Address) {
  const { address } = useAccount()
  const { writeContract, data: hash, error: writeError, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isConfirmError } = useWaitForTransactionReceipt({ hash })
  
  const [routePaymentStatus, setRoutePaymentStatus] = useState<RoutePaymentStatus>({ status: 'idle' })

  // Read user's bucket addresses
  const { data: userBuckets, refetch: refetchBuckets } = useReadContract({
    address: contractAddress,
    abi: paymentRouterAbi,
    functionName: 'getUserBuckets',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Read user's split ratios
  const { data: userRatios, refetch: refetchRatios } = useReadContract({
    address: contractAddress,
    abi: paymentRouterAbi,
    functionName: 'getUserRatios',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Check if user is initialized
  const { data: isInitialized, refetch: refetchInitialized } = useReadContract({
    address: contractAddress,
    abi: paymentRouterAbi,
    functionName: 'isUserInitialized',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Check if auto-split is enabled for a token
  const checkAutoSplitEnabled = useCallback((token: Address) => {
    if (!address) return false
    
    return useReadContract({
      address: contractAddress,
      abi: paymentRouterAbi,
      functionName: 'isAutoSplitEnabled',
      args: [address, token],
    })
  }, [address, contractAddress])

  // Update status based on transaction state
  useEffect(() => {
    if (isPending) {
      setRoutePaymentStatus({ status: 'pending' })
    } else if (isConfirming) {
      setRoutePaymentStatus({ status: 'confirming', hash: hash as Address })
    } else if (isConfirmed) {
      setRoutePaymentStatus({ status: 'success', hash: hash as Address })
    } else if (writeError || isConfirmError) {
      setRoutePaymentStatus({ 
        status: 'error', 
        error: writeError || new Error('Transaction confirmation failed'),
        hash: hash as Address
      })
    }
  }, [isPending, isConfirming, isConfirmed, writeError, isConfirmError, hash])

  // Set split ratios
  const setSplitRatios = useCallback(async (ratios: [bigint, bigint, bigint, bigint]) => {
    try {
      setRoutePaymentStatus({ status: 'preparing' })
      
      await writeContract({
        address: contractAddress,
        abi: paymentRouterAbi,
        functionName: 'setSplitRatios',
        args: [ratios],
      })
    } catch (error) {
      setRoutePaymentStatus({ 
        status: 'error', 
        error: error as Error 
      })
      throw error
    }
  }, [contractAddress, writeContract])

  // Route payment with preparation and error handling
  const routePayment = useCallback(async (token: Address, amount: bigint) => {
    try {
      setRoutePaymentStatus({ status: 'preparing' })
      
      await writeContract({
        address: contractAddress,
        abi: paymentRouterAbi,
        functionName: 'routePayment',
        args: [token, amount],
      })
    } catch (error) {
      setRoutePaymentStatus({ 
        status: 'error', 
        error: error as Error 
      })
      throw error
    }
  }, [contractAddress, writeContract])

  // Reset status
  const resetStatus = useCallback(() => {
    setRoutePaymentStatus({ status: 'idle' })
    reset()
  }, [reset])

  return {
    // Data
    userBuckets,
    userRatios,
    isInitialized,
    
    // Actions
    setSplitRatios,
    routePayment,
    checkAutoSplitEnabled,
    resetStatus,
    
    // Refetch functions
    refetchBuckets,
    refetchRatios,
    refetchInitialized,
    
    // Status
    routePaymentStatus,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
