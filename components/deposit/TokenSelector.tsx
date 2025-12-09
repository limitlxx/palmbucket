'use client'

import { useState, useEffect } from 'react'
import { useAccount, useBalance, useReadContract, useReadContracts } from 'wagmi'
import { Address, formatUnits } from 'viem'
import { erc20Abi, bucketVaultAbi } from '@/lib/contracts/abis'
import { TokenInfo } from '@/types/multiAsset'

interface TokenSelectorProps {
  vaultAddress: Address
  selectedToken: TokenInfo | null
  onTokenSelect: (token: TokenInfo) => void
  className?: string
}

export function TokenSelector({
  vaultAddress,
  selectedToken,
  onTokenSelect,
  className = '',
}: TokenSelectorProps) {
  const { address } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address,
  })

  // Get supported tokens from vault
  const { data: supportedTokens, isLoading: isLoadingSupportedTokens } = useReadContract({
    address: vaultAddress,
    abi: bucketVaultAbi,
    functionName: 'getSupportedTokens',
  })

  // Fetch token details using wagmi's useReadContracts
  const tokenContracts = supportedTokens
    ? (supportedTokens as Address[])
        .filter(addr => addr !== '0x0000000000000000000000000000000000000000')
        .flatMap(tokenAddress => [
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'symbol' as const,
          },
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'name' as const,
          },
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'decimals' as const,
          },
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf' as const,
            args: address ? [address] : undefined,
          },
        ])
    : []

  const { data: tokenData } = useReadContracts({
    contracts: tokenContracts,
  })

  // Process token data
  useEffect(() => {
    if (!supportedTokens || !address) {
      setIsLoadingTokens(false)
      return
    }

    setIsLoadingTokens(true)
    const tokenInfos: TokenInfo[] = []

    // Add ETH as native token
    if (ethBalance) {
      tokenInfos.push({
        address: '0x0000000000000000000000000000000000000000' as Address,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        balance: ethBalance.value,
        isNative: true,
      })
    }

    // Process ERC20 tokens
    if (tokenData) {
      const tokenAddresses = (supportedTokens as Address[]).filter(
        addr => addr !== '0x0000000000000000000000000000000000000000'
      )

      tokenAddresses.forEach((tokenAddress, index) => {
        const baseIndex = index * 4
        const symbol = tokenData[baseIndex]?.result as string | undefined
        const name = tokenData[baseIndex + 1]?.result as string | undefined
        const decimals = tokenData[baseIndex + 2]?.result as number | undefined
        const balance = tokenData[baseIndex + 3]?.result as bigint | undefined

        if (symbol && name && decimals !== undefined && balance !== undefined) {
          tokenInfos.push({
            address: tokenAddress,
            symbol,
            name,
            decimals,
            balance,
            isNative: false,
          })
        }
      })
    }

    setTokens(tokenInfos)
    setIsLoadingTokens(false)
  }, [supportedTokens, address, ethBalance, tokenData])

  // Filter tokens based on search query
  const filteredTokens = tokens.filter(
    token =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleTokenSelect = (token: TokenInfo) => {
    onTokenSelect(token)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selected Token Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 glass border border-white/10 rounded-lg flex items-center justify-between hover:border-white/20 transition-colors"
      >
        {selectedToken ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              {selectedToken.symbol.charAt(0)}
            </div>
            <div className="text-left">
              <div className="font-medium text-foreground">{selectedToken.symbol}</div>
              <div className="text-xs text-muted-foreground">
                Balance: {formatUnits(selectedToken.balance, selectedToken.decimals).slice(0, 8)}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Select a token</span>
        )}
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 glass border border-white/10 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-white/10">
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 glass border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          {/* Token List */}
          <div className="overflow-y-auto max-h-80">
            {isLoadingTokens || isLoadingSupportedTokens ? (
              <div className="p-4 text-center text-muted-foreground">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <div className="mt-2">Loading tokens...</div>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery ? 'No tokens found' : 'No supported tokens available'}
              </div>
            ) : (
              filteredTokens.map(token => (
                <button
                  key={token.address}
                  onClick={() => handleTokenSelect(token)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-card/50 transition-colors border-b border-white/5 last:border-b-0"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {token.symbol.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-foreground">{token.symbol}</div>
                    <div className="text-sm text-muted-foreground">{token.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatUnits(token.balance, token.decimals).slice(0, 10)}
                    </div>
                    <div className="text-xs text-muted-foreground">Balance</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false)
            setSearchQuery('')
          }}
        />
      )}
    </div>
  )
}
