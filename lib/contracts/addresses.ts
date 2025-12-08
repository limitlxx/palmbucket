import { Address } from 'viem'
import { mantle, mantleSepoliaTestnet } from 'wagmi/chains'

// Contract addresses for different networks
export const contractAddresses = {
  [mantleSepoliaTestnet.id]: {
    paymentRouter: process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS as Address || '0x',
    buckets: {
      bills: process.env.NEXT_PUBLIC_BILLS_VAULT_ADDRESS as Address || '0x',
      savings: process.env.NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS as Address || '0x',
      growth: process.env.NEXT_PUBLIC_GROWTH_VAULT_ADDRESS as Address || '0x',
      spendable: process.env.NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS as Address || '0x',
    },
    sweepKeeper: process.env.NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS as Address || '0x',
  },
  [mantle.id]: {
    paymentRouter: process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS as Address || '0x',
    buckets: {
      bills: process.env.NEXT_PUBLIC_BILLS_VAULT_ADDRESS as Address || '0x',
      savings: process.env.NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS as Address || '0x',
      growth: process.env.NEXT_PUBLIC_GROWTH_VAULT_ADDRESS as Address || '0x',
      spendable: process.env.NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS as Address || '0x',
    },
    sweepKeeper: process.env.NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS as Address || '0x',
  },
}

// Helper function to get contract addresses for current chain
export function getContractAddresses(chainId: number) {
  return contractAddresses[chainId as keyof typeof contractAddresses]
}