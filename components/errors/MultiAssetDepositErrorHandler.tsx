'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, RefreshCw, X, ArrowLeftRight, Wifi, AlertCircle } from 'lucide-react'
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
        return <ArrowLeftRight className="w-6 h-6" />
      case 'network':
        return <Wifi className="w-6 h-6" />
      default:
        return <AlertCircle className="w-6 h-6" />
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="glass bg-red-500/10 border border-red-500/40 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="flex-shrink-0 text-red-400"
          >
            {getErrorIcon()}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-semibold text-foreground">{error.userMessage}</h4>
              {onDismiss && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onDismiss}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </div>
            {error.suggestedAction && (
              <p className="text-xs text-muted-foreground mb-3">{error.suggestedAction}</p>
            )}
            <div className="flex gap-2">
              {error.canRetry && onRetry && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onRetry}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Try Again
                </motion.button>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground bg-black/20 border border-white/10 p-2 rounded-lg overflow-auto max-h-32">
                  {error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
