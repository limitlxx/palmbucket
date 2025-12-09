import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlockNumber } from 'wagmi'
import { bucketVaultAbi } from '@/lib/contracts/abis'
import { Address } from 'viem'
import { useEffect } from 'react'

/**
 * Custom hook for interacting with BucketVault contracts (ERC-4626)
 * Provides functions for deposits, withdrawals, and reading vault data with real-time updates
 */
export function useBucketVault(vaultAddress: Address) {
  const { address } = useAccount()
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  
  // Get current block number for real-time updates
  const { data: blockNumber } = useBlockNumber({ watch: true })

  // Read user's share balance with real-time updates
  const { 
    data: shareBalance, 
    refetch: refetchBalance, 
    isLoading: isLoadingBalance,
    error: balanceError 
  } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!vaultAddress,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })

  // Read total assets in vault with real-time updates
  const { 
    data: totalAssets, 
    refetch: refetchTotalAssets,
    isLoading: isLoadingTotalAssets,
    error: totalAssetsError
  } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'totalAssets',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 15000, // Refetch every 15 seconds
    },
  })

  // Read current yield rate with real-time updates
  const { 
    data: yieldRate, 
    refetch: refetchYieldRate,
    isLoading: isLoadingYieldRate,
    error: yieldRateError
  } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 30000, // Refetch every 30 seconds (yield rates change less frequently)
    },
  })

  // Refetch data when new blocks are mined for real-time updates
  useEffect(() => {
    if (blockNumber) {
      refetchBalance()
      refetchTotalAssets()
      refetchYieldRate()
    }
  }, [blockNumber, refetchBalance, refetchTotalAssets, refetchYieldRate])

  // Deposit assets
  const deposit = (assets: bigint, receiver: Address) => {
    return writeContract({
      address: vaultAddress,
      abi: bucketVaultAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    })
  }

  // Redeem shares
  const redeem = (shares: bigint, receiver: Address, owner: Address) => {
    return writeContract({
      address: vaultAddress,
      abi: bucketVaultAbi,
      functionName: 'redeem',
      args: [shares, receiver, owner],
    })
  }

  // Compound yield
  const compoundYield = () => {
    return writeContract({
      address: vaultAddress,
      abi: bucketVaultAbi,
      functionName: 'compoundYield',
    })
  }

  // Aggregate loading states
  const isLoading = isLoadingBalance || isLoadingTotalAssets || isLoadingYieldRate
  const hasError = balanceError || totalAssetsError || yieldRateError || writeError

  return {
    // Data
    shareBalance,
    totalAssets,
    yieldRate,
    blockNumber,
    
    // Loading states
    isLoading,
    isLoadingBalance,
    isLoadingTotalAssets,
    isLoadingYieldRate,
    
    // Error states
    hasError,
    balanceError,
    totalAssetsError,
    yieldRateError,
    
    // Refetch functions
    refetchBalance,
    refetchTotalAssets,
    refetchYieldRate,
    refetchAll: () => {
      refetchBalance()
      refetchTotalAssets()
      refetchYieldRate()
    },
    
    // Write functions
    deposit,
    redeem,
    compoundYield,
    
    // Transaction states
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
