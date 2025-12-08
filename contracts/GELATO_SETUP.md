# Gelato Task Setup Guide for SweepKeeper

This guide explains how to set up Gelato Network automation for the SweepKeeper contract to enable automatic month-end fund sweeps.

## Overview

The SweepKeeper contract is designed to work with Gelato Network, a decentralized automation platform that triggers smart contract functions based on custom conditions. During the last 3 days of each month, Gelato will automatically check if users are eligible for sweeps and execute them.

## Prerequisites

1. **Deployed SweepKeeper Contract**: The SweepKeeper must be deployed and initialized with bucket addresses
2. **Gelato Account**: Create an account at [https://app.gelato.network](https://app.gelato.network)
3. **MNT Tokens**: Fund your Gelato account with MNT tokens to pay for gas fees
4. **User List**: Maintain a list of user addresses who have authorized auto-sweep

## Architecture

```
┌─────────────────┐
│  Gelato Network │
│   (Off-chain)   │
└────────┬────────┘
         │
         │ Every 6 hours during month-end
         │
         ▼
┌─────────────────────────────────────┐
│  SweepKeeper.checker(userAddress)   │
│  Returns: (canExec, execPayload)    │
└────────┬────────────────────────────┘
         │
         │ If canExec == true
         │
         ▼
┌─────────────────────────────────────┐
│  SweepKeeper.executeSweep(user)     │
│  Moves funds to highest-yield bucket│
└─────────────────────────────────────┘
```

## Checker Function

The SweepKeeper provides a Gelato-compatible `checker()` function that validates all conditions:

```solidity
function checker(address user) external view returns (bool canExec, bytes memory execPayload)
```

### Conditions Checked

1. **Contract Not Paused**: Emergency pause is not active
2. **User Authorized**: User has called `authorizeAutoSweep()`
3. **Buckets Initialized**: All bucket addresses are set
4. **Month-End Window**: Current date is in last 3 days of month
5. **Sufficient Balance**: User has sweepable amount > 0

### Return Values

- **canExec**: `true` if all conditions met, `false` otherwise
- **execPayload**: Encoded `executeSweep(user)` call if `canExec` is true, empty bytes otherwise

### Important Properties

- **Never Reverts**: The checker function is designed to never revert, even on errors
- **Graceful Failures**: Returns `false` for any condition failure
- **Gas Efficient**: Uses view functions to minimize gas costs

## Task Configuration

### Check Interval

**Recommended**: Every 6 hours during month-end window

**Rationale**:
- Month-end window is 3 days (72 hours)
- Checking every 6 hours = 12 opportunities per month-end
- Balances gas costs with responsiveness
- Ensures sweeps execute within the window

**Alternative Intervals**:
- **Every 12 hours**: Lower gas costs, fewer checks (6 per month-end)
- **Every 3 hours**: Higher responsiveness, more gas costs (24 per month-end)
- **Every 1 hour**: Maximum responsiveness, highest gas costs (72 per month-end)

### Gas Payment Configuration

#### Option 1: Gelato 1Balance (Recommended)

Use Gelato's 1Balance system to pay for gas across multiple chains:

1. Deposit MNT tokens to your Gelato 1Balance account
2. Gelato automatically deducts gas costs from your balance
3. No need to fund individual task contracts

**Advantages**:
- Simplified gas management
- Works across multiple chains
- Automatic gas price optimization
- Easy to monitor and refill

#### Option 2: Task-Specific Treasury

Create a dedicated treasury contract that holds MNT for gas:

1. Deploy a treasury contract
2. Fund it with MNT tokens
3. Configure Gelato task to use this treasury

**Advantages**:
- More control over gas spending
- Can implement custom logic
- Isolated from other tasks

### Task Parameters

```typescript
{
  name: "SweepKeeper Auto-Sweep",
  execAddress: SWEEP_KEEPER_ADDRESS,
  execSelector: "0x...", // executeSweep(address) selector
  dedicatedMsgSender: true, // Use dedicated msg.sender
  useTreasury: false, // Use 1Balance instead
  singleExec: false, // Allow multiple executions
}
```

## Setup Instructions

### Step 1: Verify Contract Deployment

Ensure your SweepKeeper contract is deployed and initialized:

```bash
# Check deployment
npx hardhat verify-contract --address <SWEEP_KEEPER_ADDRESS> --network mantle_sepolia

# Verify bucket addresses are set
cast call <SWEEP_KEEPER_ADDRESS> "billsBucket()(address)" --rpc-url $MANTLE_SEPOLIA_RPC_URL
```

### Step 2: Create Gelato Account

1. Visit [https://app.gelato.network](https://app.gelato.network)
2. Connect your wallet
3. Navigate to "1Balance" section
4. Deposit MNT tokens (recommended: 10-50 MNT for testing)

### Step 3: Prepare User List

Create a list of user addresses who have authorized auto-sweep:

```typescript
// Query authorization events
const authEvents = await sweepKeeper.queryFilter(
  sweepKeeper.filters.AuthorizationChanged()
);

// Filter for currently authorized users
const authorizedUsers = authEvents
  .filter(event => event.args.authorized === true)
  .map(event => event.args.user);
```

### Step 4: Create Gelato Task

Use the provided script to create tasks programmatically:

```bash
# For testnet (Mantle Sepolia)
npx hardhat run contracts/scripts/create-gelato-task.ts --network mantle_sepolia

# For mainnet (Mantle)
npx hardhat run contracts/scripts/create-gelato-task.ts --network mantle_mainnet
```

Or create manually through Gelato UI:

1. Go to [https://app.gelato.network/new-task](https://app.gelato.network/new-task)
2. Select "Mantle" network
3. Choose "Resolver" task type
4. Enter SweepKeeper contract address
5. Select `checker(address)` as resolver function
6. Enter user address as parameter
7. Set check interval to 6 hours
8. Enable task

### Step 5: Monitor Task Execution

Monitor your Gelato tasks:

1. Visit [https://app.gelato.network/tasks](https://app.gelato.network/tasks)
2. View execution history
3. Check gas costs
4. Monitor success/failure rates

Query on-chain sweep history:

```bash
# Check last sweep timestamp for a user
cast call <SWEEP_KEEPER_ADDRESS> "getLastSweepTimestamp(address)(uint256)" <USER_ADDRESS> --rpc-url $MANTLE_SEPOLIA_RPC_URL

# Query sweep events
cast logs --address <SWEEP_KEEPER_ADDRESS> --event "SweepExecuted(address,uint256,address,address,uint256,uint256)" --from-block <START_BLOCK> --rpc-url $MANTLE_SEPOLIA_RPC_URL
```

## Multi-User Setup

For managing multiple users, you have two options:

### Option A: One Task Per User

Create a separate Gelato task for each authorized user:

**Advantages**:
- Independent execution per user
- Easy to enable/disable per user
- Clear gas attribution

**Disadvantages**:
- More tasks to manage
- Higher fixed costs (if any)

### Option B: Batch Checker Contract

Deploy a batch checker contract that checks multiple users:

```solidity
contract BatchSweepChecker {
    ISweepKeeper public sweepKeeper;
    address[] public users;
    
    function checker() external view returns (bool canExec, bytes memory execPayload) {
        for (uint i = 0; i < users.length; i++) {
            (bool userCanExec, bytes memory userPayload) = sweepKeeper.checker(users[i]);
            if (userCanExec) {
                return (true, userPayload);
            }
        }
        return (false, bytes(""));
    }
}
```

**Advantages**:
- Single task to manage
- Lower fixed costs
- Easier to add/remove users

**Disadvantages**:
- Higher gas costs per check
- Sequential execution
- One failure doesn't block others

## Gas Cost Estimation

### Per-Check Costs

- **Checker Call**: ~50,000 gas (~$0.01 at 20 gwei)
- **ExecuteSweep Call**: ~200,000-300,000 gas (~$0.04-$0.06 at 20 gwei)

### Monthly Costs Per User

Assuming:
- 12 checks per month-end (every 6 hours for 3 days)
- 1 successful sweep per month

**Total Monthly Cost**: ~$0.12 + $0.05 = **$0.17 per user per month**

### Optimization Tips

1. **Adjust Check Frequency**: Reduce to every 12 hours to halve check costs
2. **Batch Users**: Use batch checker for multiple users
3. **Smart Scheduling**: Only activate tasks during month-end window
4. **Gas Price Monitoring**: Use Gelato's gas price optimization

## Testing

### Testnet Testing (Mantle Sepolia)

1. Deploy contracts to Mantle Sepolia
2. Create test Gelato task
3. Authorize test user
4. Wait for month-end or manually trigger
5. Verify sweep execution
6. Check gas costs and timing

### Time Manipulation for Testing

For local testing, you can manipulate block timestamp:

```typescript
// Hardhat Network
await network.provider.send("evm_setNextBlockTimestamp", [monthEndTimestamp]);
await network.provider.send("evm_mine");

// Test checker
const [canExec, payload] = await sweepKeeper.checker(userAddress);
expect(canExec).to.be.true;
```

### Mainnet Testing

1. Start with small number of users (1-5)
2. Monitor for 1-2 month-end cycles
3. Verify all sweeps execute correctly
4. Check gas costs are within budget
5. Gradually add more users

## Troubleshooting

### Task Not Executing

**Check**:
1. Is contract paused? Call `isPaused()`
2. Is user authorized? Call `isAuthorized(user)`
3. Is it month-end? Call `isMonthEnd()`
4. Does user have balance? Call `getSweepableAmount(user)`
5. Is Gelato balance sufficient?

**Solutions**:
- Unpause contract if needed
- Ensure user called `authorizeAutoSweep()`
- Wait for month-end window
- Ensure user has funds above minimum
- Refill Gelato 1Balance

### High Gas Costs

**Check**:
1. Check frequency too high?
2. Too many users per task?
3. Gas price spikes?

**Solutions**:
- Reduce check frequency
- Split users across multiple tasks
- Use Gelato's gas price optimization
- Consider batch checker contract

### Failed Executions

**Check**:
1. View Gelato execution logs
2. Check on-chain transaction
3. Review revert reason

**Common Causes**:
- User revoked authorization mid-execution
- Insufficient vault balance
- Transfer approval missing
- Contract paused during execution

**Solutions**:
- Ensure users maintain authorization
- Verify vault balances
- Check approval status
- Monitor pause state

## Security Considerations

### User Authorization

- Users must explicitly call `authorizeAutoSweep()`
- Users can revoke anytime via `revokeAutoSweep()`
- No sweeps possible without authorization

### Minimum Balance Protection

- User's minimum balance is always preserved
- Custom minimums override global default
- Prevents complete drain of Spendable bucket

### Emergency Controls

- Owner can pause contract anytime
- Paused state prevents all sweeps
- Checker returns false when paused
- Gelato respects pause state

### Reentrancy Protection

- All state changes use `nonReentrant` modifier
- Follows checks-effects-interactions pattern
- Protected against malicious vault contracts

## Maintenance

### Regular Tasks

1. **Monitor Gelato Balance**: Refill when low
2. **Check Execution Success**: Review monthly
3. **Update User List**: Add/remove as needed
4. **Review Gas Costs**: Optimize if needed
5. **Verify Sweeps**: Confirm users are swept

### Quarterly Review

1. Analyze gas cost trends
2. Review execution success rates
3. Optimize check frequency if needed
4. Update documentation
5. Consider batch checker if user count grows

## Support and Resources

- **Gelato Documentation**: [https://docs.gelato.network](https://docs.gelato.network)
- **Gelato Discord**: [https://discord.gg/gelato](https://discord.gg/gelato)
- **SweepKeeper Contract**: See `contracts/src/SweepKeeper.sol`
- **Interface Documentation**: See `contracts/src/interfaces/ISweepKeeper.sol`

## Example Task Creation Code

See `contracts/scripts/create-gelato-task.ts` for a complete example of programmatically creating Gelato tasks for the SweepKeeper contract.

## Conclusion

With proper Gelato setup, the SweepKeeper provides fully automated month-end fund optimization for PalmBudget users. The system is designed to be reliable, cost-effective, and secure, with multiple safeguards to protect user funds.

For questions or issues, please refer to the troubleshooting section or contact the development team.
