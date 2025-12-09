'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWatchContractEvent, useReadContract, useChainId } from 'wagmi'
import { sweepKeeperAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { useYieldRateTracking } from '@/lib/hooks'
import { formatUnits } from 'viem'
import { Address } from 'viem'

interface SweepEvent {
  user: Address
  amount: bigint
  fromBucket: Address
  toBucket: Address
  expectedYield: bigint
  timestamp: bigint
}

interface SweepNotification {
  id: string
  event: SweepEvent
  displayTimestamp: number
  read: boolean
}

interface SweepNotificationsProps {
  tokenDecimals?: number
  maxNotifications?: number
}

/**
 * Component for displaying sweep execution notifications
 * Shows real-time notifications when sweeps are executed
 * Displays amount moved, destination bucket, and expected yield increase
 */
export function SweepNotifications({ 
  tokenDecimals = 6, 
  maxNotifications = 10 
}: SweepNotificationsProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const [notifications, setNotifications] = useState<SweepNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Get contract addresses
  const addresses = chainId ? getContractAddresses(chainId) : null
  const sweepKeeperAddress = addresses?.sweepKeeper

  // Get yield rate tracking data
  const { highest, isLoading: isLoadingYield } = useYieldRateTracking(chainId)

  // Read last sweep timestamp
  const { data: lastSweepTimestamp } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'getLastSweepTimestamp',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!sweepKeeperAddress,
    },
  })

  // Watch for sweep events
  useWatchContractEvent({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    eventName: 'SweepExecuted',
    onLogs(logs) {
      if (!address) return

      for (const log of logs) {
        const { user, amount, fromBucket, toBucket, expectedYield, timestamp } = log.args

        // Only show notifications for the current user
        if (user?.toLowerCase() !== address.toLowerCase()) continue

        const notification: SweepNotification = {
          id: `${log.transactionHash}-${log.logIndex}`,
          event: {
            user: user as Address,
            amount: amount as bigint,
            fromBucket: fromBucket as Address,
            toBucket: toBucket as Address,
            expectedYield: expectedYield as bigint,
            timestamp: timestamp as bigint,
          },
          displayTimestamp: Date.now(),
          read: false,
        }

        setNotifications(prev => {
          // Check if notification already exists
          if (prev.some(n => n.id === notification.id)) {
            return prev
          }
          // Add new notification and limit to maxNotifications
          return [notification, ...prev].slice(0, maxNotifications)
        })

        // Auto-show notifications panel when new notification arrives
        setShowNotifications(true)
      }
    },
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearNotifications = () => {
    setNotifications([])
  }

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

  const formatRelativeTime = (displayTimestamp: number) => {
    const seconds = Math.floor((Date.now() - displayTimestamp) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (!address || !sweepKeeperAddress) {
    return null
  }

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Sweep notifications"
      >
        <svg
          className="w-6 h-6 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Sweep Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
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
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-sm">No sweep notifications yet</p>
                <p className="text-xs mt-1">
                  Sweeps occur during the last 3 days of each month
                </p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="font-semibold text-sm">Sweep Executed</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(notification.displayTimestamp)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount Moved:</span>
                      <span className="font-medium">
                        {formatUnits(notification.event.amount, tokenDecimals)} USDC
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium">
                        {getBucketName(notification.event.fromBucket)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">To:</span>
                      <span className="font-medium text-green-600">
                        {getBucketName(notification.event.toBucket)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Yield:</span>
                      <span className="font-medium text-green-600">
                        +{formatUnits(notification.event.expectedYield, tokenDecimals)} USDC/year
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(notification.event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Last Sweep Info and Current Best Destination */}
          <div className="border-t border-gray-200">
            {lastSweepTimestamp && lastSweepTimestamp > 0n && (
              <div className="p-3 bg-gray-50 text-xs text-gray-600">
                Last sweep: {formatTimestamp(lastSweepTimestamp)}
              </div>
            )}
            
            {/* Current Best Destination */}
            {highest && !isLoadingYield && (
              <div className="p-3 bg-green-50 border-t border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-800">
                      🎯 Current Best Destination
                    </p>
                    <p className="text-sm font-bold text-green-700 mt-1">
                      {highest.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {(Number(highest.yieldRate) / 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-600">APY</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
