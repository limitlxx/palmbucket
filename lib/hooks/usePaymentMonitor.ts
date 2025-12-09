import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWatchContractEvent, useWaitForTransactionReceipt } from 'wagmi'
import { paymentRouterAbi } from '@/lib/contracts/abis'
import { Address, Hash } from 'viem'

export interface PaymentEvent {
  id: string
  user: Address
  token: Address
  totalAmount: bigint
  amounts: readonly [bigint, bigint, bigint, bigint]
  timestamp: number
  transactionHash: Hash
  status: 'pending' | 'confirmed' | 'failed'
}

export interface PaymentNotification {
  id: string
  type: 'payment_received' | 'payment_confirmed' | 'payment_failed'
  message: string
  timestamp: number
  event?: PaymentEvent
}

/**
 * Custom hook for monitoring incoming payments and auto-split events
 * Provides real-time payment detection, notifications, and history tracking
 * 
 * **Validates: Requirements 1.1, 1.2**
 */
export function usePaymentMonitor(contractAddress: Address) {
  const { address } = useAccount()
  const [paymentHistory, setPaymentHistory] = useState<PaymentEvent[]>([])
  const [notifications, setNotifications] = useState<PaymentNotification[]>([])
  const [pendingTransactions, setPendingTransactions] = useState<Set<Hash>>(new Set())

  // Load payment history from localStorage on mount
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`payment_history_${address}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setPaymentHistory(parsed)
        } catch (e) {
          console.error('Failed to parse payment history:', e)
        }
      }
    }
  }, [address])

  // Save payment history to localStorage
  const saveHistory = useCallback((history: PaymentEvent[]) => {
    if (address) {
      localStorage.setItem(`payment_history_${address}`, JSON.stringify(history))
    }
  }, [address])

  // Add notification
  const addNotification = useCallback((notification: Omit<PaymentNotification, 'id' | 'timestamp'>) => {
    const newNotification: PaymentNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
    }
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)) // Keep last 50
    return newNotification
  }, [])

  // Clear notification
  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Watch for PaymentRouted events
  useWatchContractEvent({
    address: contractAddress,
    abi: paymentRouterAbi,
    eventName: 'PaymentRouted',
    onLogs(logs) {
      logs.forEach((log) => {
        const { args, transactionHash } = log
        
        // Only process events for the current user
        if (args.user?.toLowerCase() !== address?.toLowerCase()) {
          return
        }

        const paymentEvent: PaymentEvent = {
          id: `payment_${transactionHash}_${Date.now()}`,
          user: args.user as Address,
          token: args.token as Address,
          totalAmount: args.totalAmount as bigint,
          amounts: args.amounts as readonly [bigint, bigint, bigint, bigint],
          timestamp: Date.now(),
          transactionHash: transactionHash as Hash,
          status: 'pending',
        }

        // Add to history
        setPaymentHistory(prev => {
          const updated = [paymentEvent, ...prev].slice(0, 100) // Keep last 100
          saveHistory(updated)
          return updated
        })

        // Track pending transaction
        setPendingTransactions(prev => new Set(prev).add(transactionHash as Hash))

        // Add notification
        addNotification({
          type: 'payment_received',
          message: `Payment received and split into buckets`,
          event: paymentEvent,
        })
      })
    },
  })

  // Monitor pending transactions for confirmation
  useEffect(() => {
    pendingTransactions.forEach((hash) => {
      // This will be handled by individual transaction monitors
    })
  }, [pendingTransactions])

  // Get payment by transaction hash
  const getPaymentByHash = useCallback((hash: Hash): PaymentEvent | undefined => {
    return paymentHistory.find(p => p.transactionHash === hash)
  }, [paymentHistory])

  // Update payment status
  const updatePaymentStatus = useCallback((hash: Hash, status: PaymentEvent['status']) => {
    setPaymentHistory(prev => {
      const updated = prev.map(p => 
        p.transactionHash === hash ? { ...p, status } : p
      )
      saveHistory(updated)
      return updated
    })

    // Remove from pending if confirmed or failed
    if (status === 'confirmed' || status === 'failed') {
      setPendingTransactions(prev => {
        const next = new Set(prev)
        next.delete(hash)
        return next
      })

      // Add notification
      const payment = getPaymentByHash(hash)
      if (payment) {
        addNotification({
          type: status === 'confirmed' ? 'payment_confirmed' : 'payment_failed',
          message: status === 'confirmed' 
            ? 'Payment confirmed and funds distributed'
            : 'Payment failed - please try again',
          event: payment,
        })
      }
    }
  }, [getPaymentByHash, addNotification, saveHistory])

  // Clear payment history
  const clearHistory = useCallback(() => {
    setPaymentHistory([])
    if (address) {
      localStorage.removeItem(`payment_history_${address}`)
    }
  }, [address])

  return {
    paymentHistory,
    notifications,
    pendingTransactions: Array.from(pendingTransactions),
    addNotification,
    clearNotification,
    clearAllNotifications,
    getPaymentByHash,
    updatePaymentStatus,
    clearHistory,
  }
}

/**
 * Hook to monitor a specific transaction for confirmation
 * Updates payment status when transaction is confirmed or fails
 */
export function useTransactionMonitor(
  hash: Hash | undefined,
  onConfirmed?: () => void,
  onFailed?: () => void
) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isSuccess && onConfirmed) {
      onConfirmed()
    }
  }, [isSuccess, onConfirmed])

  useEffect(() => {
    if (isError && onFailed) {
      onFailed()
    }
  }, [isError, onFailed])

  return {
    isConfirming: isLoading,
    isConfirmed: isSuccess,
    isFailed: isError,
  }
}
