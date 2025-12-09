'use client'

import { useEffect, useState } from 'react'
import { BaseError } from 'wagmi'

interface MultiAssetDepositError {
  type: 'swap' | 'approval' | 'deposit' | 'quote' | 'network' | 'unknown'
  message: string
  userMessage: string
  canRetry: boolean
  suggestedAction?: string
}

/**
 * Hook for handling multi-asset deposit errors with detailed error categorization
 */
export function useMultiAssetDepositError(error: Error | null) {
  const [depositError, setDepositError] = useState<MultiAssetDepositError | null>(null)

  useEffect(() => {
    if (!error) {
      setDepositError(null)
      return
    }

    const parsedError = parseDepositError(error)
    setDepositError(parsedError)
  }, [error])

  const clearError = () => setDepositError(null)

  return {
    depositError,
    hasError: !!depositError,
    clearError,
  }
}

function parseDepositError(error: Error): MultiAssetDepositError {
  const errorMessage = error.message.toLowerCase()

  // Swap-related errors
  if (
    errorMessage.includes('swap') ||
    errorMessage.includes('slippage') ||
    errorMessage.includes('insufficient output amount')
  ) {
    return {
      type: 'swap',
      message: error.message,
      userMessage: 'Token swap failed due to slippage or liquidity issues',
      canRetry: true,
      suggestedAction: 'Try increasing slippage tolerance or reducing deposit amount',
    }
  }

  // Approval errors
  if (errorMessage.includes('approval') || errorMessage.includes('allowance')) {
    return {
      type: 'approval',
      message: error.message,
      userMessage: 'Token approval failed',
      canRetry: true,
      suggestedAction: 'Please approve the token again',
    }
  }

  // Deposit errors
  if (errorMessage.includes('deposit')) {
    return {
      type: 'deposit',
      message: error.message,
      userMessage: 'Deposit transaction failed',
      canRetry: true,
      suggestedAction: 'Check your balance and try again',
    }
  }

  // Quote/preview errors
  if (errorMessage.includes('quote') || errorMessage.includes('preview')) {
    return {
      type: 'quote',
      message: error.message,
      userMessage: 'Unable to calculate deposit preview',
      canRetry: true,
      suggestedAction: 'The DEX may be unavailable. Try again in a moment.',
    }
  }

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('rpc') || errorMessage.includes('connection')) {
    return {
      type: 'network',
      message: error.message,
      userMessage: 'Network connection issue',
      canRetry: true,
      suggestedAction: 'Check your internet connection and try again',
    }
  }

  // Parse wagmi errors
  if (error instanceof BaseError) {
    const message = (error as any).shortMessage || error.message

    if (message.includes('User rejected')) {
      return {
        type: 'unknown',
        message: error.message,
        userMessage: 'Transaction was rejected',
        canRetry: true,
        suggestedAction: 'Please approve the transaction in your wallet',
      }
    }

    if (message.includes('insufficient funds')) {
      return {
        type: 'unknown',
        message: error.message,
        userMessage: 'Insufficient funds for transaction',
        canRetry: false,
        suggestedAction: 'Add more funds to your wallet',
      }
    }
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: error.message,
    userMessage: 'An unexpected error occurred during deposit',
    canRetry: true,
    suggestedAction: 'Please try again or contact support if the issue persists',
  }
}

interface MultiAssetDepositErrorDisplayProps {
  error: MultiAssetDepositError | null
  onRetry?: () => void
  onDismiss?: () => void
}

/**
 * Component for displaying multi-asset deposit errors with actionable suggestions
 */
export function MultiAssetDepositErrorDisplay({
  error,
  onRetry,
  onDismiss,
}: MultiAssetDepositErrorDisplayProps) {
  if (!error) return null

  const getErrorIcon = () => {
    switch (error.type) {
      case 'swap':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        )
      case 'network':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
          </svg>
        )
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
    }
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-red-600">{getErrorIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-900 mb-1">{error.userMessage}</h4>
          {error.suggestedAction && (
            <p className="text-xs text-red-700 mb-3">{error.suggestedAction}</p>
          )}
          <div className="flex gap-2">
            {error.canRetry && onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 bg-white text-red-600 border border-red-300 text-xs font-medium rounded hover:bg-red-50 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer hover:text-red-700">
                Technical Details
              </summary>
              <pre className="mt-1 text-xs text-red-800 bg-red-100 p-2 rounded overflow-auto max-h-32">
                {error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
