/**
 * Custom wagmi hooks for PalmBudget contract interactions
 * These hooks provide type-safe interfaces for blockchain operations
 * with built-in error handling and transaction state management
 */

export { usePaymentRouter } from './usePaymentRouter'
export { useBucketVault } from './useBucketVault'
export { useSweepKeeper } from './useSweepKeeper'
export { useWagmiError } from './useWagmiError'

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
