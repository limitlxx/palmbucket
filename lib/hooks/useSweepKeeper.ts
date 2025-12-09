import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi'
import { sweepKeeperAbi } from '@/lib/contracts/abis'
import { Address } from 'viem'
import { useState, useEffect } from 'react'

/**
 * Custom hook for interacting with the SweepKeeper contract
 * Provides functions for executing sweeps and monitoring sweep events
 */
export function useSweepKeeper(contractAddress: Address) {
  const { address } = useAccount()
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const [lastSweepEvent, setLastSweepEvent] = useState<any>(null)

  // Read highest yield bucket for sweep
  const { data: optimalDestination, refetch: refetchOptimalDestination } = useReadContract({
    address: contractAddress,
    abi: sweepKeeperAbi,
    functionName: 'getHighestYieldBucket',
  })

  // Watch for sweep events
  useWatchContractEvent({
    address: contractAddress,
    abi: sweepKeeperAbi,
    eventName: 'SweepExecuted',
    onLogs(logs) {
      if (logs.length > 0) {
        const latestLog = logs[logs.length - 1]
        setLastSweepEvent({
          user: latestLog.args.user,
          amount: latestLog.args.amount,
          fromBucket: latestLog.args.fromBucket,
          toBucket: latestLog.args.toBucket,
          expectedYield: latestLog.args.expectedYield,
          timestamp: latestLog.args.timestamp,
        })
      }
    },
  })

  // Execute sweep
  const executeSweep = (userAddress: Address) => {
    return writeContract({
      address: contractAddress,
      abi: sweepKeeperAbi,
      functionName: 'executeSweep',
      args: [userAddress],
    })
  }

  return {
    optimalDestination,
    refetchOptimalDestination,
    executeSweep,
    lastSweepEvent,
    isPending,
    isConfirming,
    isConfirmed,
    error: writeError,
    hash,
  }
}
