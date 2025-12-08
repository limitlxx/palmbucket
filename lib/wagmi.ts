import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mantle, mantleSepoliaTestnet } from 'wagmi/chains'
import { http } from 'wagmi'

// Define Mantle network configurations with RainbowKit
// This configuration includes popular wallet options (MetaMask, WalletConnect, Coinbase Wallet, etc.)
export const wagmiConfig = getDefaultConfig({
  appName: 'PalmBudget',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mantleSepoliaTestnet, mantle],
  transports: {
    [mantleSepoliaTestnet.id]: http(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL),
    [mantle.id]: http(process.env.NEXT_PUBLIC_MANTLE_MAINNET_RPC_URL),
  },
  ssr: true, // Enable server side rendering support
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}