# PalmBudget Deployment Quick Start

## Prerequisites

1. Get testnet MNT from [Mantle Sepolia Faucet](https://faucet.sepolia.mantle.xyz/)
2. Get a Mantlescan API key from [Mantlescan](https://sepolia.mantlescan.xyz/)
3. Update `.env.local` with your credentials

## Deploy to Mantle Sepolia (3 Commands)

```bash
# 1. Deploy all contracts
npm run hardhat:deploy:sepolia

# 2. Verify contracts on Mantlescan
npm run hardhat:verify:sepolia

# 3. Update .env.local with contract addresses
npm run hardhat:update-env --network mantle_sepolia
```

## Test Deployment

```bash
npm run hardhat:test-deployment --network mantle_sepolia
```

## What Gets Deployed

- ✅ MockERC20 (USDC) - Test token
- ✅ MockYieldProtocol - Test yield protocol
- ✅ PaymentRouter - Payment splitting logic
- ✅ BucketVault (4x) - Bills, Savings, Growth, Spendable vaults
- ✅ SweepKeeper - Automated fund optimization

## Output Files

- `deployments.json` - All contract addresses by network
- `.env.local` - Updated with contract addresses (after running update-env)

## Next Steps

After deployment:
1. Contract addresses are saved to `deployments.json`
2. Frontend can use addresses from `.env.local`
3. Contracts are verified and viewable on Mantlescan
4. Ready for frontend integration

## Troubleshooting

**Insufficient funds?**
- Get more MNT from the faucet

**Network error?**
- Check your RPC URL in `.env.local`

**Verification failed?**
- Wait a few minutes and try again
- Check your Mantlescan API key

## Full Documentation

See [contracts/DEPLOYMENT.md](./contracts/DEPLOYMENT.md) for detailed instructions.
