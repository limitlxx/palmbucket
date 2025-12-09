'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { erc20Abi, paymentRouterAbi } from '@/lib/contracts/abis'
import { getContractAddresses } from '@/lib/contracts/addresses'
import { Address, parseUnits, maxUint256 } from 'viem'

interface AutoSplitToggleProps {
  tokenAddress: Address
  tokenSymbol: string
  tokenDecimals?: number
}

/**
 * Auto-Split Toggle Component
 * Manages token approval for automatic payment splitting
 * 
 * **Validates: Requirements 1.6, 1.7, 1.8**
 */
export function AutoSplitToggle({ 
  tokenAddress, 
  tokenSymbol,
  tokenDecimals = 6 
}: AutoSplitToggleProps) {
  const chainId = useChainId()
  const { address } = useAccount()
  const addresses = getContractAddresses(chainId)
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [actionType, setActionType] = useState<'enable' | 'disable' | null>(null)

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && addresses?.paymentRouter ? [address, addresses.paymentRouter] : undefined,
    query: {
      enabled: !!address && !!addresses?.paymentRouter,
    },
  })

  // Check if auto-split is enabled in PaymentRouter
  const { data: isAutoSplitEnabled, refetch: refetchAutoSplit } = useReadContract({
    address: addresses?.paymentRouter,
    abi: paymentRouterAbi,
    functionName: 'isAutoSplitEnabled',
    args: address ? [address, tokenAddress] : undefined,
    query: {
      enabled: !!address && !!addresses?.paymentRouter,
    },
  })

  // Token approval
  const { 
    writeContract: approveToken, 
    data: approveHash, 
    isPending: isApprovePending 
  } = useWriteContract()

  // Enable auto-split in PaymentRouter
  const { 
    writeContract: enableAutoSplit, 
    data: enableHash, 
    isPending: isEnablePending 
  } = useWriteContract()

  // Disable auto-split in PaymentRouter
  const { 
    writeContract: disableAutoSplit, 
    data: disableHash, 
    isPending: isDisablePending 
  } = useWriteContract()

  // Wait for approve transaction
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = 
    useWaitForTransactionReceipt({ hash: approveHash })

  // Wait for enable transaction
  const { isLoading: isEnableConfirming, isSuccess: isEnableSuccess } = 
    useWaitForTransactionReceipt({ hash: enableHash })

  // Wait for disable transaction
  const { isLoading: isDisableConfirming, isSuccess: isDisableSuccess } = 
    useWaitForTransactionReceipt({ hash: disableHash })

  // Refetch after successful transactions
  useEffect(() => {
    if (isApproveSuccess || isEnableSuccess || isDisableSuccess) {
      refetchAllowance()
      refetchAutoSplit()
    }
  }, [isApproveSuccess, isEnableSuccess, isDisableSuccess, refetchAllowance, refetchAutoSplit])

  // Determine current status
  const threshold = parseUnits('1000000', tokenDecimals) // 1M tokens
  const hasApproval = allowance && allowance >= threshold
  const isEnabled = isAutoSplitEnabled === true

  // Handle enable flow
  const handleEnable = async () => {
    if (!addresses?.paymentRouter) return

    try {
      // Step 1: Approve unlimited tokens
      if (!hasApproval) {
        await approveToken({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [addresses.paymentRouter, maxUint256],
        })
        // Wait for approval to complete before enabling
        return
      }

      // Step 2: Enable auto-split in PaymentRouter
      await enableAutoSplit({
        address: addresses.paymentRouter,
        abi: paymentRouterAbi,
        functionName: 'enableAutoSplit',
        args: [tokenAddress],
      })
    } catch (error) {
      console.error('Failed to enable auto-split:', error)
    }
  }

  // Handle disable flow
  const handleDisable = async () => {
    if (!addresses?.paymentRouter) return

    try {
      await disableAutoSplit({
        address: addresses.paymentRouter,
        abi: paymentRouterAbi,
        functionName: 'disableAutoSplit',
        args: [tokenAddress],
      })
    } catch (error) {
      console.error('Failed to disable auto-split:', error)
    }
  }

  // Handle toggle click
  const handleToggleClick = () => {
    if (isEnabled) {
      setActionType('disable')
    } else {
      setActionType('enable')
    }
    setShowConfirmDialog(true)
  }

  // Confirm action
  const confirmAction = async () => {
    setShowConfirmDialog(false)
    if (actionType === 'enable') {
      await handleEnable()
    } else if (actionType === 'disable') {
      await handleDisable()
    }
    setActionType(null)
  }

  // Cancel action
  const cancelAction = () => {
    setShowConfirmDialog(false)
    setActionType(null)
  }

  const isPending = isApprovePending || isEnablePending || isDisablePending
  const isConfirming = isApproveConfirming || isEnableConfirming || isDisableConfirming

  if (!address) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
        isEnabled 
          ? 'border-emerald-500/40 bg-emerald-500/10' 
          : 'border-white/10 bg-card/50'
      }`}>
        <div>
          <div className="font-semibold text-foreground">Auto-Split for {tokenSymbol}</div>
          <div className="text-sm text-muted-foreground">
            {isEnabled 
              ? 'Enabled - Payments will be automatically split'
              : 'Disabled - Manual splitting required'}
          </div>
        </div>
        <button
          onClick={handleToggleClick}
          disabled={isPending || isConfirming}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            isEnabled
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isPending || isConfirming
            ? 'Processing...'
            : isEnabled
            ? 'Disable'
            : 'Enable'}
        </button>
      </div>

      {/* Approval Status */}
      {!hasApproval && !isEnabled && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg text-amber-400 text-sm">
          <strong>Note:</strong> Enabling auto-split requires a one-time token approval. 
          You'll be asked to approve unlimited {tokenSymbol} spending for the PaymentRouter contract.
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">
              {actionType === 'enable' ? 'Enable Auto-Split?' : 'Disable Auto-Split?'}
            </h3>
            
            {actionType === 'enable' ? (
              <div className="space-y-3 mb-6">
                <p className="text-muted-foreground">
                  This will enable automatic payment splitting for {tokenSymbol}. 
                </p>
                {!hasApproval && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/40 rounded-lg text-sm text-blue-400">
                    <strong>Step 1:</strong> You'll first approve unlimited {tokenSymbol} spending
                    <br />
                    <strong>Step 2:</strong> Then enable auto-split in the PaymentRouter
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Once enabled, incoming {tokenSymbol} payments will be automatically split 
                  according to your configured ratios without requiring additional approvals.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <p className="text-muted-foreground">
                  This will disable automatic payment splitting for {tokenSymbol}.
                </p>
                <p className="text-sm text-muted-foreground">
                  You'll need to manually split payments after disabling. 
                  For full security, you should also revoke the token approval in your wallet.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={cancelAction}
                className="flex-1 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white transition-colors ${
                  actionType === 'enable'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
