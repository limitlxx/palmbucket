'use client'

import { Component, ReactNode } from 'react'
import { BaseError } from 'wagmi'

interface WagmiErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: any) => void
}

interface WagmiErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary specifically designed for wagmi hook failures
 * Provides user-friendly error messages and retry functionality
 */
export class WagmiErrorBoundary extends Component<WagmiErrorBoundaryProps, WagmiErrorBoundaryState> {
  constructor(props: WagmiErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): WagmiErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error for monitoring
    console.error('WagmiErrorBoundary caught an error:', error, errorInfo)
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to external error tracking service if available
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        context: 'WagmiErrorBoundary',
        errorInfo,
      })
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  getUserFriendlyMessage(error: Error): string {
    // Parse wagmi/viem errors
    if (error instanceof BaseError) {
      const message = (error as any).shortMessage || error.message

      // Common error patterns
      if (message.includes('User rejected') || message.includes('user rejected')) {
        return 'Transaction was rejected. Please try again when ready.'
      }
      if (message.includes('insufficient funds')) {
        return 'Insufficient funds to complete this transaction. Please check your balance.'
      }
      if (message.includes('gas')) {
        return 'Unable to estimate gas. The transaction may fail or the network may be congested.'
      }
      if (message.includes('nonce')) {
        return 'Transaction ordering issue detected. Please refresh the page and try again.'
      }
      if (message.includes('network') || message.includes('connection')) {
        return 'Network connection issue. Please check your internet connection and try again.'
      }
      if (message.includes('Chain mismatch')) {
        return 'Wrong network detected. Please switch to Mantle Network in your wallet.'
      }
      if (message.includes('Contract')) {
        return 'Smart contract interaction failed. The contract may be paused or unavailable.'
      }

      return message
    }

    // Handle RPC errors
    if (error.message.includes('RPC')) {
      return 'Unable to connect to blockchain network. Please try again in a moment.'
    }

    // Handle wallet connection errors
    if (error.message.includes('wallet') || error.message.includes('Wallet')) {
      return 'Wallet connection issue. Please reconnect your wallet and try again.'
    }

    return error.message || 'An unexpected error occurred'
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      // Default fallback UI
      const userMessage = this.getUserFriendlyMessage(this.state.error)

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Something went wrong
                </h3>
                <p className="text-sm text-red-700 mb-4">{userMessage}</p>
                <div className="flex gap-3">
                  <button
                    onClick={this.reset}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4">
                    <summary className="text-xs text-red-600 cursor-pointer hover:text-red-700">
                      Technical Details
                    </summary>
                    <pre className="mt-2 text-xs text-red-800 bg-red-100 p-2 rounded overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
