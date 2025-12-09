# PalmBudget Frontend Requirements for v0.dev

## Project Overview

**PalmBudget** is a gesture-controlled budgeting dApp on Mantle Network that automatically splits cryptocurrency payments into 4 yield-bearing buckets. This document specifies the frontend UI/UX requirements for v0.dev to generate a modern, mobile-first interface.

**Tagline:** "Your money saves itself — just show your hand."

---

## Design Philosophy

- **Mobile-first**: Optimized for phone screens (375px-428px width)
- **Gesture-ready**: Large touch targets, smooth animations, visual feedback
- **Financial clarity**: Clear hierarchy, readable numbers, intuitive color coding
- **Modern aesthetic**: Glassmorphism, gradients, smooth shadows, micro-interactions
- **Accessible**: Works perfectly with touch, mouse, and gesture controls

---

## Color Palette & Branding

### Primary Colors
- **Bills Bucket**: `#3B82F6` (Blue) - Stability, responsibility
- **Savings Bucket**: `#10B981` (Emerald) - Growth, security  
- **Growth Bucket**: `#8B5CF6` (Purple) - Premium, long-term
- **Spendable Bucket**: `#F59E0B` (Amber) - Energy, immediate access

### UI Colors
- **Background**: `#0F172A` (Dark slate) with subtle gradient
- **Cards**: `#1E293B` with `backdrop-blur-xl` glassmorphism
- **Text Primary**: `#F8FAFC` (Near white)
- **Text Secondary**: `#94A3B8` (Slate gray)
- **Success**: `#10B981` (Emerald)
- **Error**: `#EF4444` (Red)
- **Warning**: `#F59E0B` (Amber)

---

## Core Pages & Components

### 1. Dashboard (Main Page)

**Layout:**
```
┌─────────────────────────────────┐
│  [Logo]    [Gesture Toggle] [👤]│  ← Header (sticky)
├─────────────────────────────────┤
│                                 │
│  Total Portfolio                │
│  $12,847.32                     │  ← Hero section
│  +4.7% this month               │
│                                 │
├─────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  │
│  │  Bills    │  │  Savings  │  │
│  │  $6,423   │  │  $2,569   │  │  ← Bucket grid
│  │  0% APY   │  │  9.2% APY │  │     (2x2 on mobile)
│  └───────────┘  └───────────┘  │
│  ┌───────────┐  ┌───────────┐  │
│  │  Growth   │  │ Spendable │  │
│  │  $2,569   │  │  $1,285   │  │
│  │  5.8% APY │  │  0% APY   │  │
│  └───────────┘  └───────────┘  │
├─────────────────────────────────┤
│  Recent Activity                │
│  [Transaction list]             │  ← Scrollable feed
└─────────────────────────────────┘
```

**Bucket Card Component:**
- **Size**: 160px x 180px (mobile), 200px x 220px (desktop)
- **Style**: Glassmorphic card with gradient border matching bucket color
- **Content**:
  - Bucket icon (top-left, 32px)
  - Bucket name (bold, 18px)
  - Balance (large, 28px, white)
  - APY badge (if > 0%, pill shape, bucket color)
  - Yield earned this month (small, secondary text)
  - Subtle animated gradient background
- **Interactions**:
  - Tap/click → Opens bucket detail modal
  - Long press → Quick transfer menu
  - Hover → Lift animation + glow effect

**Hero Section:**
- Large total balance (48px font)
- Month-over-month percentage with up/down arrow
- Subtle animated gradient background
- Pull-to-refresh indicator on mobile

---

### 2. Bucket Detail Modal

**Triggered by:** Tapping a bucket card

**Layout:**
```
┌─────────────────────────────────┐
│  [X]                            │
│                                 │
│  💰 Savings Bucket              │  ← Header with icon
│                                 │
│  $2,569.43                      │  ← Large balance
│  9.2% APY                       │
│                                 │
├─────────────────────────────────┤
│  Yield Earned                   │
│  +$23.47 this month             │  ← Stats section
│  +$187.92 all time              │
│                                 │
│  Underlying Asset               │
│  Ondo USDY                      │
├─────────────────────────────────┤
│  [Deposit]  [Withdraw]          │  ← Action buttons
│  [Transfer to another bucket]   │
├─────────────────────────────────┤
│  Recent Transactions            │
│  • Deposit $500 - 2 days ago    │  ← Transaction list
│  • Yield +$1.23 - 5 days ago    │
└─────────────────────────────────┘
```

**Features:**
- Smooth slide-up animation
- Backdrop blur overlay
- Swipe down to dismiss
- Large, gesture-friendly buttons (min 48px height)

---

### 3. Deposit/Withdraw Modal

**Layout:**
```
┌─────────────────────────────────┐
│  Deposit to Savings             │
│                                 │
│  Select Token                   │
│  [USDC ▼]                       │  ← Token selector dropdown
│                                 │
│  Amount                         │
│  ┌─────────────────────────┐   │
│  │ 500.00              MAX │   │  ← Input with MAX button
│  └─────────────────────────┘   │
│  Balance: 1,234.56 USDC         │
│                                 │
│  You will receive               │
│  ~487.32 shares                 │  ← Quote preview
│  (includes 0.3% swap fee)       │
│                                 │
│  [Cancel]  [Confirm Deposit]    │  ← Action buttons
└─────────────────────────────────┘
```

**Features:**
- Real-time quote updates as user types
- Token selector with icons and balances
- Clear fee breakdown
- Slippage tolerance setting (advanced)
- Gesture-friendly: Swipe right to confirm, left to cancel

---

### 4. Transfer Between Buckets Modal

**Layout:**
```
┌─────────────────────────────────┐
│  Transfer Funds                 │
│                                 │
│  From                           │
│  [Spendable ▼]                  │  ← Source bucket
│  Balance: $1,285.00             │
│                                 │
│  To                             │
│  [Savings ▼]                    │  ← Destination bucket
│                                 │
│  Amount                         │
│  ┌─────────────────────────┐   │
│  │ 200.00              MAX │   │
│  └─────────────────────────┘   │
│                                 │
│  [Cancel]  [Transfer]           │
└─────────────────────────────────┘
```

---

### 5. Settings Page

**Layout:**
```
┌─────────────────────────────────┐
│  Settings                       │
│                                 │
│  Auto-Split                     │
│  [Toggle ON/OFF]                │  ← Enable/disable auto-split
│                                 │
│  Split Ratios                   │
│  Bills:     50% [slider]        │  ← Ratio sliders
│  Savings:   20% [slider]        │     (must sum to 100%)
│  Growth:    20% [slider]        │
│  Spendable: 10% [slider]        │
│  Total: 100% ✓                  │
│                                 │
│  Auto-Sweep                     │
│  [Toggle ON/OFF]                │  ← Enable/disable sweep
│  Minimum balance: $100          │
│                                 │
│  Gesture Controls               │
│  [Toggle ON/OFF]                │  ← Enable/disable gestures
│                                 │
│  Connected Wallet               │
│  0x1234...5678                  │
│  [Disconnect]                   │
└─────────────────────────────────┘
```

---

### 6. Wallet Connection (RainbowKit)

**Use RainbowKit's built-in ConnectButton component:**
- Beautiful pre-built wallet selection modal
- Supports MetaMask, WalletConnect, Coinbase Wallet, etc.
- Shows connected address, balance, and disconnect option
- Network switching to Mantle Network

**Placement:**
- Top-right corner of header
- Floating button on mobile (bottom-right)

---

### 7. Gesture Toggle Button

**Design:**
- **Position**: Fixed top-right (desktop) or floating bottom-right (mobile)
- **Size**: 64px circle
- **States**:
  - **ON**: Emerald gradient, hand icon (✋), subtle pulse animation
  - **OFF**: Gray, crossed-out hand icon (🚫), no animation
- **Interaction**: Tap to toggle, smooth color transition

---

### 8. Recent Activity Feed

**Layout:**
```
Recent Activity
┌─────────────────────────────────┐
│ 💸 Payment Split                │
│ $500 → 4 buckets                │  ← Transaction card
│ 2 hours ago                     │
├─────────────────────────────────┤
│ 📈 Yield Earned                 │
│ +$1.23 in Savings               │
│ 1 day ago                       │
├─────────────────────────────────┤
│ 🔄 Transfer                     │
│ $200 Spendable → Savings        │
│ 3 days ago                      │
└─────────────────────────────────┘
```

**Features:**
- Infinite scroll or "Load more" button
- Icon for each transaction type
- Tap to view transaction details
- Pull-to-refresh on mobile

---

## Animations & Micro-interactions

### Required Animations
1. **Bucket cards**: Hover lift + glow, tap scale down
2. **Modals**: Slide up from bottom (mobile), fade + scale (desktop)
3. **Gesture feedback**: 
   - Pinch → Green ripple at finger position
   - Swipe right → Big green checkmark + "Confirmed" text
   - Swipe left → Big red X + "Cancelled" text
4. **Balance updates**: Number count-up animation
5. **Toggle button**: Smooth color transition + icon morph
6. **Loading states**: Skeleton screens for bucket cards
7. **Pull-to-refresh**: Spinner at top of dashboard

---

## Responsive Breakpoints

- **Mobile**: 375px - 767px (primary target)
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

**Mobile-specific:**
- 2x2 bucket grid
- Full-screen modals
- Floating action buttons
- Swipe gestures for navigation

**Desktop-specific:**
- 4-column bucket grid
- Sidebar navigation (optional)
- Hover states
- Larger typography

---

## Technical Requirements

### Framework & Libraries
- **React 18+** with TypeScript
- **Next.js 14** (App Router)
- **Tailwind CSS** for styling
- **shadcn/ui** for base components
- **Framer Motion** for animations
- **RainbowKit** for wallet connection
- **wagmi** for blockchain interactions
- **viem** for Ethereum utilities

### State Management
- React Context for global state (gesture toggle, user settings)
- wagmi hooks for blockchain state (balances, transactions)
- Local storage for user preferences

### Performance
- Lazy load modals and heavy components
- Optimize images and icons
- Debounce input fields
- Cache blockchain data with SWR pattern

---

## Integration Points (Existing Smart Contracts)

### Contract Addresses (from .env)
```typescript
NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS
NEXT_PUBLIC_BILLS_VAULT_ADDRESS
NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS
NEXT_PUBLIC_GROWTH_VAULT_ADDRESS
NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS
NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS
```

### Key Contract Functions to Call

**PaymentRouter:**
- `setAutoSplitEnabled(bool)` - Enable/disable auto-split
- `setSplitRatios(uint256[4])` - Update split percentages
- `isAutoSplitEnabled(address)` - Check if enabled

**BucketVaultV3 (all 4 vaults):**
- `deposit(uint256 assets, address receiver)` - Deposit base asset
- `depositWithToken(address token, uint256 amount, uint256 minShares)` - Deposit any supported token
- `withdraw(uint256 assets, address receiver, address owner)` - Withdraw
- `balanceOf(address)` - Get user's share balance
- `convertToAssets(uint256 shares)` - Convert shares to asset amount
- `getQuote(address token, uint256 amount)` - Get deposit quote

**SweepKeeper:**
- `authorizeAutoSweep()` - Enable auto-sweep
- `revokeAutoSweep()` - Disable auto-sweep
- `isAuthorized(address)` - Check if user authorized
- `setCustomMinBalance(uint256)` - Set custom minimum balance

### wagmi Hooks to Use
```typescript
import { useAccount, useBalance, useContractRead, useContractWrite } from 'wagmi'

// Get connected wallet
const { address, isConnected } = useAccount()

// Get bucket balance
const { data: balance } = useBalance({
  address: userAddress,
  token: bucketVaultAddress,
})

// Read contract data
const { data: isEnabled } = useContractRead({
  address: paymentRouterAddress,
  abi: paymentRouterABI,
  functionName: 'isAutoSplitEnabled',
  args: [userAddress],
})

// Write to contract
const { write: deposit } = useContractWrite({
  address: savingsVaultAddress,
  abi: bucketVaultABI,
  functionName: 'deposit',
})
```

---

## User Flows to Support

### 1. First-Time User
1. Land on dashboard → See "Connect Wallet" button
2. Click → RainbowKit modal opens
3. Select wallet → Connect
4. Dashboard loads with empty buckets
5. Tooltip: "Receive a payment to see auto-split in action"

### 2. Receiving Payment (Auto-Split Enabled)
1. User receives 500 USDC
2. PaymentRouter automatically splits:
   - 250 USDC → Bills
   - 100 USDC → Savings (→ USDY)
   - 100 USDC → Growth (→ mETH)
   - 50 USDC → Spendable
3. Dashboard updates with animation
4. Toast notification: "Payment split! 💰"

### 3. Depositing to a Bucket
1. Tap Savings bucket card
2. Modal opens → Tap "Deposit"
3. Select token (USDC, ETH, etc.)
4. Enter amount → See quote
5. Tap "Confirm" (or swipe right with gesture)
6. Wallet prompts for approval
7. Transaction confirmed → Balance updates

### 4. Transferring Between Buckets
1. Long-press Spendable bucket
2. Quick menu: "Transfer to..."
3. Select destination (Savings)
4. Enter amount
5. Swipe right to confirm
6. Transaction executes

### 5. Enabling Auto-Sweep
1. Go to Settings
2. Toggle "Auto-Sweep" ON
3. Wallet prompts to call `authorizeAutoSweep()`
4. Confirm transaction
5. Toast: "Auto-sweep enabled! Leftovers will move to highest yield bucket at month-end"

---

## Error Handling & Edge Cases

### Display Clear Errors For:
- Insufficient balance
- Network not Mantle
- Transaction rejected
- Slippage too high
- Contract call failed
- Wallet not connected

### Loading States:
- Skeleton screens for bucket cards
- Spinner for transaction pending
- Disabled buttons during loading
- "Confirming..." text on buttons

### Empty States:
- No transactions yet → "Your activity will appear here"
- Zero balance → "Deposit funds to start earning yield"

---

## Accessibility

- **Keyboard navigation**: Tab through all interactive elements
- **Screen reader support**: Proper ARIA labels
- **Color contrast**: WCAG AA compliant
- **Touch targets**: Minimum 48x48px
- **Focus indicators**: Visible focus rings

---

## Success Metrics (What Makes This UI Great)

1. **Instant clarity**: User understands their financial status in < 3 seconds
2. **Gesture delight**: Pinch/swipe feels magical, not gimmicky
3. **Mobile-first**: Works perfectly on phone (primary use case)
4. **Fast interactions**: All actions complete in < 2 taps
5. **Beautiful**: Screenshot-worthy UI that goes viral on Twitter

---

## Example Component Structure

```
components/
├── bucket/
│   ├── BucketCard.tsx
│   ├── BucketDetailModal.tsx
│   └── BucketGrid.tsx
├── deposit/
│   ├── DepositModal.tsx
│   ├── TokenSelector.tsx
│   └── QuotePreview.tsx
├── transfer/
│   └── TransferModal.tsx
├── dashboard/
│   ├── Dashboard.tsx
│   ├── HeroSection.tsx
│   └── ActivityFeed.tsx
├── settings/
│   ├── AutoSplitToggle.tsx
│   ├── SplitRatioSliders.tsx
│   └── AutoSweepToggle.tsx
├── gesture/
│   ├── GestureController.tsx
│   └── GestureToggleButton.tsx
├── wallet/
│   └── WalletButton.tsx (RainbowKit wrapper)
└── ui/ (shadcn components)
    ├── button.tsx
    ├── card.tsx
    ├── modal.tsx
    ├── slider.tsx
    └── toggle.tsx
```

---

## Final Notes for v0.dev

**Generate a complete, production-ready frontend that:**
- Looks stunning on mobile (primary target)
- Has smooth animations and micro-interactions
- Integrates seamlessly with existing smart contracts via wagmi
- Uses RainbowKit for beautiful wallet connection
- Supports gesture controls (we'll integrate MediaPipe separately)
- Follows modern React/Next.js best practices
- Is fully typed with TypeScript
- Uses Tailwind CSS for styling
- Includes all modals, forms, and interactive elements

**Do NOT generate:**
- Smart contracts (already exist)
- Backend/API (all on-chain)
- Gesture recognition logic (we have GestureController.tsx)
- Testing files (we'll add later)

**Focus on:**
- Beautiful, intuitive UI components
- Smooth animations and transitions
- Clear financial data visualization
- Mobile-first responsive design
- Proper wagmi/RainbowKit integration patterns

---

## Quick Start After v0.dev Generation

1. Copy generated components to `/components`
2. Update contract addresses in `.env.local`
3. Wrap app with RainbowKit + wagmi providers
4. Add GestureController wrapper (we provide this)
5. Test on Mantle Sepolia testnet
6. Deploy to Vercel

---

**This is everything v0.dev needs to generate a world-class PalmBudget frontend. 🚀**
