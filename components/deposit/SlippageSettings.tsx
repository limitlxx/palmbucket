'use client'

import { useState } from 'react'

interface SlippageSettingsProps {
  slippageTolerance: number
  onSlippageChange: (slippage: number) => void
  className?: string
}

const PRESET_SLIPPAGES = [0.1, 0.5, 1.0]

export function SlippageSettings({
  slippageTolerance,
  onSlippageChange,
  className = '',
}: SlippageSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customSlippage, setCustomSlippage] = useState('')

  const handlePresetClick = (slippage: number) => {
    onSlippageChange(slippage)
    setCustomSlippage('')
  }

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value)
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      onSlippageChange(numValue)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-card/50 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Slippage: {slippageTolerance}%</span>
      </button>

      {isOpen && (
        <>
          <div className="absolute right-0 mt-2 w-72 glass border border-white/10 rounded-lg shadow-lg p-4 z-50">
            <div className="mb-3">
              <div className="text-sm font-medium text-foreground mb-2">Slippage Tolerance</div>
              <div className="text-xs text-muted-foreground mb-3">
                Your transaction will revert if the price changes unfavorably by more than this percentage.
              </div>
            </div>

            {/* Preset Options */}
            <div className="flex gap-2 mb-3">
              {PRESET_SLIPPAGES.map(preset => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    slippageTolerance === preset && !customSlippage
                      ? 'bg-blue-500 text-white'
                      : 'glass border border-white/10 text-foreground hover:bg-card/50'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="relative">
              <input
                type="number"
                placeholder="Custom"
                value={customSlippage}
                onChange={e => handleCustomSlippageChange(e.target.value)}
                min="0"
                max="50"
                step="0.1"
                className="w-full px-3 py-2 pr-8 glass border border-white/10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground placeholder:text-muted-foreground"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>

            {/* Warning for high slippage */}
            {slippageTolerance > 5 && (
              <div className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-2 rounded-md">
                ⚠️ High slippage tolerance may result in unfavorable trades
              </div>
            )}

            {/* Warning for very low slippage */}
            {slippageTolerance < 0.1 && slippageTolerance > 0 && (
              <div className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-2 rounded-md">
                ⚠️ Very low slippage may cause transaction failures
              </div>
            )}
          </div>

          {/* Overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  )
}
