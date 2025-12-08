# PalmBudget Smart Contract Deployment Guide

This guide explains how to deploy and verify the PalmBudget smart contracts on Mantle Network.

## Prerequisites

1. **Fund your deployer account** with MNT tokens on Mantle Sepolia testnet
   - Get testnet MNT from the [Mantle Sepolia Faucet](https://faucet.sepolia.mantle.xyz/)
   - Ensure you have at least 0.1 MNT for deployment gas fees

2. **Configure environment variables** in `.env.local`:
   ```bash
   # Your deployer private key (without 0x prefix)
   PRIVATE_KEY=your_private_key_here
   
   # Mantle Sepolia RPC URL
   MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
   
   # Mantlescan API key for contract verification
   MANTLESCAN_API_KEY=your_mantlescan_api_key_here
   ```

3. **Get a Mantlescan API key** (optional, for contract verification):
   - Visit [Mantlescan](https://sepolia.mantlescan.xyz/)
   - Create an account and generate an API key

## Deployment Steps

### Step 1: Compile Contracts

```bash
npm run hardhat:compile
```

### Step 2: Deploy to Mantle Sepolia

```bash
npm run hardhat:deploy:sepolia
```

This will:
- Deploy MockERC20 (USDC) token for testing
- Deploy MockYieldProtocol for testing yield generation
- Deploy PaymentRouter contract
- Deploy 4 BucketVault contracts (Bills, Savings, Growth, Spendable)
- Deploy SweepKeeper contract
- Configure all contracts with proper settings
- Save deployment addresses to `deployments.json`

### Step 3: Verify Contracts on Mantlescan

```bash
npm run hardhat:verify:sepolia
```

This will verify all deployed contracts on Mantlescan, making them readable and interactable through the block explorer.

### Step 4: Test Contract Interactions

```bash
npm run hardhat:test-deployment --network mantle_sepolia
```

This will run a series of tests to verify:
- Token balances
- Contract configurations
- Vault names and settings
- SweepKeeper configuration
- Yield rates

## Deployment Output

After successful deployment, you'll find:

1. **deployments.json** - Contains all contract addresses organized by network
2. **Console output** - Shows deployment summary with all addresses

Example output:
```
=== Deployment Summary ===

Network: mantle_sepolia
Chain ID: 5003
Deployer: 0x...

Contract Addresses:
-------------------
MockERC20 (USDC): 0x...
MockYieldProtocol: 0x...
PaymentRouter: 0x...
Bills Vault: 0x...
Savings Vault: 0x...
Growth Vault: 0x...
Spendable Vault: 0x...
SweepKeeper: 0x...
```

## Update Frontend Configuration

After deployment, update `.env.local` with the contract addresses:

```bash
NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS=<PaymentRouter address>
NEXT_PUBLIC_BILLS_VAULT_ADDRESS=<Bills Vault address>
NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS=<Savings Vault address>
NEXT_PUBLIC_GROWTH_VAULT_ADDRESS=<Growth Vault address>
NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS=<Spendable Vault address>
NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS=<SweepKeeper address>
```

## Hardhat Tasks

The following Hardhat tasks are available:

### Deployment Tasks
- `npm run hardhat:deploy:sepolia` - Deploy to Mantle Sepolia testnet
- `npm run hardhat:deploy:mainnet` - Deploy to Mantle Mainnet (production)
- `npm run hardhat:deploy:local` - Deploy to local Hardhat node

### Verification Tasks
- `npm run hardhat:verify:sepolia` - Verify all contracts on Mantlescan
- `npx hardhat verify-contract --address <ADDRESS> --args '[...]' --network mantle_sepolia` - Verify single contract

### Testing Tasks
- `npm run hardhat:test` - Run all property-based tests
- `npm run hardhat:test-deployment --network mantle_sepolia` - Test deployed contracts
- `npm run hardhat:coverage` - Generate test coverage report

### Utility Tasks
- `npx hardhat accounts` - List available accounts
- `npx hardhat balance --account <ADDRESS>` - Check account balance
- `npx hardhat deploy-info --network mantle_sepolia` - Show deployment info

## Troubleshooting

### Insufficient Funds Error
```
Error: insufficient funds for intrinsic transaction cost
```
**Solution**: Fund your deployer account with more MNT tokens from the faucet.

### Network Connection Error
```
Error: Cannot connect to the network
```
**Solution**: Check your RPC URL in `.env.local` and ensure you have internet connectivity.

### Verification Failed
```
Error: Already Verified
```
**Solution**: This is normal - the contract is already verified on Mantlescan.

### Contract Not Found
```
Error: could not decode result data
```
**Solution**: Ensure you're testing on the same network where contracts were deployed.

## Mainnet Deployment

⚠️ **WARNING**: Mainnet deployment requires real MNT tokens and should only be done after thorough testing on Sepolia.

1. Update `.env.local` with mainnet configuration:
   ```bash
   PRIVATE_KEY=your_mainnet_private_key
   MANTLE_MAINNET_RPC_URL=https://rpc.mantle.xyz
   ```

2. Deploy to mainnet:
   ```bash
   npm run hardhat:deploy:mainnet
   ```

3. Verify contracts:
   ```bash
   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run contracts/scripts/verify.ts --network mantle_mainnet
   ```

## Contract Addresses

Deployed contract addresses are stored in `deployments.json` and organized by network:

```json
{
  "mantle_sepolia_5003": {
    "network": "mantle_sepolia",
    "chainId": 5003,
    "deployer": "0x...",
    "timestamp": "2024-...",
    "contracts": {
      "mockUSDC": "0x...",
      "paymentRouter": "0x...",
      ...
    }
  }
}
```

## Security Considerations

1. **Never commit private keys** to version control
2. **Use a dedicated deployer account** for testnet deployments
3. **Audit contracts** before mainnet deployment
4. **Test thoroughly** on Sepolia before deploying to mainnet
5. **Verify contracts** on Mantlescan for transparency

## Support

For issues or questions:
- Check the [Hardhat documentation](https://hardhat.org/docs)
- Review the [Mantle Network documentation](https://docs.mantle.xyz/)
- Open an issue in the project repository
