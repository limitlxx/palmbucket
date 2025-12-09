# Upgradeable Contracts Deployment Guide

## Overview

Your PalmBudget contracts have been converted to upgradeable versions using OpenZeppelin's UUPS (Universal Upgradeable Proxy Standard) pattern. This allows you to upgrade contract logic while preserving state and addresses.

## What Was Created

### New Upgradeable Contracts

1. **contracts/src/upgradeable/BucketVaultUpgradeable.sol** - Base upgradeable vault
2. **contracts/src/upgradeable/BucketVaultV2Upgradeable.sol** - V2 with security features
3. **contracts/src/upgradeable/BucketVaultV3Upgradeable.sol** - V3 with multi-asset support
4. **contracts/src/upgradeable/PaymentRouterUpgradeable.sol** - Upgradeable payment router
5. **contracts/src/upgradeable/SweepKeeperUpgradeable.sol** - Upgradeable sweep keeper
6. **contracts/src/utils/SwapHelperUpgradeable.sol** - Upgradeable swap helper

### Deployment Scripts

1. **contracts/scripts/deployUpgradeable.ts** - Deploy all upgradeable contracts
2. **contracts/scripts/upgradeContracts.ts** - Upgrade existing deployments

### Documentation

1. **contracts/UPGRADEABLE_CONTRACTS.md** - Comprehensive guide
2. **UPGRADEABLE_DEPLOYMENT_GUIDE.md** - This file

## Prerequisites

### 1. Install Dependencies

The required packages have been added to package.json:

```bash
pnpm install
```

This installs:
- `@openzeppelin/contracts-upgradeable@^5.4.0`
- `@openzeppelin/hardhat-upgrades@^3.6.0`

### 2. Update Configuration

The following files have been updated:

- **hardhat.config.ts** - Added OpenZeppelin Upgrades plugin and Solidity 0.8.22 compiler
- **package.json** - Added new npm scripts for deployment and upgrades

## Deployment Steps

### Step 1: Compile Contracts

```bash
npx hardhat compile
```

This will compile both regular and upgradeable contracts.

### Step 2: Deploy to Local Network (Testing)

```bash
# Start local Hardhat node in one terminal
npx hardhat node

# In another terminal, deploy
npm run hardhat:deploy:upgradeable:local
```

This deploys:
- Mock tokens (USDC, Lendle, USDY, mETH, DEX Router)
- 4 upgradeable vault proxies (Bills, Savings, Growth, Spendable)
- PaymentRouter proxy
- SweepKeeper proxy

### Step 3: Deploy to Mantle Sepolia Testnet

```bash
npm run hardhat:deploy:upgradeable:sepolia
```

Deployment info is saved to `deploymentsUpgradeable.json`.

### Step 4: Verify Contracts (Optional)

After deployment, verify on Mantlescan:

```bash
npx hardhat verify --network mantle_sepolia <PROXY_ADDRESS>
```

## Upgrading Contracts

### When to Upgrade

Upgrade when you need to:
- Fix bugs in contract logic
- Add new features
- Improve gas efficiency
- Update yield strategies

### How to Upgrade

1. **Modify the implementation contract** in `contracts/src/upgradeable/`

2. **Test locally first**:
   ```bash
   npm run hardhat:upgrade:local
   ```

3. **Deploy to testnet**:
   ```bash
   npm run hardhat:upgrade:sepolia
   ```

4. **Verify functionality** - test all features work correctly

5. **Deploy to mainnet** (when ready):
   ```bash
   npm run hardhat:upgrade:mainnet
   ```

### Important Notes

- Proxy addresses **never change** during upgrades
- User balances and state are **preserved**
- Only the contract owner can upgrade
- Storage layout must be **compatible**

## Key Differences from Original Contracts

### 1. Constructors → Initializers

```solidity
// Original
constructor(IERC20 asset, string memory name) {
    _asset = asset;
}

// Upgradeable
function initialize(IERC20 asset, string memory name) public initializer {
    __ERC4626_init(asset);
}
```

### 2. Inheritance Changes

```solidity
// Original
import "@openzeppelin/contracts/access/Ownable.sol";
contract MyContract is Ownable { }

// Upgradeable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
contract MyContract is OwnableUpgradeable, UUPSUpgradeable { }
```

### 3. Storage Gaps

All upgradeable contracts include:

```solidity
uint256[50] private __gap;
```

This reserves storage slots for future variables.

## NPM Scripts Reference

### Deployment

```bash
# Deploy upgradeable contracts locally
npm run hardhat:deploy:upgradeable:local

# Deploy to Mantle Sepolia
npm run hardhat:deploy:upgradeable:sepolia
```

### Upgrades

```bash
# Upgrade contracts locally
npm run hardhat:upgrade:local

# Upgrade on Mantle Sepolia
npm run hardhat:upgrade:sepolia
```

### Testing

```bash
# Run all tests
npm run hardhat:test

# Run with gas reporting
npm run hardhat:test:gas

# Run coverage
npm run hardhat:coverage
```

## Frontend Integration

### Update Contract Addresses

After deployment, update `lib/contracts/addresses.ts`:

```typescript
export const CONTRACTS = {
  // Use proxy addresses from deploymentsUpgradeable.json
  BILLS_VAULT: "0x...",
  SAVINGS_VAULT: "0x...",
  GROWTH_VAULT: "0x...",
  SPENDABLE_VAULT: "0x...",
  PAYMENT_ROUTER: "0x...",
  SWEEP_KEEPER: "0x...",
};
```

### Update ABIs

The ABIs remain the same, but you may want to regenerate them:

```bash
npm run hardhat:compile
```

Then update `lib/contracts/abis.ts` with the new ABIs from `contracts/artifacts/`.

## Security Considerations

### Access Control

- Only the contract owner can upgrade
- Consider using a multisig wallet as owner for mainnet
- Implement a timelock for critical upgrades

### Testing

Before upgrading on mainnet:

1. ✅ Test upgrade on local network
2. ✅ Test upgrade on testnet
3. ✅ Verify all state is preserved
4. ✅ Test all functions work correctly
5. ✅ Check gas costs
6. ✅ Get security audit (recommended)

### Storage Safety

When adding new variables:

```solidity
// ✅ SAFE - Add at end
contract MyContractV2 {
    uint256 public existingVar;
    uint256 public newVar;  // Added at end
    uint256[49] private __gap;  // Reduced from 50
}

// ❌ UNSAFE - Don't remove or reorder
contract MyContractV2 {
    uint256 public newVar;  // DON'T DO THIS
    uint256 public existingVar;
}
```

## Troubleshooting

### Compilation Errors

If you see "incompatible Solidity pragmas":

1. Check `hardhat.config.ts` has both 0.8.20 and 0.8.22 compilers
2. Run `npx hardhat clean`
3. Run `npx hardhat compile` again

### Deployment Fails

If deployment fails:

1. Check you have enough ETH for gas
2. Verify RPC URL is correct in `.env.local`
3. Check network is accessible
4. Try increasing gas limit in hardhat.config.ts

### Upgrade Fails

If upgrade fails:

1. Verify you're the contract owner
2. Check storage layout compatibility
3. Ensure proxy address is correct
4. Review OpenZeppelin Upgrades plugin errors

## Migration from Non-Upgradeable

If you have existing non-upgradeable contracts deployed:

### Option 1: Fresh Deployment (Recommended)

1. Deploy new upgradeable contracts
2. Create migration UI for users
3. Users withdraw from old contracts
4. Users deposit to new contracts
5. Deprecate old contracts

### Option 2: Proxy Wrapper

1. Deploy upgradeable contracts
2. Create wrapper contract that forwards calls
3. Gradually migrate users
4. More complex but allows gradual migration

## Monitoring After Upgrade

After upgrading, verify:

1. ✅ All proxy addresses unchanged
2. ✅ User balances correct
3. ✅ Vault shares correct
4. ✅ Yield rates working
5. ✅ Deposits/withdrawals work
6. ✅ Payment routing works
7. ✅ Sweep keeper works
8. ✅ Events emit correctly
9. ✅ Gas costs reasonable
10. ✅ No errors in logs

## Resources

- [OpenZeppelin Upgrades Documentation](https://docs.openzeppelin.com/upgrades-plugins)
- [UUPS Pattern Explanation](https://eips.ethereum.org/EIPS/eip-1822)
- [Writing Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)
- [Hardhat Upgrades Plugin](https://github.com/OpenZeppelin/openzeppelin-upgrades)

## Support

For issues:

1. Check `contracts/UPGRADEABLE_CONTRACTS.md` for detailed info
2. Review OpenZeppelin documentation
3. Test on local network first
4. Check Hardhat console for errors
5. Verify storage layout compatibility

## Next Steps

1. ✅ Compile contracts: `npx hardhat compile`
2. ✅ Deploy locally: `npm run hardhat:deploy:upgradeable:local`
3. ✅ Test functionality
4. ✅ Deploy to testnet: `npm run hardhat:deploy:upgradeable:sepolia`
5. ✅ Update frontend with new addresses
6. ✅ Test on testnet
7. ✅ Get security audit (for mainnet)
8. ✅ Deploy to mainnet (when ready)

## Summary

Your contracts are now upgradeable! This gives you:

- ✅ Ability to fix bugs without migration
- ✅ Add features while keeping addresses
- ✅ Improve gas efficiency over time
- ✅ Adapt to protocol changes
- ✅ Maintain user trust

The proxy pattern ensures users never need to migrate their funds or update their approvals when you upgrade the contract logic.
