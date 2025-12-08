'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

/**
 * Wallet connection button component using RainbowKit
 * Provides beautiful UI for wallet connection with:
 * - Popular wallet options (MetaMask, WalletConnect, Coinbase Wallet, etc.)
 * - Network switching functionality
 * - ENS name and avatar support
 * - Wallet disconnection handling
 */
export function WalletConnectButton() {
  return (
    <ConnectButton 
      chainStatus="icon"
      showBalance={true}
      accountStatus={{
        smallScreen: 'avatar',
        largeScreen: 'full',
      }}
    />
  )
}