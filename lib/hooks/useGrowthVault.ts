import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlockNumber } from 'wagmi'
import { Address } from 'viem'
import { useEffect } from 'react'

/**
 * ABI for GrowthVault with mETH integration
 */
const growthVaultAbi = [
  // ERC-4626 standard functions
  {
    inputs: [
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'address', name: 'receiver', type: 'address' }
    ],
    name: 'deposit',
    outputs: [{ internalType: 'uint256', name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'address', name: 'owner', type: 'address' }
    ],
    name: 'redeem',
    outputs: [{ internalType: 'uint256', name: 'assets', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalAssets',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getYieldRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'compoundYield',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  // mETH specific functions
  {
    inputs: [],
    name: 'getMethBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getMethExchangeRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

/**
 * Custom hook for interacting with GrowthVault (mETH integration)
 * Provides functions for ETH/USDC → mETH deposits, mETH → original token withdrawals, and yield tracking
 * 
 * @param vaultAddress - Address of the GrowthVault contract
 * @returns Hook interface with deposit/withdrawal functions and mETH-specific data
 */
export function useGrowthVault(vaultAddress: Address) {
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
    abi: growthVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!vaultAddress,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })

  // Read total assets in vault (includes mETH value)
  const { 
    data: totalAssets, 
    refetch: refetchTotalAssets,
    isLoading: isLoadingTotalAssets,
    error: totalAssetsError
  } = useReadContract({
    address: vaultAddress,
    abi: growthVaultAbi,
    functionName: 'totalAssets',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 15000, // Refetch every 15 seconds
    },
  })

  // Read current yield rate (4-6% APY from mETH staking)
  const { 
    data: yieldRate, 
    refetch: refetchYieldRate,
    isLoading: isLoadingYieldRate,
    error: yieldRateError
  } = useReadContract({
    address: vaultAddress,
    abi: growthVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  })

  // Read mETH balance (mETH-specific)
  const { 
    data: methBalance, 
    refetch: refetchMethBalance,
    isLoading: isLoadingMethBalance,
    error: methBalanceError
  } = useReadContract({
    address: vaultAddress,
    abi: growthVaultAbi,
    functionName: 'getMethBalance',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 15000,
    },
  })

  // Read mETH/ETH exchange rate (mETH-specific)
  const { 
    data: methExchangeRate, 
    refetch: refetchMethExchangeRate,
    isLoading: isLoadingMethExchangeRate,
    error: methExchangeRateError
  } = useReadContract({
    address: vaultAddress,
    abi: growthVaultAbi,
    functionName: 'getMethExchangeRate',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 30000,
    },
  })

  // Refetch data when new blocks are mined for real-time updates
  useEffect(() => {
    if (blockNumber) {
      refetchBalance()
      refetchTotalAssets()
      refetchYieldRate()
      refetchMethBalance()
      refetchMethExchangeRate()
    }
  }, [blockNumber, refetchBalance, refetchTotalAssets, refetchYieldRate, refetchMethBalance, refetchMethExchangeRate])

  /**
   * Deposit assets to GrowthVault (automatically converts to mETH)
   * Handles both ETH and USDC deposits with automatic conversion
   * @param assets - Amount of base asset to deposit
   * @param receiver - Address to receive vault shares
   */
  const depositToMeth = (assets: bigint, receiver: Address) => {
    return writeContract({
      address: vaultAddress,
      abi: growthVaultAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    })
  }

  /**
   * Withdraw from GrowthVault (automatically converts mETH back to original token)
   * @param shares - Amount of vault shares to redeem
   * @param receiver - Address to receive assets
   * @param owner - Owner of the shares
   */
  const withdrawFromMeth = (shares: bigint, receiver: Address, owner: Address) => {
    return writeContract({
      address: vaultAddress,
      abi: growthVaultAbi,
      functionName: 'redeem',
      args: [shares, receiver, owner],
    })
  }

  /**
   * Compound accumulated yield back into the vault
   */
  const compoundYield = () => {
    return writeContract({
      address: vaultAddress,
      abi: growthVaultAbi,
      functionName: 'compoundYield',
    })
  }

  // Aggregate loading states
  const isLoading = isLoadingBalance || isLoadingTotalAssets || isLoadingYieldRate || 
                    isLoadingMethBalance || isLoadingMethExchangeRate
  const hasError = balanceError || totalAssetsError || yieldRateError || 
                   methBalanceError || methExchangeRateError || writeError

  return {
    // Standard vault data
    shareBalance,
    totalAssets,
    yieldRate,
    blockNumber,
    
    // mETH specific data
    methBalance,
    methExchangeRate,
    
    // Loading states
    isLoading,
    isLoadingBalance,
    isLoadingTotalAssets,
    isLoadingYieldRate,
    isLoadingMethBalance,
    isLoadingMethExchangeRate,
    
    // Error states
    hasError,
    balanceError,
    totalAssetsError,
    yieldRateError,
    methBalanceError,
    methExchangeRateError,
    
    // Refetch functions
    refetchBalance,
    refetchTotalAssets,
    refetchYieldRate,
    refetchMethBalance,
    refetchMethExchangeRate,
    refetchAll: () => {
      refetchBalance()
      refetchTotalAssets()
      refetchYieldRate()
      refetchMethBalance()
      refetchMethExchangeRate()
    },
    
    // Write functions (asset ↔ mETH conversion)
    depositToMeth,
    withdrawFromMeth,
    compoundYield,
    
    // Transaction states
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
