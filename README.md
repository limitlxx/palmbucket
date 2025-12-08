# PalmBudget

A gesture-controlled decentralized budgeting application built on Mantle Network that automatically splits incoming cryptocurrency payments into yield-bearing buckets.

## Features

- 🤲 **Gesture Control**: Use hand gestures (pinch-to-click, swipe gestures) to interact with the app
- 💰 **Auto-Split Payments**: Automatically split incoming payments into Bills, Savings, Growth, and Spendable buckets
- 📈 **Yield Generation**: Earn passive income through RWA integrations (Ondo USDY, mETH)
- 🌈 **Beautiful Wallet UX**: Powered by RainbowKit for seamless wallet connections
- 📱 **Mobile Optimized**: Responsive design with gesture support on mobile devices

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Blockchain**: Mantle Network, Hardhat, Ethers.js
- **Wallet Integration**: RainbowKit, wagmi
- **Gesture Recognition**: MediaPipe Hands
- **Smart Contracts**: Solidity, ERC-4626 vaults

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask or other Web3 wallet

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your configuration:
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: Get from [WalletConnect Cloud](https://cloud.walletconnect.com)
   - `MANTLESCAN_API_KEY`: Get from [Mantlescan](https://mantlescan.xyz)
   - `PRIVATE_KEY`: Your deployment wallet private key (testnet only)

### Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Compile smart contracts:
   ```bash
   npm run hardhat:compile
   ```

3. Run tests:
   ```bash
   npm run hardhat:test
   ```

### Deployment

Deploy to Mantle Sepolia testnet:
```bash
npm run hardhat:deploy:sepolia
```

Deploy to Mantle mainnet:
```bash
npm run hardhat:deploy:mainnet
```

## Project Structure

```
├── app/                    # Next.js app directory
├── components/            # React components
│   ├── gesture/          # Gesture recognition components
│   ├── providers/        # Context providers (Wagmi, RainbowKit)
│   ├── ui/              # shadcn/ui components
│   └── wallet/          # Wallet connection components
├── contracts/            # Smart contracts
│   ├── src/             # Solidity source files
│   ├── test/            # Contract tests
│   └── scripts/         # Deployment scripts
├── lib/                 # Utility libraries
└── types/               # TypeScript type definitions
```

## Smart Contracts

- **PaymentRouter**: Automatically splits incoming payments
- **BucketVault**: ERC-4626 compliant vaults for each bucket type
- **SweepKeeper**: Automated fund optimization using Gelato

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details