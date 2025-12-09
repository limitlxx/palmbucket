"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi"
import { Address, parseUnits } from "viem"
import { erc20Abi } from "@/lib/contracts/abis"

interface TokenConfig {
  name: string
  symbol: string
  address: Address
  decimals: number
  icon: string
  defaultAmount: string
}

export function MintTokensInterface() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [selectedToken, setSelectedToken] = useState<TokenConfig | null>(null)
  const [mintAmount, setMintAmount] = useState("")
  const [showTokenSelector, setShowTokenSelector] = useState(false)

  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Token configurations
  const TOKENS: TokenConfig[] = [
    {
      name: "Mock USDC",
      symbol: "USDC",
      address: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as Address || "0x186B110dD3A58f6160B1E2C24D02Cc34715ABF60",
      decimals: 6,
      icon: "🪙",
      defaultAmount: "1000",
    },
    {
      name: "Mock USDY",
      symbol: "USDY",
      address: "0xb250b35A80a82B352C83ECe42B471203115d9db7" as Address,
      decimals: 18,
      icon: "💵",
      defaultAmount: "1000",
    },
    {
      name: "Mock mETH",
      symbol: "mETH",
      address: "0xc5d8834c902C3bd82EF265F1400480EAC3BCd7E1" as Address,
      decimals: 18,
      icon: "⟠",
      defaultAmount: "10",
    },
  ]

  const handleMint = async () => {
    if (!selectedToken || !mintAmount || !address) return

    try {
      const amount = parseUnits(mintAmount, selectedToken.decimals)
      
      writeContract({
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: "mint",
        args: [address, amount],
      })
    } catch (err) {
      console.error("Mint failed:", err)
    }
  }

  const handleQuickMint = (token: TokenConfig) => {
    setSelectedToken(token)
    setMintAmount(token.defaultAmount)
    setTimeout(() => {
      if (address) {
        const amount = parseUnits(token.defaultAmount, token.decimals)
        writeContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "mint",
          args: [address, amount],
        })
      }
    }, 100)
  }

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Please connect your wallet to mint test tokens
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Mint Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Quick Mint</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOKENS.map((token) => (
            <button
              key={token.symbol}
              onClick={() => handleQuickMint(token)}
              disabled={isPending || isConfirming}
              className="p-4 bg-background border border-white/10 rounded-lg hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">{token.icon}</div>
                <div className="font-semibold text-foreground mb-1">{token.symbol}</div>
                <div className="text-sm text-muted-foreground mb-2">{token.name}</div>
                <div className="text-xs text-emerald-400 font-semibold">
                  Mint {token.defaultAmount} {token.symbol}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-card text-muted-foreground">or custom amount</span>
        </div>
      </div>

      {/* Custom Mint Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Custom Mint</h2>
        
        {/* Token Selector */}
        <div className="mb-4">
          <label className="text-muted-foreground text-sm mb-2 block">Select Token</label>
          <div className="relative">
            <button
              onClick={() => setShowTokenSelector(!showTokenSelector)}
              className="w-full px-4 py-3 bg-background border border-white/10 rounded-lg text-foreground flex items-center justify-between hover:border-white/20 transition-colors"
            >
              {selectedToken ? (
                <span className="flex items-center gap-2">
                  <span>{selectedToken.icon}</span>
                  <span>{selectedToken.symbol}</span>
                  <span className="text-muted-foreground text-sm">({selectedToken.name})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select a token</span>
              )}
              <span>▼</span>
            </button>

            {showTokenSelector && (
              <div className="absolute top-full mt-2 w-full bg-card border border-white/10 rounded-lg overflow-hidden z-10">
                {TOKENS.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setSelectedToken(token)
                      setMintAmount(token.defaultAmount)
                      setShowTokenSelector(false)
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-background transition-colors flex items-center gap-3 border-b border-white/10 last:border-b-0"
                  >
                    <span className="text-2xl">{token.icon}</span>
                    <div>
                      <div className="text-foreground font-medium">{token.symbol}</div>
                      <div className="text-muted-foreground text-xs">{token.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount Input */}
        {selectedToken && (
          <div className="mb-4">
            <label className="text-muted-foreground text-sm mb-2 block">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-background border border-white/10 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                {selectedToken.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Mint Button */}
        <button
          onClick={handleMint}
          disabled={!selectedToken || !mintAmount || isPending || isConfirming}
          className="w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              {isPending ? "Minting..." : "Confirming..."}
            </span>
          ) : (
            "Mint Tokens"
          )}
        </button>
      </div>

      {/* Status Messages */}
      {isSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-emerald-400 font-medium">
            ✅ Successfully minted {mintAmount} {selectedToken?.symbol}!
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 font-medium">
            ❌ Error: {error.message}
          </p>
        </div>
      )}

      {/* Info Section */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h3 className="text-blue-400 font-semibold mb-2">ℹ️ About Test Tokens</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• These are test tokens for development purposes only</li>
          <li>• They have no real value and are only valid on Mantle Sepolia testnet</li>
          <li>• You can mint unlimited amounts for testing</li>
          <li>• Use these tokens to test deposits, transfers, and other features</li>
        </ul>
      </div>
    </div>
  )
}
