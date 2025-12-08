'use client'

import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'

/**
 * Wallet information component
 * Displays wallet address with formatted display
 * Note: ENS support can be added when needed for mainnet deployment
 */
export function WalletInfo() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isConnected || !address) {
    return null
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow">
      <div className="flex-1">
        <div className="font-mono text-sm text-gray-900">
          {address.slice(0, 10)}...{address.slice(-8)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Connected Wallet
        </div>
      </div>
    </div>
  )
}
