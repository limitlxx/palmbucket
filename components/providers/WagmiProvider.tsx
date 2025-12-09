'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { wagmiConfig } from '@/lib/wagmi'
import { ReactNode, useState } from 'react'
import { WagmiErrorBoundary, RainbowKitErrorBoundary } from '@/components/errors'

interface Props {
  children: ReactNode
}

export function Providers({ children }: Props) {
  // Configure QueryClient with error handling and logging
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 3,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          staleTime: 5000,
        },
        mutations: {
          retry: 1,
        },
      },
    })

    // Add global error handler
    client.getQueryCache().config.onError = (error) => {
      console.error('Query error:', error)
      // Log to external error tracking if available
      if (typeof window !== 'undefined' && (window as any).errorTracker) {
        (window as any).errorTracker.captureException(error, {
          context: 'ReactQuery',
        })
      }
    }

    client.getMutationCache().config.onError = (error) => {
      console.error('Mutation error:', error)
      // Log to external error tracking if available
      if (typeof window !== 'undefined' && (window as any).errorTracker) {
        (window as any).errorTracker.captureException(error, {
          context: 'ReactQueryMutation',
        })
      }
    }

    return client
  })

  return (
    <RainbowKitErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <WagmiErrorBoundary>
              {children}
            </WagmiErrorBoundary>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </RainbowKitErrorBoundary>
  )
}