import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { paymentRouterAbi } from '@/lib/contracts/abis'
import { Address } from 'viem'

/**
 * Custom hook for interacting with the PaymentRouter contract
 * Provides functions to set split ratios, route payments, and read user buckets
 */
export function usePaymentRouter(contractAddress: Address) {
  const { address } = useAccount()
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

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

  // Set split ratios
  const setSplitRatios = (ratios: [bigint, bigint, bigint, bigint]) => {
    return writeContract({
      address: contractAddress,
      abi: paymentRouterAbi,
      functionName: 'setSplitRatios',
      args: [ratios],
    })
  }

  // Route payment
  const routePayment = (token: Address, amount: bigint) => {
    return writeContract({
      address: contractAddress,
      abi: paymentRouterAbi,
      functionName: 'routePayment',
      args: [token, amount],
    })
  }

  return {
    userBuckets,
    refetchBuckets,
    setSplitRatios,
    routePayment,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
