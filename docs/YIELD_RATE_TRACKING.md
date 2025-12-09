# Dynamic Yield Rate Tracking Implementation

## Overview

This document describes the implementation of dynamic yield rate tracking for the PalmBudget application, which monitors yield rates across all buckets in real-time and automatically recalculates the optimal sweep destination.

## Implementation Details

### 1. Core Hook: `useYieldRateTracking`

**Location:** `lib/hooks/useYieldRateTracking.ts`

**Purpose:** Provides real-time monitoring of yield rates across all buckets (Bills, Savings, Growth) and identifies the highest-yielding bucket for sweep operations.

**Key Features:**
- Fetches yield rates from all three yield-bearing vaults
- Queries the SweepKeeper contract for the optimized highest yield calculation
- Automatically refetches data every 30 seconds
- Updates on every new block for real-time accuracy
- Provides utility functions for yield comparison and calculation

**Exported Interface:**
```typescript
interface BucketYieldInfo {
  address: Address
  name: string
  yieldRate: bigint
  isLoading: boolean
  error: Error | null
}

interface YieldComparison {
  highest: BucketYieldInfo | null
  buckets: BucketYieldInfo[]
  isLoading: boolean
  hasError: boolean
}
```

**Hook Returns:**
- `yieldComparison`: Complete comparison data
- `highest`: The bucket with the highest yield rate
- `buckets`: Array of all buckets sorted by yield rate
- `isLoading`: Loading state
- `hasError`: Error state
- `refetchAll()`: Manually refetch all yield rates
- `getYieldRateForBucket(address)`: Get yield rate for specific bucket
- `compareYields(bucket1, bucket2)`: Compare two buckets
- `calculateYieldIncrease(amount, from, to)`: Calculate expected yield increase

### 2. UI Component: `YieldRateComparison`

**Location:** `components/yield/YieldRateComparison.tsx`

**Purpose:** Displays yield rate comparison in a user-friendly format with visual indicators.

**Features:**
- Highlights the highest-yielding bucket with a trophy icon
- Shows all bucket yields sorted by rate
- Color-coded yield rates (green for high, blue for medium, gray for low)
- Displays rank for each bucket
- Auto-update notification
- Responsive design

**Props:**
```typescript
interface YieldRateComparisonProps {
  showDetails?: boolean  // Show detailed comparison (default: true)
  className?: string     // Additional CSS classes
}
```

### 3. Integration Points

#### A. SweepNotifications Component
**Updated:** `components/sweep/SweepNotifications.tsx`

**Changes:**
- Added yield rate tracking hook integration
- Displays current best destination in notification panel footer
- Shows real-time yield rate for the optimal bucket
- Updates automatically when rates change

#### B. SweepAuthorizationToggle Component
**Updated:** `components/settings/SweepAuthorizationToggle.tsx`

**Changes:**
- Added "Current Sweep Destination" section
- Displays highest-yielding bucket with visual emphasis
- Shows all bucket yields for comparison
- Indicates automatic destination updates

#### C. Dashboard Component
**Updated:** `components/dashboard/Dashboard.tsx`

**Changes:**
- Replaced static yield display with dynamic `YieldRateComparison` component
- Shows real-time yield rates and sweep destination
- Integrated into "Yield Performance & Sweep Destination" section

### 4. Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    useYieldRateTracking                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Bills Vault  │  │Savings Vault │  │ Growth Vault │     │
│  │ getYieldRate │  │ getYieldRate │  │ getYieldRate │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  SweepKeeper   │                       │
│                    │getHighestYield │                       │
│                    └───────┬────────┘                       │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │ Yield Comparison│                      │
│                    │   & Sorting     │                      │
│                    └───────┬────────┘                       │
└────────────────────────────┼──────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐       ┌───────▼────────┐
        │ UI Components  │       │  Sweep Logic   │
        │ - Dashboard    │       │ - Auto-sweep   │
        │ - Notifications│       │ - Destination  │
        │ - Settings     │       │   Selection    │
        └────────────────┘       └────────────────┘
```

### 5. Real-Time Updates

The system uses multiple strategies for real-time updates:

1. **Polling:** Refetches data every 30 seconds
2. **Block Watching:** Updates on every new block via `useBlockNumber({ watch: true })`
3. **Manual Refresh:** Provides `refetchAll()` function for manual updates

### 6. Yield Rate Format

Yield rates are stored as basis points (1/10000):
- Contract returns: `500` = 5.00% APY
- Display format: Divide by 100 to get percentage
- Example: `1200` basis points = 12.00% APY

### 7. Sweep Destination Logic

The sweep destination is determined by:
1. **Primary:** SweepKeeper's `getHighestYieldBucket()` function (optimized on-chain calculation)
2. **Fallback:** Local comparison of all bucket yield rates
3. **Auto-update:** Recalculates whenever yield rates change

### 8. Error Handling

- Individual bucket errors don't block the entire comparison
- Graceful degradation if SweepKeeper data unavailable
- Loading states for each bucket independently
- User-friendly error messages in UI

## Usage Examples

### Basic Usage in a Component

```typescript
import { useYieldRateTracking } from '@/lib/hooks'
import { useChainId } from 'wagmi'

function MyComponent() {
  const chainId = useChainId()
  const { highest, buckets, isLoading } = useYieldRateTracking(chainId)

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <h2>Best Destination: {highest?.name}</h2>
      <p>Yield: {(Number(highest?.yieldRate || 0n) / 100).toFixed(2)}%</p>
    </div>
  )
}
```

### Using the YieldRateComparison Component

```typescript
import { YieldRateComparison } from '@/components/yield/YieldRateComparison'

function Dashboard() {
  return (
    <div>
      <h1>Yield Rates</h1>
      <YieldRateComparison showDetails={true} />
    </div>
  )
}
```

### Calculating Yield Increase

```typescript
const { calculateYieldIncrease, getYieldRateForBucket } = useYieldRateTracking(chainId)

// Calculate expected yield increase from moving 1000 USDC
const amount = parseUnits('1000', 6) // 1000 USDC
const increase = calculateYieldIncrease(
  amount,
  spendableVaultAddress,
  savingsVaultAddress
)

console.log(`Expected annual yield increase: ${formatUnits(increase, 6)} USDC`)
```

## Testing

To test the implementation:

1. **Connect Wallet:** Ensure wallet is connected to Mantle Network
2. **Check Dashboard:** Navigate to dashboard and verify yield rates display
3. **Monitor Updates:** Watch for automatic updates every 30 seconds
4. **Check Settings:** Go to settings and verify sweep destination shows correctly
5. **View Notifications:** Open sweep notifications and check footer shows current best destination

## Requirements Validation

This implementation satisfies **Requirement 4.5**:
> "WHEN yield rates change, THE PalmBudget_System SHALL update sweep destination preferences automatically"

**How it's satisfied:**
- ✅ Monitors yield rates in real-time
- ✅ Automatically recalculates highest-yielding bucket
- ✅ Updates UI to show current best destination
- ✅ Integrates with SweepKeeper for optimized calculations
- ✅ Provides visual feedback to users about destination changes

## Future Enhancements

Potential improvements for future iterations:

1. **Historical Tracking:** Store yield rate history for trend analysis
2. **Notifications:** Alert users when sweep destination changes
3. **Predictions:** Use historical data to predict future yield rates
4. **Customization:** Allow users to set yield rate preferences
5. **Analytics:** Provide detailed yield performance analytics

## Conclusion

The dynamic yield rate tracking system provides real-time monitoring and automatic recalculation of the optimal sweep destination, ensuring users always benefit from the highest available yields without manual intervention.
