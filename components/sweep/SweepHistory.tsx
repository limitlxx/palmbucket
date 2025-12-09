'use client'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { sweepKeeperAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { formatUnits } from 'viem'
import { Address } from 'viem'

interface SweepHistoryEvent {
  transactionHash: string
  blockNumber: bigint
  user: Address
  amount: bigint
  fromBucket: Address
  toBucket: Address
  expectedYield: bigint
  timestamp: bigint
}

interface SweepHistoryProps {
  tokenDecimals?: number
  maxEvents?: number
}

/**
 * Component for displaying sweep execution history
 * Shows a log of all past sweep transactions with details
 */
export function SweepHistory({ 
  tokenDecimals = 6,
  maxEvents = 20
}: SweepHistoryProps) {
  const { address, chainId } = useAccount()
  const publicClient = usePublicClient()
  const [history, setHistory] = useState<SweepHistoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get contract addresses
  const addresses = chainId ? getContractAddresses(chainId) : null
  const sweepKeeperAddress = addresses?.sweepKeeper

  // Load sweep history
  useEffect(() => {
    if (!address || !sweepKeeperAddress || !publicClient) return

    const loadHistory = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Query SweepExecuted events for this user
        const logs = await publicClient.getLogs({
          address: sweepKeeperAddress,
          event: {
            type: 'event',
            name: 'SweepExecuted',
            inputs: [
              { type: 'address', indexed: true, name: 'user' },
              { type: 'uint256', indexed: false, name: 'amount' },
              { type: 'address', indexed: true, name: 'fromBucket' },
              { type: 'address', indexed: true, name: 'toBucket' },
              { type: 'uint256', indexed: false, name: 'expectedYield' },
              { type: 'uint256', indexed: false, name: 'timestamp' },
            ],
          },
          args: {
            user: address,
          },
          fromBlock: 'earliest',
          toBlock: 'latest',
        })

        // Parse and sort events (newest first)
        const events: SweepHistoryEvent[] = logs
          .map(log => ({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            user: log.args.user as Address,
            amount: log.args.amount as bigint,
            fromBucket: log.args.fromBucket as Address,
            toBucket: log.args.toBucket as Address,
            expectedYield: log.args.expectedYield as bigint,
            timestamp: log.args.timestamp as bigint,
          }))
          .sort((a, b) => Number(b.timestamp - a.timestamp))
          .slice(0, maxEvents)

        setHistory(events)
      } catch (err) {
        console.error('Error loading sweep history:', err)
        setError('Failed to load sweep history')
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [address, sweepKeeperAddress, publicClient, maxEvents])

  const getBucketName = (bucketAddress: Address): string => {
    if (!addresses) return 'Unknown'
    
    const lowerAddress = bucketAddress.toLowerCase()
    if (lowerAddress === addresses.billsVault?.toLowerCase()) return 'Bills'
    if (lowerAddress === addresses.savingsVault?.toLowerCase()) return 'Savings'
    if (lowerAddress === addresses.growthVault?.toLowerCase()) return 'Growth'
    if (lowerAddress === addresses.spendableVault?.toLowerCase()) return 'Spendable'
    
    return 'Unknown'
  }

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleString()
  }

  const getExplorerUrl = (txHash: string) => {
    if (chainId === 5003) {
      return `https://sepolia.mantlescan.xyz/tx/${txHash}`
    } else if (chainId === 5000) {
      return `https://mantlescan.xyz/tx/${txHash}`
    }
    return '#'
  }

  if (!address) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please connect your wallet to view sweep history</p>
      </div>
    )
  }

  if (!sweepKeeperAddress) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">SweepKeeper contract not available on this network</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Sweep History</h3>
        <p className="text-sm text-gray-600 mt-1">
          Your past auto-sweep transactions
        </p>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading history...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-600">No sweep history yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Sweeps will appear here after they are executed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((event, index) => (
              <div
                key={`${event.transactionHash}-${index}`}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="font-semibold text-sm">Sweep Executed</span>
                  </div>
                  <a
                    href={getExplorerUrl(event.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    View on Explorer
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <p className="font-medium">
                      {formatUnits(event.amount, tokenDecimals)} USDC
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-600">Expected Yield:</span>
                    <p className="font-medium text-green-600">
                      +{formatUnits(event.expectedYield, tokenDecimals)} USDC/year
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-600">From:</span>
                    <p className="font-medium">{getBucketName(event.fromBucket)}</p>
                  </div>

                  <div>
                    <span className="text-gray-600">To:</span>
                    <p className="font-medium text-green-600">
                      {getBucketName(event.toBucket)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
