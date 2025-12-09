# Upgradeable Contracts

This directory contains upgradeable versions of all PalmBudget smart contracts using OpenZeppelin's UUPS (Universal Upgradeable Proxy Standard) pattern.

## Overview

All contracts have been converted to upgradeable versions:

- **BucketVaultUpgradeable** - Base ERC4626 vault with yield generation
- **BucketVaultV2Upgradeable** - Production vault with security features
- **BucketVaultV3Upgradeable** - Multi-asset support with DEX integration
- **PaymentRouterUpgradeable** - Automatic payment splitting
- **SweepKeeperUpgradeable** - Automated fund sweeping to highest yield

## Why Upgradeable?

Upgradeable contracts allow you to:

1. **Fix bugs** without redeploying and migrating user funds
2. **Add features** while maintaining the same contract addresses
3. **Improve gas efficiency** in future versions
4. **Adapt to protocol changes** (e.g., new yield sources)
5. **Maintain user trust** - same addresses, no migration needed

## Architecture

### UUPS Pattern

We use the UUPS (Universal Upgradeable Proxy Standard) pattern because:

- **Gas efficient** - upgrade logic in implementation, not proxy
- **Smaller proxy** - lower deployment costs
- **More secure** - only implementation owner can upgrade
- **Industry standard** - used by major protocols

### Storage Gaps

All upgradeable contracts include a `__gap` storage variable:

```solidity
uint256[50] private __gap;
```

This reserves storage slots for future upgrades, preventing storage collisions.

## Deployment

### Install Dependencies

```bash
npm install @openzeppelin/contracts-upgradeable @openzeppelin/hardhat-upgrades
```

### Deploy Upgradeable Contracts

```bash
# Local/Hardhat network
npm run hardhat:deploy:upgradeable:local

# Mantle Sepolia testnet
npm run hardhat:deploy:upgradeable:sepolia
```

This will:
1. Deploy implementation contracts
2. Deploy proxy contracts
3. Initialize proxies with constructor parameters
4. Save addresses to `deploymentsUpgradeable.json`

### Upgrade Contracts

```bash
# Local/Hardhat network
npm run hardhat:upgrade:local

# Mantle Sepolia testnet
npm run hardhat:upgrade:sepolia
```

This will:
1. Deploy new implementation contracts
2. Update proxies to point to new implementations
3. Preserve all existing state and addresses
4. Update deployment info

## Contract Addresses

After deployment, proxy addresses remain constant across upgrades:

```json
{
  "contracts": {
    "billsVault": "0x...",      // Never changes
    "savingsVault": "0x...",    // Never changes
    "growthVault": "0x...",     // Never changes
    "spendableVault": "0x...",  // Never changes
    "paymentRouter": "0x...",   // Never changes
    "sweepKeeper": "0x..."      // Never changes
  }
}
```

## Upgrade Safety

### Pre-Upgrade Checklist

Before upgrading, ensure:

- [ ] New implementation is thoroughly tested
- [ ] Storage layout is compatible (no removed variables)
- [ ] New variables are added at the end
- [ ] `__gap` is adjusted if new variables added
- [ ] Initializer functions use `reinitializer(version)` if needed
- [ ] All tests pass with new implementation

### Upgrade Process

1. **Test locally first**:
   ```bash
   npm run hardhat:deploy:upgradeable:local
   npm run hardhat:upgrade:local
   ```

2. **Deploy to testnet**:
   ```bash
   npm run hardhat:deploy:upgradeable:sepolia
   npm run hardhat:upgrade:sepolia
   ```

3. **Verify on testnet** - test all functionality

4. **Deploy to mainnet** (when ready):
   ```bash
   npm run hardhat:deploy:upgradeable:mainnet
   ```

### Storage Layout Validation

OpenZeppelin Upgrades plugin automatically validates:

- Storage layout compatibility
- Initializer safety
- Constructor usage (must be disabled)
- Delegatecall safety

## Key Differences from Non-Upgradeable

### Constructors → Initializers

```solidity
// ❌ Non-upgradeable
constructor(IERC20 asset, string memory name) {
    _asset = asset;
    _name = name;
}

// ✅ Upgradeable
function initialize(IERC20 asset, string memory name) public initializer {
    __ERC4626_init(asset);
    __ERC20_init(name, symbol);
}
```

### Inheritance

```solidity
// ❌ Non-upgradeable
import "@openzeppelin/contracts/access/Ownable.sol";

// ✅ Upgradeable
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
```

### Disable Initializers

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}
```

## Testing Upgrades

Create a test file to verify upgrade compatibility:

```typescript
import { ethers, upgrades } from "hardhat";

describe("Upgrade Tests", function() {
  it("Should upgrade BillsVault", async function() {
    // Deploy V1
    const V1 = await ethers.getContractFactory("BucketVaultV2Upgradeable");
    const proxy = await upgrades.deployProxy(V1, [...args]);
    
    // Upgrade to V2
    const V2 = await ethers.getContractFactory("BucketVaultV3Upgradeable");
    const upgraded = await upgrades.upgradeProxy(proxy, V2);
    
    // Verify state preserved
    expect(await upgraded.totalAssets()).to.equal(previousTotal);
  });
});
```

## Migration from Non-Upgradeable

If you have existing non-upgradeable contracts deployed:

1. **Deploy new upgradeable versions** with fresh addresses
2. **Migrate user funds** using a migration contract
3. **Update frontend** to use new addresses
4. **Deprecate old contracts** after migration period

Note: Direct upgrade from non-upgradeable to upgradeable is not possible.

## Security Considerations

### Access Control

- Only contract owner can upgrade (enforced by `_authorizeUpgrade`)
- Consider using a multisig wallet as owner
- Implement timelock for mainnet upgrades

### Upgrade Governance

For production:

1. **Timelock** - delay between upgrade proposal and execution
2. **Multisig** - require multiple signatures for upgrades
3. **Governance** - community voting on upgrades
4. **Emergency pause** - ability to pause before upgrade

### Audit Requirements

- Audit initial implementation
- Audit each upgrade before deployment
- Focus on storage layout changes
- Verify upgrade safety with OpenZeppelin Defender

## Monitoring

After upgrade:

1. **Verify state** - check all critical state variables
2. **Test functionality** - execute key functions
3. **Monitor events** - ensure events emit correctly
4. **Check balances** - verify user balances unchanged
5. **Gas costs** - compare gas usage before/after

## Troubleshooting

### "Contract is not upgrade safe"

- Check for `immutable` variables (not allowed)
- Verify storage layout compatibility
- Ensure constructors are disabled

### "Storage layout is incompatible"

- Don't remove or reorder existing variables
- Add new variables at the end
- Adjust `__gap` size when adding variables

### "Initializer already called"

- Use `reinitializer(version)` for upgrade initializers
- Increment version number for each upgrade

## Resources

- [OpenZeppelin Upgrades Plugins](https://docs.openzeppelin.com/upgrades-plugins)
- [UUPS Pattern](https://eips.ethereum.org/EIPS/eip-1822)
- [Writing Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable)
- [Proxy Upgrade Pattern](https://docs.openzeppelin.com/upgrades-plugins/proxies)

## Support

For issues or questions:
- Check OpenZeppelin documentation
- Review upgrade safety checks
- Test thoroughly on local network first
- Consult with security auditors for mainnet upgrades
