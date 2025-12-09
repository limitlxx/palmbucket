import { useEffect, useState } from 'react'
import { BaseError } from 'wagmi'

/**
 * Custom hook for handling wagmi errors with user-friendly messages
 * Provides error parsing, logging, and notification capabilities
 */
export function useWagmiError(error: Error | null) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!error) {
      setErrorMessage(null)
      return
    }

    // Log error for monitoring
    console.error('Wagmi error occurred:', error)
    
    // Log to external error tracking service if available
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        context: 'useWagmiError',
      })
    }

    // Parse wagmi/viem errors
    if (error instanceof BaseError) {
      const revertError = error.walk(err => err instanceof BaseError) as BaseError | null
      
      if (revertError) {
        // Extract user-friendly error message
        const message = (revertError as any).shortMessage || revertError.message
        
        // Common error patterns
        if (message.includes('User rejected') || message.includes('user rejected')) {
          setErrorMessage('Transaction was rejected by user')
        } else if (message.includes('insufficient funds')) {
          setErrorMessage('Insufficient funds for transaction')
        } else if (message.includes('gas')) {
          setErrorMessage('Gas estimation failed. Please try again.')
        } else if (message.includes('nonce')) {
          setErrorMessage('Transaction nonce error. Please refresh and try again.')
        } else if (message.includes('network') || message.includes('connection')) {
          setErrorMessage('Network connection issue. Please check your connection.')
        } else if (message.includes('Chain mismatch')) {
          setErrorMessage('Wrong network. Please switch to Mantle Network.')
        } else {
          setErrorMessage(message)
        }
      } else {
        setErrorMessage(error.message)
      }
    } else {
      // Handle non-wagmi errors
      if (error.message.includes('RPC')) {
        setErrorMessage('Unable to connect to blockchain. Please try again.')
      } else if (error.message.includes('wallet') || error.message.includes('Wallet')) {
        setErrorMessage('Wallet connection issue. Please reconnect your wallet.')
      } else {
        setErrorMessage(error.message)
      }
    }
  }, [error])

  const clearError = () => setErrorMessage(null)

  return {
    errorMessage,
    hasError: !!errorMessage,
    clearError,
  }
}
