'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { sweepKeeperAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { useYieldRateTracking } from '@/lib/hooks'
import { formatUnits, parseUnits } from 'viem'

interface SweepAuthorizationToggleProps {
  tokenDecimals?: number
}

/**
 * Component for managing SweepKeeper authorization and minimum balance settings
 * Allows users to:
 * - Authorize/revoke auto-sweep functionality
 * - View current authorization status
 * - Set custom minimum balance for Spendable bucket
 * - View global default minimum balance
 */
export function SweepAuthorizationToggle({ tokenDecimals = 6 }: SweepAuthorizationToggleProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const [customMinimum, setCustomMinimum] = useState('')
  const [showMinimumInput, setShowMinimumInput] = useState(false)

  // Get contract addresses
  const addresses = chainId ? getContractAddresses(chainId) : null
  const sweepKeeperAddress = addresses?.sweepKeeper

  // Get yield rate tracking data
  const { highest, buckets, isLoading: isLoadingYield } = useYieldRateTracking(chainId)

  // Read authorization status
  const { data: isAuthorized, refetch: refetchAuthorization } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'isAuthorized',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!sweepKeeperAddress,
    },
  })

  // Read user's custom minimum balance
  const { data: userMinimum, refetch: refetchUserMinimum } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'getUserMinimumBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!sweepKeeperAddress,
    },
  })

  // Read global minimum balance
  const { data: globalMinimum } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'globalMinimumBalance',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

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

  // Read pause status
  const { data: isPaused } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'isPaused',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Read time until next sweep
  const { data: timeUntilNextSweep } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'getTimeUntilNextSweep',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Write contracts
  const { 
    writeContract: writeAuthorize, 
    data: authorizeHash, 
    isPending: isAuthorizePending 
  } = useWriteContract()

  const { 
    writeContract: writeRevoke, 
    data: revokeHash, 
    isPending: isRevokePending 
  } = useWriteContract()

  const { 
    writeContract: writeSetMinimum, 
    data: setMinimumHash, 
    isPending: isSetMinimumPending 
  } = useWriteContract()

  // Wait for transactions
  const { isLoading: isAuthorizeConfirming, isSuccess: isAuthorizeSuccess } = 
    useWaitForTransactionReceipt({ hash: authorizeHash })

  const { isLoading: isRevokeConfirming, isSuccess: isRevokeSuccess } = 
    useWaitForTransactionReceipt({ hash: revokeHash })

  const { isLoading: isSetMinimumConfirming, isSuccess: isSetMinimumSuccess } = 
    useWaitForTransactionReceipt({ hash: setMinimumHash })

  // Refetch data after successful transactions
  useEffect(() => {
    if (isAuthorizeSuccess || isRevokeSuccess) {
      refetchAuthorization()
    }
  }, [isAuthorizeSuccess, isRevokeSuccess, refetchAuthorization])

  useEffect(() => {
    if (isSetMinimumSuccess) {
      refetchUserMinimum()
      setCustomMinimum('')
      setShowMinimumInput(false)
    }
  }, [isSetMinimumSuccess, refetchUserMinimum])

  const handleAuthorize = () => {
    if (!sweepKeeperAddress) return

    if (window.confirm(
      'Are you sure you want to authorize auto-sweep?\n\n' +
      'This will allow the SweepKeeper to automatically move leftover funds from your Spendable bucket ' +
      'to the highest-yielding bucket at month-end.\n\n' +
      'You can revoke this authorization at any time.'
    )) {
      writeAuthorize({
        address: sweepKeeperAddress,
        abi: sweepKeeperAbi,
        functionName: 'authorizeAutoSweep',
      })
    }
  }

  const handleRevoke = () => {
    if (!sweepKeeperAddress) return

    if (window.confirm(
      'Are you sure you want to revoke auto-sweep authorization?\n\n' +
      'This will stop automatic fund optimization. You can re-authorize at any time.'
    )) {
      writeRevoke({
        address: sweepKeeperAddress,
        abi: sweepKeeperAbi,
        functionName: 'revokeAutoSweep',
      })
    }
  }

  const handleSetMinimum = () => {
    if (!sweepKeeperAddress || !customMinimum) return

    try {
      const minimumWei = parseUnits(customMinimum, tokenDecimals)
      
      writeSetMinimum({
        address: sweepKeeperAddress,
        abi: sweepKeeperAbi,
        functionName: 'setUserMinimumBalance',
        args: [minimumWei],
      })
    } catch (error) {
      alert('Invalid minimum balance value')
    }
  }

  const formatLastSweep = (timestamp: bigint | undefined) => {
    if (!timestamp || timestamp === 0n) return 'Never'
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleString()
  }

  if (!address) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please connect your wallet to manage auto-sweep settings</p>
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

  const isPending = isAuthorizePending || isRevokePending || isSetMinimumPending
  const isConfirming = isAuthorizeConfirming || isRevokeConfirming || isSetMinimumConfirming

  return (
    <div className="space-y-6">
      {/* Authorization Status */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Auto-Sweep Authorization</h3>
            <p className="text-sm text-gray-600 mt-1">
              Allow automatic optimization of your funds at month-end
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isAuthorized 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isAuthorized ? 'Authorized' : 'Not Authorized'}
          </div>
        </div>

        <div className="space-y-3">
          {isAuthorized ? (
            <button
              onClick={handleRevoke}
              disabled={isPending || isConfirming}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRevokePending || isRevokeConfirming ? 'Revoking...' : 'Revoke Authorization'}
            </button>
          ) : (
            <button
              onClick={handleAuthorize}
              disabled={isPending || isConfirming}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAuthorizePending || isAuthorizeConfirming ? 'Authorizing...' : 'Authorize Auto-Sweep'}
            </button>
          )}

          {isAuthorized && (
            <p className="text-xs text-gray-500 text-center">
              ⚠️ Make sure to also approve the SweepKeeper to spend your Spendable vault shares
            </p>
          )}
        </div>
      </div>

      {/* Pause Status & Time Until Next Sweep */}
      {isPaused && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⏸️</span>
            <p className="font-semibold text-red-900">SweepKeeper is Paused</p>
          </div>
          <p className="text-sm text-red-800">
            The contract is currently paused by the administrator. Auto-sweep operations are temporarily disabled.
          </p>
        </div>
      )}

      {!isPaused && timeUntilNextSweep !== undefined && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Next Sweep Window</p>
              <p className="text-lg font-semibold text-blue-900">
                {timeUntilNextSweep === 0n 
                  ? 'Currently in sweep window (last 3 days of month)' 
                  : (() => {
                      const totalSeconds = Number(timeUntilNextSweep)
                      const days = Math.floor(totalSeconds / 86400)
                      const hours = Math.floor((totalSeconds % 86400) / 3600)
                      return days > 0 
                        ? `In ${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`
                        : `In ${hours} hour${hours !== 1 ? 's' : ''}`
                    })()
                }
              </p>
            </div>
            <span className="text-3xl">📅</span>
          </div>
        </div>
      )}

      {/* Minimum Balance Settings */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Minimum Balance Settings</h3>
        
        <div className="space-y-4">
          {/* Current Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Your Minimum</p>
              <p className="text-lg font-semibold">
                {userMinimum ? formatUnits(userMinimum, tokenDecimals) : '0'} USDC
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Global Default</p>
              <p className="text-lg font-semibold">
                {globalMinimum ? formatUnits(globalMinimum, tokenDecimals) : '0'} USDC
              </p>
            </div>
          </div>

          {/* Set Custom Minimum */}
          {!showMinimumInput ? (
            <button
              onClick={() => setShowMinimumInput(true)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Set Custom Minimum Balance
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Minimum Balance (USDC)
                </label>
                <input
                  type="number"
                  value={customMinimum}
                  onChange={(e) => setCustomMinimum(e.target.value)}
                  placeholder="Enter amount (e.g., 50)"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This amount will always be kept in your Spendable bucket
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetMinimum}
                  disabled={!customMinimum || isPending || isConfirming}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSetMinimumPending || isSetMinimumConfirming ? 'Setting...' : 'Set Minimum'}
                </button>
                <button
                  onClick={() => {
                    setShowMinimumInput(false)
                    setCustomMinimum('')
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Set a minimum balance to ensure you always have funds available 
              for immediate spending. The auto-sweep will only move amounts above this threshold.
            </p>
          </div>
        </div>
      </div>

      {/* Current Best Destination */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Current Sweep Destination</h3>
        
        {isLoadingYield ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          </div>
        ) : highest ? (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">🏆 Best Yield</p>
                  <p className="text-xl font-bold text-green-700">{highest.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {(Number(highest.yieldRate) / 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-1">APY</p>
                </div>
              </div>
            </div>

            {/* All Bucket Yields */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 mb-2">All Buckets:</p>
              {buckets.map((bucket) => (
                <div
                  key={bucket.address}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm text-gray-700">{bucket.name}</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {(Number(bucket.yieldRate) / 100).toFixed(2)}% APY
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              💡 Destination automatically updates when yield rates change
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Unable to load yield rates
          </p>
        )}
      </div>

      {/* Sweep History */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Sweep History</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Last Sweep:</span>
            <span className="text-sm font-medium">
              {formatLastSweep(lastSweepTimestamp as bigint | undefined)}
            </span>
          </div>
          {isAuthorized && (
            <p className="text-xs text-gray-500 mt-2">
              Auto-sweep runs during the last 3 days of each month when you have funds above your minimum balance.
            </p>
          )}
        </div>
      </div>

      {/* Transaction Status */}
      {(isAuthorizeSuccess || isRevokeSuccess || isSetMinimumSuccess) && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">
            ✓ Transaction successful!
          </p>
        </div>
      )}
    </div>
  )
}
