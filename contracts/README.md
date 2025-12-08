# PalmBudget Smart Contracts

This directory contains the Solidity smart contracts for the PalmBudget application.

## Overview

PalmBudget uses a suite of smart contracts deployed on Mantle Network to provide automated payment splitting, yield generation, and fund management.

## Contracts

### Core Contracts

1. **PaymentRouter.sol** - Automatically splits incoming payments into predefined buckets
   - Configurable split ratios (must sum to 100%)
   - User-specific bucket addresses
   - Token approval checking for auto-split
   - Events for payment routing and configuration updates

2. **BucketVault.sol** - ERC-4626 compliant vault for holding and generating yield
   - Standard vault interface for deposits and withdrawals
   - Integration with external yield protocols
   - Automatic yield compounding
   - Share-based accounting for proportional returns

3. **SweepKeeper.sol** - Automated keeper for month-end fund optimization
   - Identifies leftover funds in Spendable bucket
   - Moves funds to highest-yielding bucket
   - Gelato Network integration for automation
   - Minimum balance preservation

### Mock Contracts (Testing)

4. **MockERC20.sol** - Mock ERC20 token for testing
5. **MockYieldProtocol.sol** - Mock yield protocol for testing vault integration

## Dependencies

### External Libraries

- **@openzeppelin/contracts** - Audited smart contract library for common patterns
- **@quant-finance/solidity-datetime** - BokkyPooBah's DateTime library for accurate calendar calculations
  - Used in SweepKeeper for month-end detection
  - Handles leap years and varying month lengths
  - Import path: `@quant-finance/solidity-datetime/contracts/DateTime.sol`

## Architecture

```
┌─────────────────┐
│  PaymentRouter  │ ──> Splits incoming payments
└────────┬────────┘
         │
         ├──> ┌──────────────┐
         │    │ Bills Vault  │
         │    └──────────────┘
         │
         ├──> ┌──────────────┐
         │    │Savings Vault │ ──> Ondo USDY
         │    └──────────────┘
         │
         ├──> ┌──────────────┐
         │    │ Growth Vault │ ──> mETH Protocol
         │    └──────────────┘
         │
         └──> ┌──────────────┐
              │Spendable Vault│
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │ SweepKeeper  │ ──> Monthly optimization
              └──────────────┘
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Start

1. Configure `.env.local` with your private key and RPC URL
2. Deploy to Mantle Sepolia:
   ```bash
   npm run hardhat:deploy:sepolia
   ```
3. Verify contracts:
   ```bash
   npm run hardhat:verify:sepolia
   ```
4. Update environment variables:
   ```bash
   npm run hardhat:update-env --network mantle_sepolia
   ```

## Testing

### Property-Based Tests

The contracts include comprehensive property-based tests using fast-check:

```bash
npm run hardhat:test
```

Tests include:
- Payment split ratio correctness (Property 1)
- Split ratio invariant validation (Property 2)
- Yield activation on allocation (Property 3)

### Test Coverage

Generate coverage report:
```bash
npm run hardhat:coverage
```

## Development

### Compile Contracts

```bash
npm run hardhat:compile
```

### Run Tests

```bash
npm run hardhat:test
```

### Clean Build Artifacts

```bash
npm run hardhat:clean
```

## Contract Addresses

Deployed contract addresses are stored in `../deployments.json` and organized by network.

### Mantle Sepolia Testnet

After deployment, addresses will be available in `deployments.json` under the key `mantle_sepolia_5003`.

## Security

- All contracts use OpenZeppelin's audited libraries
- ReentrancyGuard protection on all fund transfer functions
- Ownable pattern for admin functions
- Custom errors for gas efficiency
- Try-catch blocks for external protocol calls

## Gas Optimization

- Custom errors instead of require strings
- Efficient storage patterns
- Minimal external calls
- Optimized loop iterations

## License

MIT

## Directory Structure

```
contracts/
├── src/              # Solidity source files
├── test/             # Test files
├── scripts/          # Deployment and utility scripts
├── artifacts/        # Compiled contract artifacts (generated)
├── cache/            # Hardhat cache (generated)
└── typechain-types/  # TypeScript type definitions (generated)
```

## Available Commands

### Compilation
```bash
npm run hardhat:compile
```

### Testing
```bash
# Run all tests
npm run hardhat:test

# Run tests with gas reporting
npm run hardhat:test:gas

# Run coverage analysis
npm run hardhat:coverage
```

### Deployment
```bash
# Deploy to Mantle Sepolia testnet
npm run hardhat:deploy:sepolia

# Deploy to Mantle Mainnet
npm run hardhat:deploy:mainnet

# Deploy to local Hardhat network
npm run hardhat:deploy:local
```

### Utility Commands
```bash
# List available accounts
npm run hardhat:accounts

# Get deployment information
npx hardhat deploy-info

# Check account balance
npx hardhat balance --account <ADDRESS>

# Clean build artifacts
npm run hardhat:clean

# Start local Hardhat node
npm run hardhat:node
```

### Contract Verification
```bash
# Verify a contract on Mantlescan
npx hardhat verify-contract --address <CONTRACT_ADDRESS> --args '[arg1, arg2]'
```

## Network Configuration

### Mantle Sepolia Testnet
- Chain ID: 5003
- RPC URL: https://rpc.sepolia.mantle.xyz
- Explorer: https://sepolia.mantlescan.xyz

### Mantle Mainnet
- Chain ID: 5000
- RPC URL: https://rpc.mantle.xyz
- Explorer: https://mantlescan.xyz

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Mantle Network RPC endpoints
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_MAINNET_RPC_URL=https://rpc.mantle.xyz

# Private key for deployment (use a test account)
PRIVATE_KEY=your_private_key_here

# Mantlescan API key for contract verification
MANTLESCAN_API_KEY=your_mantlescan_api_key_here

# Optional: Gas reporting
REPORT_GAS=false
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key_here

# Optional: Fork Mantle Sepolia for local testing
FORK_MANTLE_SEPOLIA=false
```

## Development Workflow

1. **Write Contracts**: Create Solidity files in `src/`
2. **Compile**: Run `npm run hardhat:compile` to compile contracts
3. **Write Tests**: Create test files in `test/`
4. **Test**: Run `npm run hardhat:test` to execute tests
5. **Deploy**: Use deployment scripts to deploy to testnet/mainnet
6. **Verify**: Verify contracts on Mantlescan for transparency

## Testing Best Practices

- Write comprehensive unit tests for all contract functions
- Test edge cases and error conditions
- Use property-based testing for complex logic
- Aim for >90% code coverage
- Test on local network before deploying to testnet

## Security Considerations

- Never commit private keys or sensitive data
- Always test on testnet before mainnet deployment
- Use access controls (Ownable, AccessControl) appropriately
- Implement reentrancy guards for functions that transfer funds
- Follow the Checks-Effects-Interactions pattern
- Get contracts audited before mainnet deployment
