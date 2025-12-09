'use client'

import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { Address, formatUnits, parseUnits } from 'viem'
import { bucketVaultAbi } from '@/lib/contracts/abis'
import { TokenInfo, DepositQuote } from '@/types/multiAsset'

interface DepositQuotePreviewProps {
  vaultAddress: Address
  selectedToken: TokenInfo | null
  depositAmount: string
  slippageTolerance: number
  onQuoteUpdate: (quote: DepositQuote | null) => void
  className?: string
}

export function DepositQuotePreview({
  vaultAddress,
  selectedToken,
  depositAmount,
  slippageTolerance,
  onQuoteUpdate,
  className = '',
}: DepositQuotePreviewProps) {
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)

  // Parse deposit amount
  const depositAmountBigInt =
    selectedToken && depositAmount
      ? parseUnits(depositAmount, selectedToken.decimals)
      : BigInt(0)

  // Get quote from vault
  const {
    data: quoteData,
    isLoading: isLoadingQuoteData,
    error: quoteError,
  } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'quoteDeposit',
    args:
      selectedToken && depositAmountBigInt > BigInt(0)
        ? [selectedToken.address, depositAmountBigInt]
        : undefined,
    query: {
      enabled: !!selectedToken && depositAmountBigInt > BigInt(0),
    },
  })

  // Calculate minimum base asset amount with slippage
  const baseAssetAmount = quoteData ? (quoteData as [bigint, bigint])[0] : BigInt(0)
  const shares = quoteData ? (quoteData as [bigint, bigint])[1] : BigInt(0)
  const minBaseAssetAmount =
    baseAssetAmount > BigInt(0)
      ? (baseAssetAmount * BigInt(10000 - slippageTolerance * 100)) / BigInt(10000)
      : BigInt(0)

  // Update quote when data changes
  useEffect(() => {
    if (selectedToken && depositAmountBigInt > BigInt(0) && quoteData) {
      const quote: DepositQuote = {
        depositToken: selectedToken.address,
        depositAmount: depositAmountBigInt,
        baseAssetAmount,
        shares,
        slippageTolerance,
        minBaseAssetAmount,
      }
      onQuoteUpdate(quote)
    } else {
      onQuoteUpdate(null)
    }
  }, [
    selectedToken,
    depositAmountBigInt,
    quoteData,
    baseAssetAmount,
    shares,
    slippageTolerance,
    minBaseAssetAmount,
    onQuoteUpdate,
  ])

  // Show loading state
  useEffect(() => {
    setIsLoadingQuote(isLoadingQuoteData)
  }, [isLoadingQuoteData])

  if (!selectedToken || !depositAmount || depositAmountBigInt === BigInt(0)) {
    return null
  }

  // Calculate price impact (simplified)
  const priceImpact =
    baseAssetAmount > BigInt(0) && depositAmountBigInt > BigInt(0)
      ? Number(
          ((depositAmountBigInt - baseAssetAmount) * BigInt(10000)) / depositAmountBigInt
        ) / 100
      : 0

  return (
    <div className={`glass border border-white/10 rounded-lg p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Quote Preview</span>
        {isLoadingQuote && (
          <div className="flex items-center gap-2 text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span>Fetching quote...</span>
          </div>
        )}
      </div>

      {quoteError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-md">
          Error fetching quote. Please try again.
        </div>
      )}

      {!isLoadingQuote && quoteData && (
        <>
          {/* Base Asset Amount */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Expected Base Asset</span>
            <span className="text-sm font-medium text-foreground">
              {formatUnits(baseAssetAmount, 18).slice(0, 10)} USDC
            </span>
          </div>

          {/* Shares to Receive */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Shares to Receive</span>
            <span className="text-sm font-medium text-foreground">
              {formatUnits(shares, 18).slice(0, 10)}
            </span>
          </div>

          {/* Slippage Tolerance */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
            <span className="text-sm font-medium text-foreground">{slippageTolerance}%</span>
          </div>

          {/* Minimum Received */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Minimum Base Asset</span>
            <span className="text-sm font-medium text-foreground">
              {formatUnits(minBaseAssetAmount, 18).slice(0, 10)} USDC
            </span>
          </div>

          {/* Price Impact */}
          {!selectedToken.isNative && selectedToken.address !== vaultAddress && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price Impact</span>
              <span
                className={`text-sm font-medium ${
                  Math.abs(priceImpact) > 5
                    ? 'text-red-400'
                    : Math.abs(priceImpact) > 2
                    ? 'text-yellow-400'
                    : 'text-emerald-400'
                }`}
              >
                {priceImpact > 0 ? '+' : ''}
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Swap Route Info */}
          {!selectedToken.isNative && selectedToken.address !== vaultAddress && (
            <div className="pt-3 border-t border-white/10">
              <div className="text-xs text-muted-foreground mb-2">Swap Route</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 glass rounded border border-white/10 font-medium text-foreground">
                  {selectedToken.symbol}
                </span>
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="px-2 py-1 glass rounded border border-white/10 font-medium text-foreground">
                  USDC
                </span>
              </div>
            </div>
          )}

          {/* Warning for high slippage */}
          {Math.abs(priceImpact) > 5 && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-md">
              ⚠️ High price impact detected. Consider reducing deposit amount.
            </div>
          )}
        </>
      )}
    </div>
  )
}
