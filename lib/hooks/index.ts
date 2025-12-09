/**
 * Custom wagmi hooks for PalmBudget contract interactions
 * These hooks provide type-safe interfaces for blockchain operations
 * with built-in error handling and transaction state management
 */

export { usePaymentRouter } from './usePaymentRouter'
export { useBucketVault } from './useBucketVault'
export { useSweepKeeper } from './useSweepKeeper'
export { useWagmiError } from './useWagmiError'
export { usePaymentMonitor, useTransactionMonitor } from './usePaymentMonitor'

// RWA protocol-specific hooks
export { useSavingsVault } from './useSavingsVault'
export { useGrowthVault } from './useGrowthVault'
export { useYieldCompounding, useVaultCompounding } from './useYieldCompounding'

// Transfer hooks
export { useBucketTransfer } from './useBucketTransfer'

// Yield tracking hooks
export { useYieldRateTracking } from './useYieldRateTracking'
export type { BucketYieldInfo, YieldComparison } from './useYieldRateTracking'

// Error handling and retry hooks
export { useRpcFallback } from './useRpcFallback'
export { useCachedYieldRate, useCachedYieldRates } from './useCachedYieldRates'
export { useGestureFallback, getGestureErrorMessage } from './useGestureFallback'
export { useDexFallback, getDexStatusMessage } from './useDexFallback'

// Mobile optimization hooks
export { 
  useHapticFeedback, 
  usePullToRefresh, 
  useIsMobile, 
  useMobileAnimations 
} from './useMobileOptimizations'

// Re-export commonly used wagmi hooks for convenience
export {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
