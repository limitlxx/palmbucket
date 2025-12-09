import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlockNumber } from 'wagmi'
import { Address } from 'viem'
import { useEffect } from 'react'

/**
 * ABI for SavingsVault with Ondo USDY integration
 */
const savingsVaultAbi = [
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
  // Ondo USDY specific functions
  {
    inputs: [],
    name: 'getUSDYBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getRedemptionPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

/**
 * Custom hook for interacting with SavingsVault (Ondo USDY integration)
 * Provides functions for USDC → USDY deposits, USDY → USDC withdrawals, and yield tracking
 * 
 * @param vaultAddress - Address of the SavingsVault contract
 * @returns Hook interface with deposit/withdrawal functions and USDY-specific data
 */
export function useSavingsVault(vaultAddress: Address) {
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
    abi: savingsVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!vaultAddress,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })

  // Read total assets in vault (includes USDY value)
  const { 
    data: totalAssets, 
    refetch: refetchTotalAssets,
    isLoading: isLoadingTotalAssets,
    error: totalAssetsError
  } = useReadContract({
    address: vaultAddress,
    abi: savingsVaultAbi,
    functionName: 'totalAssets',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 15000, // Refetch every 15 seconds
    },
  })

  // Read current yield rate (8-12% APY from Ondo USDY)
  const { 
    data: yieldRate, 
    refetch: refetchYieldRate,
    isLoading: isLoadingYieldRate,
    error: yieldRateError
  } = useReadContract({
    address: vaultAddress,
    abi: savingsVaultAbi,
    functionName: 'getYieldRate',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  })

  // Read USDY balance (Ondo-specific)
  const { 
    data: usdyBalance, 
    refetch: refetchUSDYBalance,
    isLoading: isLoadingUSDYBalance,
    error: usdyBalanceError
  } = useReadContract({
    address: vaultAddress,
    abi: savingsVaultAbi,
    functionName: 'getUSDYBalance',
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 15000,
    },
  })

  // Read USDY redemption price (Ondo-specific)
  const { 
    data: redemptionPrice, 
    refetch: refetchRedemptionPrice,
    isLoading: isLoadingRedemptionPrice,
    error: redemptionPriceError
  } = useReadContract({
    address: vaultAddress,
    abi: savingsVaultAbi,
    functionName: 'getRedemptionPrice',
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
      refetchUSDYBalance()
      refetchRedemptionPrice()
    }
  }, [blockNumber, refetchBalance, refetchTotalAssets, refetchYieldRate, refetchUSDYBalance, refetchRedemptionPrice])

  /**
   * Deposit USDC to SavingsVault (automatically converts to USDY)
   * @param assets - Amount of USDC to deposit
   * @param receiver - Address to receive vault shares
   */
  const depositUSDC = (assets: bigint, receiver: Address) => {
    return writeContract({
      address: vaultAddress,
      abi: savingsVaultAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    })
  }

  /**
   * Withdraw from SavingsVault (automatically converts USDY back to USDC)
   * @param shares - Amount of vault shares to redeem
   * @param receiver - Address to receive USDC
   * @param owner - Owner of the shares
   */
  const withdrawUSDC = (shares: bigint, receiver: Address, owner: Address) => {
    return writeContract({
      address: vaultAddress,
      abi: savingsVaultAbi,
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
      abi: savingsVaultAbi,
      functionName: 'compoundYield',
    })
  }

  // Aggregate loading states
  const isLoading = isLoadingBalance || isLoadingTotalAssets || isLoadingYieldRate || 
                    isLoadingUSDYBalance || isLoadingRedemptionPrice
  const hasError = balanceError || totalAssetsError || yieldRateError || 
                   usdyBalanceError || redemptionPriceError || writeError

  return {
    // Standard vault data
    shareBalance,
    totalAssets,
    yieldRate,
    blockNumber,
    
    // Ondo USDY specific data
    usdyBalance,
    redemptionPrice,
    
    // Loading states
    isLoading,
    isLoadingBalance,
    isLoadingTotalAssets,
    isLoadingYieldRate,
    isLoadingUSDYBalance,
    isLoadingRedemptionPrice,
    
    // Error states
    hasError,
    balanceError,
    totalAssetsError,
    yieldRateError,
    usdyBalanceError,
    redemptionPriceError,
    
    // Refetch functions
    refetchBalance,
    refetchTotalAssets,
    refetchYieldRate,
    refetchUSDYBalance,
    refetchRedemptionPrice,
    refetchAll: () => {
      refetchBalance()
      refetchTotalAssets()
      refetchYieldRate()
      refetchUSDYBalance()
      refetchRedemptionPrice()
    },
    
    // Write functions (USDC ↔ USDY conversion)
    depositUSDC,
    withdrawUSDC,
    compoundYield,
    
    // Transaction states
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
