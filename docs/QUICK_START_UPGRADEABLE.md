# Quick Start - Upgradeable Contracts

## Installation

```bash
pnpm install
```

## Compile

```bash
npx hardhat compile
```

## Deploy

### Local Network
```bash
# Terminal 1: Start node
npx hardhat node

# Terminal 2: Deploy
npm run hardhat:deploy:upgradeable:local
```

### Mantle Sepolia Testnet
```bash
npm run hardhat:deploy:upgradeable:sepolia
```

## Upgrade

### Local Network
```bash
npm run hardhat:upgrade:local
```

### Mantle Sepolia Testnet
```bash
npm run hardhat:upgrade:sepolia
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `hardhat:deploy:upgradeable:local` | Deploy to local network |
| `hardhat:deploy:upgradeable:sepolia` | Deploy to Mantle Sepolia |
| `hardhat:upgrade:local` | Upgrade local deployment |
| `hardhat:upgrade:sepolia` | Upgrade Sepolia deployment |

## Deployment Output

Addresses saved to: `deploymentsUpgradeable.json`

## Documentation

- **Full Guide**: `UPGRADEABLE_DEPLOYMENT_GUIDE.md`
- **Technical Details**: `contracts/UPGRADEABLE_CONTRACTS.md`
- **Summary**: `UPGRADEABLE_SUMMARY.md`
