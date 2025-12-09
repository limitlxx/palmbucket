# Multi-Asset Deposit Components

This directory contains components for implementing multi-asset deposit functionality in PalmBudget, allowing users to deposit various tokens into vault buckets with automatic swapping.

## Components

### TokenSelector

A dropdown component for selecting deposit tokens with search and filtering capabilities.

**Props:**
- `vaultAddress`: Address of the vault contract
- `selectedToken`: Currently selected token info
- `onTokenSelect`: Callback when a token is selected
- `className`: Optional CSS classes

**Features:**
- Displays supported tokens from vault
- Shows token balances using wagmi hooks
- Search and filter functionality
- Token icons and metadata display

### DepositQuotePreview

Displays a preview of the deposit quote including expected base asset amount, shares, and swap details.

**Props:**
- `vaultAddress`: Address of the vault contract
- `selectedToken`: Selected token for deposit
- `depositAmount`: Amount to deposit (as string)
- `slippageTolerance`: Slippage tolerance percentage
- `onQuoteUpdate`: Callback with updated quote data
- `className`: Optional CSS classes

**Features:**
- Real-time quote fetching using `quoteDeposit` function
- Displays expected base asset amount and shares
- Shows price impact and swap route
- Slippage protection calculations
- Warning for high price impact

### SlippageSettings

A settings component for configuring slippage tolerance.

**Props:**
- `slippageTolerance`: Current slippage tolerance percentage
- `onSlippageChange`: Callback when slippage changes
- `className`: Optional CSS classes

**Features:**
- Preset slippage options (0.1%, 0.5%, 1.0%)
- Custom slippage input
- Warnings for high/low slippage
- Dropdown interface

### MultiAssetDepositModal

Main modal component that orchestrates the entire multi-asset deposit flow.

**Props:**
- `vaultAddress`: Address of the vault contract
- `vaultName`: Display name of the vault
- `isOpen`: Whether the modal is open
- `onClose`: Callback to close the modal

**Features:**
- Token selection interface
- Amount input with MAX button
- Quote preview with slippage settings
- Two-step flow: Approve → Deposit
- Support for both ERC20 and native ETH deposits
- Transaction status tracking
- Success confirmation screen
- Error handling and user feedback

## Usage Example

```tsx
import { MultiAssetDepositModal } from '@/components/deposit'

function BucketCard() {
  const [showDepositModal, setShowDepositModal] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowDepositModal(true)}>
        Deposit Funds
      </button>
      
      <MultiAssetDepositModal
        vaultAddress={vaultAddress}
        vaultName="Savings Bucket"
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
      />
    </>
  )
}
```

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 11.1**: Automatic token swapping via DEX router
- **Requirement 11.2**: Native ETH deposit support
- **Requirement 11.3**: Quote functionality for deposit previews
- **Requirement 11.4**: Supported token management
- **Requirement 11.5**: Slippage protection
- **Requirement 11.6**: Complete deposit flow with error handling

## Technical Details

### Token Approval Flow

For ERC20 tokens:
1. Check current allowance
2. If insufficient, request approval
3. Wait for approval confirmation
4. Proceed to deposit

For native ETH:
- No approval needed, direct deposit

### Slippage Protection

The minimum base asset amount is calculated as:
```
minBaseAssetAmount = baseAssetAmount * (1 - slippageTolerance)
```

This ensures the transaction reverts if the actual swap result is worse than expected.

### Error Handling

- Token balance validation
- Slippage tolerance warnings
- Transaction failure recovery
- Network error handling
- User-friendly error messages

## Dependencies

- `wagmi`: For blockchain interactions
- `viem`: For address and unit formatting
- `@/lib/contracts/abis`: Contract ABIs
- `@/types/multiAsset`: TypeScript types
