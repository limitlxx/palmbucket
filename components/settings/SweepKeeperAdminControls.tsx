'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { sweepKeeperAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { formatUnits, parseUnits } from 'viem'

interface SweepKeeperAdminControlsProps {
  tokenDecimals?: number
}

/**
 * Admin controls component for SweepKeeper contract
 * Allows contract owner to:
 * - Pause/unpause the contract
 * - Set global minimum balance
 * - View pause status
 * - View time until next sweep opportunity
 */
export function SweepKeeperAdminControls({ tokenDecimals = 6 }: SweepKeeperAdminControlsProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const [newGlobalMinimum, setNewGlobalMinimum] = useState('')
  const [showMinimumInput, setShowMinimumInput] = useState(false)

  // Get contract addresses
  const addresses = chainId ? getContractAddresses(chainId) : null
  const sweepKeeperAddress = addresses?.sweepKeeper

  // Read contract owner
  const { data: owner } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'owner',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Read pause status
  const { data: isPaused, refetch: refetchPauseStatus } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'isPaused',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Read global minimum balance
  const { data: globalMinimum, refetch: refetchGlobalMinimum } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'globalMinimumBalance',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Read time until next sweep
  const { data: timeUntilNextSweep, refetch: refetchTimeUntilNextSweep } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'getTimeUntilNextSweep',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Read month-end status
  const { data: isMonthEnd } = useReadContract({
    address: sweepKeeperAddress,
    abi: sweepKeeperAbi,
    functionName: 'isMonthEnd',
    query: {
      enabled: !!sweepKeeperAddress,
    },
  })

  // Write contracts
  const { 
    writeContract: writePause, 
    data: pauseHash, 
    isPending: isPausePending 
  } = useWriteContract()

  const { 
    writeContract: writeUnpause, 
    data: unpauseHash, 
    isPending: isUnpausePending 
  } = useWriteContract()

  const { 
    writeContract: writeSetGlobalMinimum, 
    data: setGlobalMinimumHash, 
    isPending: isSetGlobalMinimumPending 
  } = useWriteContract()

  // Wait for transactions
  const { isLoading: isPauseConfirming, isSuccess: isPauseSuccess } = 
    useWaitForTransactionReceipt({ hash: pauseHash })

  const { isLoading: isUnpauseConfirming, isSuccess: isUnpauseSuccess } = 
    useWaitForTransactionReceipt({ hash: unpauseHash })

  const { isLoading: isSetGlobalMinimumConfirming, isSuccess: isSetGlobalMinimumSuccess } = 
    useWaitForTransactionReceipt({ hash: setGlobalMinimumHash })

  // Refetch data after successful transactions
  useEffect(() => {
    if (isPauseSuccess || isUnpauseSuccess) {
      refetchPauseStatus()
    }
  }, [isPauseSuccess, isUnpauseSuccess, refetchPauseStatus])

  useEffect(() => {
    if (isSetGlobalMinimumSuccess) {
      refetchGlobalMinimum()
      setNewGlobalMinimum('')
      setShowMinimumInput(false)
    }
  }, [isSetGlobalMinimumSuccess, refetchGlobalMinimum])

  // Refetch time until next sweep periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refetchTimeUntilNextSweep()
    }, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [refetchTimeUntilNextSweep])

  const handlePause = () => {
    if (!sweepKeeperAddress) return

    if (window.confirm(
      '⚠️ Are you sure you want to PAUSE the SweepKeeper?\n\n' +
      'This will prevent all sweep executions until unpaused.\n' +
      'Use this only in emergency situations.'
    )) {
      writePause({
        address: sweepKeeperAddress,
        abi: sweepKeeperAbi,
        functionName: 'pause',
      })
    }
  }

  const handleUnpause = () => {
    if (!sweepKeeperAddress) return

    if (window.confirm(
      'Are you sure you want to UNPAUSE the SweepKeeper?\n\n' +
      'This will resume normal sweep operations.'
    )) {
      writeUnpause({
        address: sweepKeeperAddress,
        abi: sweepKeeperAbi,
        functionName: 'unpause',
      })
    }
  }

  const handleSetGlobalMinimum = () => {
    if (!sweepKeeperAddress || !newGlobalMinimum) return

    try {
      const minimumWei = parseUnits(newGlobalMinimum, tokenDecimals)
      
      // Validate reasonable minimum (not more than 1 million USDC)
      const maxMinimum = parseUnits('1000000', tokenDecimals)
      if (minimumWei > maxMinimum) {
        alert('Minimum balance cannot exceed 1,000,000 USDC')
        return
      }

      writeSetGlobalMinimum({
        address: sweepKeeperAddress,
        abi: sweepKeeperAbi,
        functionName: 'setGlobalMinimumBalance',
        args: [minimumWei],
      })
    } catch (error) {
      alert('Invalid minimum balance value')
    }
  }

  const formatTimeUntilSweep = (seconds: bigint | undefined) => {
    if (!seconds || seconds === 0n) {
      return 'Currently in sweep window'
    }

    const totalSeconds = Number(seconds)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`
    }
  }

  // Check if current user is the owner
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()

  if (!address) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please connect your wallet to view admin controls</p>
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

  if (!isOwner) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">
          🔒 Admin controls are only available to the contract owner
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Current owner: {owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : 'Loading...'}
        </p>
      </div>
    )
  }

  const isPending = isPausePending || isUnpausePending || isSetGlobalMinimumPending
  const isConfirming = isPauseConfirming || isUnpauseConfirming || isSetGlobalMinimumConfirming

  return (
    <div className="space-y-6">
      {/* Admin Badge */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👑</span>
          <div>
            <p className="font-semibold text-purple-900">Admin Controls</p>
            <p className="text-sm text-purple-700">You are the contract owner</p>
          </div>
        </div>
      </div>

      {/* Pause Status & Controls */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Contract Status</h3>
            <p className="text-sm text-gray-600 mt-1">
              Emergency pause control for the SweepKeeper
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold ${
            isPaused 
              ? 'bg-red-100 text-red-800 border-2 border-red-300' 
              : 'bg-green-100 text-green-800 border-2 border-green-300'
          }`}>
            {isPaused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
          </div>
        </div>

        <div className="space-y-3">
          {isPaused ? (
            <>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  ⚠️ <strong>Contract is paused.</strong> All sweep executions are currently blocked.
                </p>
              </div>
              <button
                onClick={handleUnpause}
                disabled={isPending || isConfirming}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isUnpausePending || isUnpauseConfirming ? 'Unpausing...' : '▶️ Unpause Contract'}
              </button>
            </>
          ) : (
            <>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ <strong>Contract is active.</strong> Sweeps can be executed normally.
                </p>
              </div>
              <button
                onClick={handlePause}
                disabled={isPending || isConfirming}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isPausePending || isPauseConfirming ? 'Pausing...' : '⏸️ Pause Contract'}
              </button>
            </>
          )}

          <p className="text-xs text-gray-500 text-center">
            💡 Use pause only in emergency situations to halt all sweep operations
          </p>
        </div>
      </div>

      {/* Global Minimum Balance */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Global Minimum Balance</h3>
        
        <div className="space-y-4">
          {/* Current Global Minimum */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Current Global Default</p>
            <p className="text-2xl font-bold text-blue-900">
              {globalMinimum ? formatUnits(globalMinimum, tokenDecimals) : '0'} USDC
            </p>
            <p className="text-xs text-gray-600 mt-2">
              This is the default minimum balance for users who haven't set a custom minimum
            </p>
          </div>

          {/* Set New Global Minimum */}
          {!showMinimumInput ? (
            <button
              onClick={() => setShowMinimumInput(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Update Global Minimum
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Global Minimum Balance (USDC)
                </label>
                <input
                  type="number"
                  value={newGlobalMinimum}
                  onChange={(e) => setNewGlobalMinimum(e.target.value)}
                  placeholder="Enter amount (e.g., 10)"
                  min="0"
                  max="1000000"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: 1,000,000 USDC
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetGlobalMinimum}
                  disabled={!newGlobalMinimum || isPending || isConfirming}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSetGlobalMinimumPending || isSetGlobalMinimumConfirming ? 'Setting...' : 'Set Global Minimum'}
                </button>
                <button
                  onClick={() => {
                    setShowMinimumInput(false)
                    setNewGlobalMinimum('')
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Note:</strong> Changing the global minimum only affects users who haven't 
              set a custom minimum. Existing custom minimums remain unchanged.
            </p>
          </div>
        </div>
      </div>

      {/* Time Until Next Sweep */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Sweep Schedule</h3>
        
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border-2 ${
            isMonthEnd 
              ? 'bg-green-50 border-green-300' 
              : 'bg-gray-50 border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Month-End Window</p>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                isMonthEnd 
                  ? 'bg-green-200 text-green-800' 
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {isMonthEnd ? '✓ ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {isMonthEnd 
                ? 'Currently in the last 3 days of the month - sweeps can execute' 
                : 'Not in month-end window - sweeps cannot execute'}
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Time Until Next Sweep Window</p>
            <p className="text-xl font-bold text-blue-900">
              {formatTimeUntilSweep(timeUntilNextSweep as bigint | undefined)}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Sweeps execute during the last 3 days of each month
            </p>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-800">
              📅 <strong>Sweep Window:</strong> The last 3 days of every month
              <br />
              <span className="text-xs">
                • 31-day months: Days 29, 30, 31
                <br />
                • 30-day months: Days 28, 29, 30
                <br />
                • February (leap): Days 27, 28, 29
                <br />
                • February (non-leap): Days 26, 27, 28
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Status */}
      {(isPauseSuccess || isUnpauseSuccess || isSetGlobalMinimumSuccess) && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">
            ✓ Transaction successful!
          </p>
        </div>
      )}
    </div>
  )
}
