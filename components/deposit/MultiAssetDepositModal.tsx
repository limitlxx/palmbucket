'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Address, parseUnits } from 'viem'
import { bucketVaultAbi, erc20Abi } from '@/lib/contracts/abis'
import { TokenInfo, DepositQuote } from '@/types/multiAsset'
import { TokenSelector } from './TokenSelector'
import { DepositQuotePreview } from './DepositQuotePreview'
import { SlippageSettings } from './SlippageSettings'
import { useMultiAssetDepositError, MultiAssetDepositErrorDisplay } from '@/components/errors'

interface MultiAssetDepositModalProps {
  vaultAddress: Address
  vaultName: string
  isOpen: boolean
  onClose: () => void
}

export function MultiAssetDepositModal({
  vaultAddress,
  vaultName,
  isOpen,
  onClose,
}: MultiAssetDepositModalProps) {
  const { address } = useAccount()
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [quote, setQuote] = useState<DepositQuote | null>(null)
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [step, setStep] = useState<'input' | 'approve' | 'deposit' | 'success'>('input')
  const [error, setError] = useState<Error | null>(null)

  const { writeContract: writeApprove, data: approveHash, error: approveError } = useWriteContract()
  const { writeContract: writeDeposit, data: depositHash, error: depositError } = useWriteContract()
  const { writeContract: writeDepositETH, data: depositETHHash, error: depositETHError } = useWriteContract()
  
  // Use enhanced error handler
  const { depositError: parsedError, clearError } = useMultiAssetDepositError(
    error || approveError || depositError || depositETHError
  )

  // Check token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedToken?.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && selectedToken && !selectedToken.isNative ? [address, vaultAddress] : undefined,
    query: {
      enabled: !!address && !!selectedToken && !selectedToken.isNative,
    },
  })

  // Wait for approve transaction
  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // Wait for deposit transaction
  const { isLoading: isDepositPending, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash || depositETHHash,
  })

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedToken(null)
      setDepositAmount('')
      setQuote(null)
      setStep('input')
      setError(null)
      clearError()
    }
  }, [isOpen, clearError])

  // Move to deposit step after approval
  useEffect(() => {
    if (isApproveSuccess && step === 'approve') {
      refetchAllowance()
      setStep('deposit')
    }
  }, [isApproveSuccess, step, refetchAllowance])

  // Move to success step after deposit
  useEffect(() => {
    if (isDepositSuccess && step === 'deposit') {
      setStep('success')
    }
  }, [isDepositSuccess, step])

  const handleMaxClick = () => {
    if (selectedToken) {
      const maxAmount = selectedToken.balance
      setDepositAmount(
        (Number(maxAmount) / 10 ** selectedToken.decimals).toString()
      )
    }
  }

  const handleApprove = async () => {
    if (!selectedToken || !quote || selectedToken.isNative) return

    try {
      setError(null)
      clearError()
      setStep('approve')
      
      writeApprove({
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [vaultAddress, quote.depositAmount],
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Approval failed'))
      setStep('input')
    }
  }

  const handleDeposit = async () => {
    if (!selectedToken || !quote || !address) return

    try {
      setError(null)
      clearError()
      setStep('deposit')

      if (selectedToken.isNative) {
        // Deposit ETH
        writeDepositETH({
          address: vaultAddress,
          abi: bucketVaultAbi,
          functionName: 'depositETH',
          args: [quote.minBaseAssetAmount, address],
          value: quote.depositAmount,
        })
      } else {
        // Deposit ERC20 with swap
        writeDeposit({
          address: vaultAddress,
          abi: bucketVaultAbi,
          functionName: 'depositWithSwap',
          args: [
            selectedToken.address,
            quote.depositAmount,
            quote.minBaseAssetAmount,
            address,
          ],
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Deposit failed'))
      setStep('input')
    }
  }

  const handleSubmit = async () => {
    if (!selectedToken || !quote) return

    // Check if approval is needed
    if (!selectedToken.isNative) {
      const currentAllowance = allowance as bigint | undefined
      if (!currentAllowance || currentAllowance < quote.depositAmount) {
        await handleApprove()
        return
      }
    }

    // Proceed directly to deposit
    await handleDeposit()
  }

  const isFormValid =
    selectedToken &&
    depositAmount &&
    parseFloat(depositAmount) > 0 &&
    quote &&
    parseUnits(depositAmount, selectedToken.decimals) <= selectedToken.balance

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Deposit to {vaultName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {step === 'success' ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Deposit Successful!</h3>
              <p className="text-sm text-gray-600 mb-6">
                Your funds have been deposited to {vaultName}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Token Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Token
                </label>
                <TokenSelector
                  vaultAddress={vaultAddress}
                  selectedToken={selectedToken}
                  onTokenSelect={setSelectedToken}
                />
              </div>

              {/* Amount Input */}
              {selectedToken && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Amount
                    </label>
                    <button
                      onClick={handleMaxClick}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      step="any"
                      min="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-600">
                      {selectedToken.symbol}
                    </span>
                  </div>
                  {parseUnits(depositAmount || '0', selectedToken.decimals) > selectedToken.balance && (
                    <p className="mt-1 text-xs text-red-600">Insufficient balance</p>
                  )}
                </div>
              )}

              {/* Slippage Settings */}
              {selectedToken && depositAmount && (
                <div className="flex justify-end">
                  <SlippageSettings
                    slippageTolerance={slippageTolerance}
                    onSlippageChange={setSlippageTolerance}
                  />
                </div>
              )}

              {/* Quote Preview */}
              {selectedToken && depositAmount && (
                <DepositQuotePreview
                  vaultAddress={vaultAddress}
                  selectedToken={selectedToken}
                  depositAmount={depositAmount}
                  slippageTolerance={slippageTolerance}
                  onQuoteUpdate={setQuote}
                />
              )}

              {/* Error Message */}
              {parsedError && (
                <MultiAssetDepositErrorDisplay
                  error={parsedError}
                  onRetry={() => {
                    clearError()
                    setError(null)
                    if (step === 'approve') {
                      handleApprove()
                    } else if (step === 'deposit') {
                      handleDeposit()
                    }
                  }}
                  onDismiss={() => {
                    clearError()
                    setError(null)
                  }}
                />
              )}

              {/* Action Button */}
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || isApprovePending || isDepositPending}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApprovePending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Approving...
                  </span>
                ) : isDepositPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Depositing...
                  </span>
                ) : step === 'approve' ? (
                  'Approve Token'
                ) : (
                  'Deposit'
                )}
              </button>

              {/* Info Text */}
              {selectedToken && !selectedToken.isNative && (
                <p className="text-xs text-gray-500 text-center">
                  {allowance && quote && (allowance as bigint) >= quote.depositAmount
                    ? 'Token approved. Click to deposit.'
                    : 'You need to approve the token before depositing.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
