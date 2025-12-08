import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { bucketVaultAbi } from '@/lib/contracts/abis'
import { Address } from 'viem'

/**
 * Custom hook for interacting with BucketVault contracts (ERC-4626)
 * Provides functions for deposits, withdrawals, and reading vault data
 */
export function useBucketVault(vaultAddress: Address) {
  const { address } = useAccount()
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  // Read user's share balance
  const { data: shareBalance, refetch: refetchBalance } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Read total assets in vault
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'totalAssets',
  })

  // Read current yield rate
  const { data: yieldRate, refetch: refetchYieldRate } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
  })

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

  return {
    shareBalance,
    totalAssets,
    yieldRate,
    refetchBalance,
    refetchTotalAssets,
    refetchYieldRate,
    deposit,
    redeem,
    compoundYield,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
