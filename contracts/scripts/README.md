# Deployment and Automation Scripts

This directory contains scripts for deploying contracts and setting up automation for the PalmBudget system.

## Available Scripts

### Deployment Scripts

#### `deploy.ts`
Deploys the original PalmBudget contracts (V1).

```bash
npm run hardhat:deploy:sepolia
npm run hardhat:deploy:mainnet
```

#### `deployV2.ts`
Deploys the V2 contracts with multi-asset support (USDC, USDY, mETH).

```bash
npm run hardhat:deploy:v2:sepolia
npm run hardhat:deploy:v2:local
```

#### `deployV2-continue.ts`
Continues a partial V2 deployment if it was interrupted.

```bash
npx hardhat run contracts/scripts/deployV2-continue.ts --network mantle_sepolia
```

### Verification Scripts

#### `verify.ts`
Verifies V1 contracts on Mantlescan block explorer.

```bash
npm run hardhat:verify:sepolia
```

#### `verifyV2.ts`
Verifies V2 contracts on Mantlescan block explorer.

```bash
npx hardhat run contracts/scripts/verifyV2.ts --network mantle_sepolia
```

### Automation Scripts

#### `create-gelato-task.ts` ⭐ NEW
Creates Gelato Network automation tasks for the SweepKeeper contract.

**Purpose**: Set up automated month-end fund sweeps using Gelato Network.

**Prerequisites**:
1. SweepKeeper contract deployed and initialized
2. Gelato account created at https://app.gelato.network
3. Gelato 1Balance funded with MNT tokens
4. Users have authorized auto-sweep

**Usage**:
```bash
# For Mantle Sepolia testnet
npm run hardhat:create-gelato-task:sepolia

# For Mantle mainnet
npm run hardhat:create-gelato-task:mainnet
```

**What it does**:
1. Loads deployment information from `deploymentsV2.json`
2. Verifies SweepKeeper configuration (bucket addresses, pause state)
3. Queries authorized users from on-chain events
4. Tests the checker function for each user
5. Generates task configurations
6. Saves configurations to `gelato-tasks.json`
7. Displays step-by-step instructions for creating tasks

**Output**:
- Console output with detailed instructions
- `gelato-tasks.json` file with task configurations
- Diagnostic information for each user

**Example Output**:
```
================================================================================
🤖 GELATO TASK CREATION SCRIPT FOR SWEEPKEEPER
================================================================================

Network: mantle_sepolia
Chain ID: 5003

SweepKeeper Address: 0x772CAEAA455fF9Fc5F2e199C0420898e3C706097

🔍 Verifying SweepKeeper configuration...
✓ Bills Bucket: 0x43B86Fa95149aa3344F0e3cd932fB9FC019E027D
✓ Savings Bucket: 0x1817D029CCF16ffe6cE26506508264909F3BfB1E
✓ Growth Bucket: 0x8860be31C64557e30B3338bA400b6F483dfB6978
✓ Spendable Bucket: 0xdF4772c7A9fd17c245111F61026d48B808857626
✓ Contract is not paused
✓ Global minimum balance: 10.0 USDC

📋 Querying authorized users...
✓ Found 2 authorized user(s)

Authorized users:
  1. 0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a
  2. 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

================================================================================
TESTING CHECKER FUNCTION
================================================================================

🧪 Testing checker for user 0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a...
  Can Execute: false
  ℹ️  Sweep cannot be executed (conditions not met)

  Diagnostics:
    - User authorized: true
    - Is month-end: false
    - Sweepable amount: 90.0 USDC
    - Contract paused: false

[... task creation instructions ...]
```

**Next Steps After Running**:
1. Review the generated `gelato-tasks.json` file
2. Visit https://app.gelato.network/new-task
3. Create tasks using the provided configurations
4. Fund your Gelato 1Balance with MNT tokens
5. Monitor execution at https://app.gelato.network/tasks

**Documentation**:
- Detailed setup guide: `contracts/GELATO_SETUP.md`
- Gelato Network docs: https://docs.gelato.network

### Utility Scripts

#### `update-env.ts`
Updates `.env.local` file with deployed contract addresses (V1).

```bash
npm run hardhat:update-env
```

#### `update-env-v2.ts`
Updates `.env.local` file with deployed V2 contract addresses.

```bash
npx hardhat run contracts/scripts/update-env-v2.ts
```

## Deployment Workflow

### For Testnet (Mantle Sepolia)

1. **Deploy V2 Contracts**:
   ```bash
   npm run hardhat:deploy:v2:sepolia
   ```

2. **Verify Contracts**:
   ```bash
   npx hardhat run contracts/scripts/verifyV2.ts --network mantle_sepolia
   ```

3. **Update Environment Variables**:
   ```bash
   npx hardhat run contracts/scripts/update-env-v2.ts
   ```

4. **Set Up Gelato Automation**:
   ```bash
   npm run hardhat:create-gelato-task:sepolia
   ```

5. **Test the System**:
   - Authorize auto-sweep for test users
   - Wait for month-end or test manually
   - Monitor Gelato task execution

### For Mainnet (Mantle)

1. **Deploy V2 Contracts**:
   ```bash
   npm run hardhat:deploy:v2:mainnet
   ```

2. **Verify Contracts**:
   ```bash
   npx hardhat run contracts/scripts/verifyV2.ts --network mantle_mainnet
   ```

3. **Update Environment Variables**:
   ```bash
   npx hardhat run contracts/scripts/update-env-v2.ts
   ```

4. **Set Up Gelato Automation**:
   ```bash
   npm run hardhat:create-gelato-task:mainnet
   ```

5. **Monitor and Maintain**:
   - Monitor Gelato 1Balance
   - Check sweep execution success rates
   - Review gas costs monthly

## Configuration Files

- **`deployments.json`**: V1 deployment addresses
- **`deploymentsV2.json`**: V2 deployment addresses
- **`deploymentsV2-partial.json`**: Partial V2 deployment (if interrupted)
- **`gelato-tasks.json`**: Generated Gelato task configurations
- **`gelato-tasks.example.json`**: Example task configuration

## Environment Variables

Required environment variables (in `.env.local`):

```bash
# Network RPC URLs
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_MAINNET_RPC_URL=https://rpc.mantle.xyz

# Deployer private key
PRIVATE_KEY=0x...

# Block explorer API key
MANTLESCAN_API_KEY=your-api-key

# Optional: Gas reporting
REPORT_GAS=true
COINMARKETCAP_API_KEY=your-api-key
```

## Troubleshooting

### Deployment Issues

**Problem**: Deployment fails with "insufficient funds"
**Solution**: Ensure deployer account has enough MNT tokens

**Problem**: Deployment times out
**Solution**: Increase timeout in `hardhat.config.ts` or use `deployV2-continue.ts`

**Problem**: Contract verification fails
**Solution**: Wait a few minutes and try again, or verify manually on Mantlescan

### Gelato Task Issues

**Problem**: No authorized users found
**Solution**: Users must call `authorizeAutoSweep()` on the SweepKeeper contract

**Problem**: Checker returns false
**Solution**: Check diagnostics output - verify user is authorized, has balance, and it's month-end

**Problem**: Task not executing
**Solution**: 
- Check Gelato 1Balance has sufficient MNT
- Verify contract is not paused
- Ensure it's within month-end window (last 3 days)
- Check user has sweepable amount > 0

## Support

For issues or questions:
1. Check the documentation in `contracts/GELATO_SETUP.md`
2. Review Gelato Network docs: https://docs.gelato.network
3. Check Hardhat docs: https://hardhat.org/docs
4. Contact the development team

## Additional Resources

- **Gelato Network**: https://app.gelato.network
- **Mantlescan (Sepolia)**: https://sepolia.mantlescan.xyz
- **Mantlescan (Mainnet)**: https://mantlescan.xyz
- **Mantle Docs**: https://docs.mantle.xyz
