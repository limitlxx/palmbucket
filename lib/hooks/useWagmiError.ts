import { useEffect, useState } from 'react'
import { BaseError } from 'wagmi'

/**
 * Custom hook for handling wagmi errors with user-friendly messages
 * Provides error parsing and notification capabilities
 */
export function useWagmiError(error: Error | null) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!error) {
      setErrorMessage(null)
      return
    }

    // Parse wagmi/viem errors
    if (error instanceof BaseError) {
      const revertError = error.walk(err => err instanceof BaseError)
      
      if (revertError) {
        // Extract user-friendly error message
        const message = revertError.shortMessage || revertError.message
        
        // Common error patterns
        if (message.includes('User rejected')) {
          setErrorMessage('Transaction was rejected by user')
        } else if (message.includes('insufficient funds')) {
          setErrorMessage('Insufficient funds for transaction')
        } else if (message.includes('gas')) {
          setErrorMessage('Gas estimation failed. Please try again.')
        } else if (message.includes('nonce')) {
          setErrorMessage('Transaction nonce error. Please refresh and try again.')
        } else {
          setErrorMessage(message)
        }
      } else {
        setErrorMessage(error.message)
      }
    } else {
      setErrorMessage(error.message)
    }
  }, [error])

  const clearError = () => setErrorMessage(null)

  return {
    errorMessage,
    hasError: !!errorMessage,
    clearError,
  }
}
