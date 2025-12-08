'use client'

import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { mantle, mantleSepoliaTestnet } from 'wagmi/chains'
import { useEffect, useState } from 'react'

/**
 * Wallet status display component
 * Shows connection status, balance, and network information
 * Provides network switching functionality for Mantle Network
 */
export function WalletStatus() {
  const { address, isConnected, isConnecting, isDisconnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [mounted, setMounted] = useState(false)

  // Get balance for connected address
  const { data: balance } = useBalance({
    address: address,
  })

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  if (isDisconnected) {
    return (
      <div className="text-sm text-gray-500">
        Wallet not connected
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className="text-sm text-gray-500">
        Connecting wallet...
      </div>
    )
  }

  if (!isConnected || !address) {
    return null
  }

  const isCorrectNetwork = chainId === mantle.id || chainId === mantleSepoliaTestnet.id
  const currentNetwork = chainId === mantle.id ? 'Mantle' : 
                        chainId === mantleSepoliaTestnet.id ? 'Mantle Sepolia' : 
                        'Unknown Network'

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <span className="text-gray-500">Address:</span>{' '}
        <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
      </div>
      
      {balance && (
        <div className="text-sm">
          <span className="text-gray-500">Balance:</span>{' '}
          <span className="font-semibold">
            {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
          </span>
        </div>
      )}

      <div className="text-sm">
        <span className="text-gray-500">Network:</span>{' '}
        <span className={isCorrectNetwork ? 'text-green-600' : 'text-red-600'}>
          {currentNetwork}
        </span>
      </div>

      {!isCorrectNetwork && switchChain && (
        <div className="space-y-1">
          <p className="text-xs text-red-600">
            Please switch to Mantle Network
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => switchChain({ chainId: mantleSepoliaTestnet.id })}
              className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Switch to Sepolia
            </button>
            <button
              onClick={() => switchChain({ chainId: mantle.id })}
              className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Switch to Mainnet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
