import { Address } from 'viem'

export interface TokenInfo {
  address: Address
  symbol: string
  name: string
  decimals: number
  balance: bigint
  isNative?: boolean
}

export interface DepositQuote {
  depositToken: Address
  depositAmount: bigint
  baseAssetAmount: bigint
  shares: bigint
  slippageTolerance: number
  minBaseAssetAmount: bigint
}

export interface MultiAssetDepositState {
  selectedToken: TokenInfo | null
  depositAmount: string
  quote: DepositQuote | null
  isLoadingQuote: boolean
  slippageTolerance: number
}
