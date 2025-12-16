'use client'

import { Component, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Wallet, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react'

interface RainbowKitErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface RainbowKitErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary specifically for RainbowKit wallet connection errors
 * Provides graceful fallback UI when wallet connection fails
 */
export class RainbowKitErrorBoundary extends Component<
  RainbowKitErrorBoundaryProps,
  RainbowKitErrorBoundaryState
> {
  constructor(props: RainbowKitErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): RainbowKitErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('RainbowKitErrorBoundary caught an error:', error, errorInfo)

    // Log to external error tracking
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.captureException(error, {
        context: 'RainbowKitErrorBoundary',
        errorInfo,
      })
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
          {/* Background gradient orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 -left-4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
            <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-20 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
          </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 max-w-md w-full glass p-8"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-orange-500/40"
              >
                <Wallet className="w-8 h-8 text-orange-400" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-foreground mb-3"
              >
                Wallet Connection Issue
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-6 leading-relaxed"
              >
                We encountered a problem connecting to your wallet. This might be due to:
              </motion.p>
              <motion.ul
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-left text-sm text-muted-foreground mb-6 space-y-2"
              >
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span>Your wallet extension is not installed or enabled</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span>Browser compatibility issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span>Network connectivity problems</span>
                </li>
              </motion.ul>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.reset}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Try Again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-3 border border-white/20 text-foreground rounded-lg font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </motion.button>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 text-xs text-muted-foreground"
              >
                Need help?{' '}
                <a
                  href="https://learn.rainbow.me/connect-your-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                >
                  Learn how to connect your wallet
                  <ExternalLink className="w-3 h-3" />
                </a>
              </motion.p>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}
