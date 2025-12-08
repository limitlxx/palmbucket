import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mantle, mantleSepoliaTestnet } from 'wagmi/chains'

// Define Mantle network configurations with RainbowKit
export const wagmiConfig = getDefaultConfig({
  appName: 'PalmBudget',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mantleSepoliaTestnet, mantle],
  ssr: true, // If your dApp uses server side rendering (SSR)
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}