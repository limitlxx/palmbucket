# Sweep Notification System

This directory contains components for the auto-sweep notification and history tracking system.

## Components

### SweepNotifications

A real-time notification component that displays sweep execution events as they occur.

**Features:**
- Real-time event listening using wagmi's `useWatchContractEvent`
- Notification bell with unread count badge
- Dropdown panel showing recent sweep notifications
- Displays amount moved, source/destination buckets, and expected yield
- Mark as read/unread functionality
- Shows last sweep timestamp from contract

**Usage:**
```tsx
import { SweepNotifications } from '@/components/sweep'

<SweepNotifications tokenDecimals={6} maxNotifications={10} />
```

**Props:**
- `tokenDecimals` (optional): Number of decimals for token formatting (default: 6)
- `maxNotifications` (optional): Maximum number of notifications to display (default: 10)

### SweepHistory

A comprehensive history view showing all past sweep transactions for the connected user.

**Features:**
- Loads historical sweep events from blockchain using `publicClient.getLogs`
- Displays sweep details including amounts, buckets, and expected yield
- Links to block explorer for transaction verification
- Sorted by timestamp (newest first)
- Loading and error states

**Usage:**
```tsx
import { SweepHistory } from '@/components/sweep'

<SweepHistory tokenDecimals={6} maxEvents={20} />
```

**Props:**
- `tokenDecimals` (optional): Number of decimals for token formatting (default: 6)
- `maxEvents` (optional): Maximum number of historical events to load (default: 20)

## Integration

Both components are integrated into the Dashboard:

1. **SweepNotifications** - Displayed in the header next to the wallet connect button for easy access
2. **SweepHistory** - Displayed as a section in the main dashboard content area

## Requirements Satisfied

This implementation satisfies task 11.3 requirements:
- ✅ Implement event listeners for sweep execution using wagmi
- ✅ Create notification UI component
- ✅ Display amount moved and expected yield increase
- ✅ Add sweep history to transaction log
- ✅ Show last sweep timestamp

## Technical Details

### Event Structure

The components listen for the `SweepExecuted` event from the SweepKeeper contract:

```solidity
event SweepExecuted(
    address indexed user,
    uint256 amount,
    address indexed fromBucket,
    address indexed toBucket,
    uint256 expectedYield,
    uint256 timestamp
);
```

### Wagmi Hooks Used

- `useAccount` - Get connected wallet address
- `useWatchContractEvent` - Listen for real-time sweep events
- `useReadContract` - Read last sweep timestamp
- `usePublicClient` - Query historical events

### Bucket Name Mapping

Both components include helper functions to map bucket addresses to human-readable names:
- Bills Vault → "Bills"
- Savings Vault → "Savings"
- Growth Vault → "Growth"
- Spendable Vault → "Spendable"

## Future Enhancements

Potential improvements for future iterations:
- Push notifications for mobile devices
- Email notifications for sweep events
- Export sweep history to CSV
- Filtering and search functionality
- Aggregate statistics (total swept, average yield, etc.)
