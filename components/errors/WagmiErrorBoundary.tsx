'use client'

import { Component, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
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
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
          {/* Background gradient orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 -left-4 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
            <div className="absolute top-0 -right-4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
          </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 max-w-md w-full glass p-8"
          >
            <div className="flex items-start gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/40"
              >
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </motion.div>
              <div className="flex-1">
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-semibold text-foreground mb-2"
                >
                  Something went wrong
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm text-muted-foreground mb-4 leading-relaxed"
                >
                  {userMessage}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex gap-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={this.reset}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 border border-white/20 text-foreground rounded-lg text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Refresh
                  </motion.button>
                </motion.div>
                {process.env.NODE_ENV === 'development' && (
                  <motion.details
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4"
                  >
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      Technical Details
                    </summary>
                    <pre className="mt-2 text-xs text-muted-foreground bg-black/20 border border-white/10 p-3 rounded-lg overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  </motion.details>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}
