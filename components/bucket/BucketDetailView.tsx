'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useChainId, useWatchContractEvent, useReadContract } from 'wagmi'
import { Address, formatEther, parseAbiItem } from 'viem'
import { bucketVaultAbi, paymentRouterAbi, sweepKeeperAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { BucketType } from './BucketCard'

interface BucketDetailViewProps {
  type: BucketType
  vaultAddress: Address
  onClose: () => void
}

interface TransactionEvent {
  type: 'deposit' | 'withdraw' | 'yield' | 'sweep' | 'payment'
  amount: bigint
  timestamp: number
  txHash: string
  description: string
}

const bucketConfig = {
  bills: { name: 'Bills', color: 'text-red-700', bgColor: 'bg-red-50' },
  savings: { name: 'Savings', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  growth: { name: 'Growth', color: 'text-green-700', bgColor: 'bg-green-50' },
  spendable: { name: 'Spendable', color: 'text-purple-700', bgColor: 'bg-purple-50' },
}

export function BucketDetailView({ type, vaultAddress, onClose }: BucketDetailViewProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const config = bucketConfig[type]
  const addresses = getContractAddresses(chainId)
  
  const [transactions, setTransactions] = useState<TransactionEvent[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Read current yield rate
  const { data: yieldRate } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getYieldRate',
  })

  // Read current balance
  const { data: shareBalance } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  // Calculate projected returns
  const projectedReturns = useMemo(() => {
    if (!shareBalance || !yieldRate) return { daily: 0n, monthly: 0n, yearly: 0n }
    
    const rate = Number(yieldRate) / 10000 // Convert basis points to decimal
    const balance = shareBalance
    
    // Calculate returns
    const yearly = (balance * BigInt(Math.floor(rate * 10000))) / 10000n
    const monthly = yearly / 12n
    const daily = yearly / 365n
    
    return { daily, monthly, yearly }
  }, [shareBalance, yieldRate])

  // Load transaction history from localStorage on mount
  useEffect(() => {
    const storageKey = `palmbudget_${type}_history_${address}`
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const history = parsed.map((e: any) => ({
          ...e,
          amount: BigInt(e.amount),
        }))
        setTransactions(history)
      } catch (error) {
        console.error('Failed to load transaction history:', error)
      }
    }
    
    setIsLoadingHistory(false)
  }, [type, address])

  // Save transaction history to localStorage
  useEffect(() => {
    if (transactions.length > 0 && address) {
      const storageKey = `palmbudget_${type}_history_${address}`
      const serializable = transactions.map(e => ({
        ...e,
        amount: e.amount.toString(),
      }))
      localStorage.setItem(storageKey, JSON.stringify(serializable))
    }
  }, [transactions, type, address])

  // Watch for Transfer events (ERC20 standard - deposits and withdrawals)
  useWatchContractEvent({
    address: vaultAddress,
    abi: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)') as any,
    eventName: 'Transfer',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (!address) return
        
        const from = log.args?.from as Address
        const to = log.args?.to as Address
        const value = log.args?.value as bigint
        
        // Deposit: tokens transferred TO user
        if (to.toLowerCase() === address.toLowerCase() && from !== address) {
          const event: TransactionEvent = {
            type: 'deposit',
            amount: value,
            timestamp: Date.now(),
            txHash: log.transactionHash || '',
            description: 'Deposit to bucket',
          }
          
          setTransactions(prev => {
            const exists = prev.some(e => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
        
        // Withdrawal: tokens transferred FROM user
        if (from.toLowerCase() === address.toLowerCase() && to !== address) {
          const event: TransactionEvent = {
            type: 'withdraw',
            amount: value,
            timestamp: Date.now(),
            txHash: log.transactionHash || '',
            description: 'Withdrawal from bucket',
          }
          
          setTransactions(prev => {
            const exists = prev.some(e => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
      })
    },
  })

  // Watch for PaymentRouted events
  useWatchContractEvent({
    address: addresses?.paymentRouter,
    abi: paymentRouterAbi,
    eventName: 'PaymentRouted',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (!address) return
        
        const user = log.args?.user as Address
        if (user.toLowerCase() !== address.toLowerCase()) return
        
        const amounts = Array.from(log.args?.amounts || []) as bigint[]
        const bucketIndex = ['bills', 'savings', 'growth', 'spendable'].indexOf(type)
        
        if (bucketIndex >= 0 && amounts[bucketIndex] > 0n) {
          const event: TransactionEvent = {
            type: 'payment',
            amount: amounts[bucketIndex],
            timestamp: Date.now(),
            txHash: log.transactionHash || '',
            description: 'Auto-split payment',
          }
          
          setTransactions(prev => {
            const exists = prev.some(e => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
      })
    },
  })

  // Watch for SweepExecuted events
  useWatchContractEvent({
    address: addresses?.sweepKeeper,
    abi: sweepKeeperAbi,
    eventName: 'SweepExecuted',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (!address) return
        
        const user = log.args?.user as Address
        const toBucket = log.args?.toBucket as Address
        const fromBucket = log.args?.fromBucket as Address
        const amount = log.args?.amount as bigint
        
        if (user.toLowerCase() !== address.toLowerCase()) return
        
        // Check if this bucket was involved in the sweep
        if (toBucket.toLowerCase() === vaultAddress.toLowerCase()) {
          const event: TransactionEvent = {
            type: 'sweep',
            amount: amount,
            timestamp: Date.now(),
            txHash: log.transactionHash || '',
            description: 'Auto-sweep deposit',
          }
          
          setTransactions(prev => {
            const exists = prev.some(e => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        } else if (fromBucket.toLowerCase() === vaultAddress.toLowerCase()) {
          const event: TransactionEvent = {
            type: 'sweep',
            amount: amount,
            timestamp: Date.now(),
            txHash: log.transactionHash || '',
            description: 'Auto-sweep withdrawal',
          }
          
          setTransactions(prev => {
            const exists = prev.some(e => e.txHash === event.txHash)
            if (exists) return prev
            return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
          })
        }
      })
    },
  })

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  // Get transaction icon
  const getTransactionIcon = (txType: TransactionEvent['type']) => {
    switch (txType) {
      case 'deposit':
      case 'payment':
        return '↓'
      case 'withdraw':
        return '↑'
      case 'yield':
        return '✨'
      case 'sweep':
        return '🔄'
      default:
        return '•'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${config.bgColor} rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className={`text-2xl font-bold ${config.color}`}>
            {config.name} Bucket Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Balance */}
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Current Balance</h3>
            <p className={`text-3xl font-bold ${config.color}`}>
              ${shareBalance ? formatEther(shareBalance) : '0.00'}
            </p>
          </div>

          {/* Projected Returns */}
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Projected Returns</h3>
            <div className="text-sm text-gray-600 mb-2">
              Current APY: {yieldRate ? (Number(yieldRate) / 100).toFixed(2) : '0.00'}%
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Daily</p>
                <p className={`text-lg font-semibold ${config.color}`}>
                  ${formatEther(projectedReturns.daily)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Monthly</p>
                <p className={`text-lg font-semibold ${config.color}`}>
                  ${formatEther(projectedReturns.monthly)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Yearly</p>
                <p className={`text-lg font-semibold ${config.color}`}>
                  ${formatEther(projectedReturns.yearly)}
                </p>
              </div>
            </div>
          </div>

          {/* Yield Calculation Breakdown */}
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Yield Calculation</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Principal Balance:</span>
                <span className="font-medium">${shareBalance ? formatEther(shareBalance) : '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Annual Yield Rate:</span>
                <span className="font-medium">{yieldRate ? (Number(yieldRate) / 100).toFixed(2) : '0.00'}%</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Expected Annual Return:</span>
                <span className={`font-bold ${config.color}`}>
                  ${formatEther(projectedReturns.yearly)}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Transaction History</h3>
            
            {isLoadingHistory ? (
              <div className="text-center py-8 text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
                <p className="mt-2">Loading history...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No transactions yet</p>
                <p className="text-xs mt-1">Transactions will appear here as they occur</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.map((tx, index) => (
                  <div
                    key={`${tx.txHash}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getTransactionIcon(tx.type)}</span>
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        <p className="text-xs text-gray-500">{formatTimestamp(tx.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.type === 'deposit' || tx.type === 'payment' || tx.type === 'yield'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'payment' || tx.type === 'yield' ? '+' : '-'}
                        ${formatEther(tx.amount)}
                      </p>
                      {tx.txHash && (
                        <a
                          href={`https://explorer.mantle.xyz/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View TX
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
