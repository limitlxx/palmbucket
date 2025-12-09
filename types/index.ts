import { Address } from 'viem'

// Bucket types
export type BucketType = 'bills' | 'savings' | 'growth' | 'spendable'

// Split ratios (must sum to 100)
export interface SplitRatios {
  bills: number
  savings: number
  growth: number
  spendable: number
}

// Bucket data structure
export interface Bucket {
  type: BucketType
  balance: bigint
  yieldRate: number
  totalYieldEarned: bigint
  underlyingAsset: string
  vaultAddress: Address
}

// Bucket addresses mapping
export interface BucketAddresses {
  bills: Address
  savings: Address
  growth: Address
  spendable: Address
}

// User profile
export interface UserProfile {
  address: Address
  splitRatios: SplitRatios
  gestureEnabled: boolean
  bucketAddresses: BucketAddresses
  createdAt: number
}

// Transaction types
export type TransactionType = 'split' | 'transfer' | 'yield' | 'sweep'

export interface TransactionData {
  id: string
  type: TransactionType
  amount: bigint
  fromBucket?: BucketType
  toBucket?: BucketType
  timestamp: number
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
}

// Gesture recognition types
export interface HandLandmarks {
  x: number
  y: number
  z: number
}

export type GestureType = 'pinch' | 'swipe_left' | 'swipe_right' | 'none'
export type SwipeDirection = 'left' | 'right' | 'none'

export interface GestureData {
  landmarks: HandLandmarks[][]
  confidence: number
  gestureType: GestureType
  timestamp: number
}

// Yield rates for different buckets
export interface YieldRates {
  bills: number // 0% (no yield)
  savings: number // Ondo USDY rate
  growth: number // mETH rate
  spendable: number // 0% (no yield)
}

// Contract addresses
export interface ContractAddresses {
  paymentRouter: Address
  buckets: BucketAddresses
  sweepKeeper: Address
}