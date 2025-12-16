'use client'

import { useYieldCompounding, CompoundingEvent } from '@/lib/hooks/useYieldCompounding'
import { Address, formatUnits } from 'viem'
import { useState } from 'react'

interface CompoundingDisplayProps {
  vaultAddresses: Address[]
  vaultNames?: Record<Address, string>
}

/**
 * Component for displaying yield compounding controls and history
 * Shows compounding events, allows manual compounding, and tracks total yields
 */
export function CompoundingDisplay({ vaultAddresses, vaultNames = {} }: CompoundingDisplayProps) {
  const {
    compoundVault,
    compoundAllVaults,
    compoundingHistory,
    getTotalCompounded,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  } = useYieldCompounding(vaultAddresses)

  const [selectedVault, setSelectedVault] = useState<Address | null>(null)

  const handleCompoundVault = (vaultAddress: Address) => {
    setSelectedVault(vaultAddress)
    compoundVault(vaultAddress)
  }

  const handleCompoundAll = () => {
    setSelectedVault(null)
    compoundAllVaults()
  }

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleString()
  }

  const getVaultName = (address: Address) => {
    return vaultNames[address] || `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const totalCompounded = getTotalCompounded()

  return (
    <div className="space-y-6">
      {/* Compounding Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Yield Compounding</h2>
        
        <div className="space-y-4">
          {/* Total Compounded Display */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Total Compounded</div>
            <div className="text-2xl font-bold text-green-700">
              ${formatUnits(totalCompounded, 6)} USDC
            </div>
          </div>

          {/* Individual Vault Compound Buttons */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Compound Individual Vaults</h3>
            {vaultAddresses.map((vaultAddress) => (
              <button
                key={vaultAddress}
                onClick={() => handleCompoundVault(vaultAddress)}
                disabled={isPending || isConfirming}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isPending && selectedVault === vaultAddress
                  ? 'Waiting for approval...'
                  : isConfirming && selectedVault === vaultAddress
                  ? 'Confirming...'
                  : `Compound ${getVaultName(vaultAddress)}`}
              </button>
            ))}
          </div>

          {/* Compound All Button */}
          <button
            onClick={handleCompoundAll}
            disabled={isPending || isConfirming}
            className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isPending && !selectedVault
              ? 'Waiting for approval...'
              : isConfirming && !selectedVault
              ? 'Confirming...'
              : 'Compound All Vaults'}
          </button>

          {/* Success Message */}
          {isConfirmed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              ✓ Yield compounded successfully!
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Error: {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Compounding History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Compounding History</h2>
        
        {compoundingHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No compounding events yet. Compound your yield to see history here.
          </div>
        ) : (
          <div className="space-y-3">
            {compoundingHistory.map((event, index) => (
              <div
                key={`${event.txHash}-${index}`}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">
                      {getVaultName(event.vaultAddress)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatTimestamp(event.timestamp)}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      Tx: {event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">
                      +${formatUnits(event.amount, 6)}
                    </div>
                    <div className="text-xs text-gray-500">USDC</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}