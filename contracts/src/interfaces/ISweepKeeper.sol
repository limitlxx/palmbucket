// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISweepKeeper
 * @notice Interface for the SweepKeeper automated fund optimization contract
 * @dev This interface defines all external functions for the SweepKeeper contract,
 *      which automatically sweeps idle funds from the Spendable bucket to the
 *      highest-yielding bucket at month-end.
 * 
 * ## Overview
 * 
 * The SweepKeeper is an automation contract that optimizes user funds by moving
 * leftover balances from the Spendable bucket to whichever bucket (Bills, Savings,
 * or Growth) currently offers the highest yield. This happens automatically during
 * the last 3 days of each month via Gelato Network automation.
 * 
 * ## Key Concepts
 * 
 * ### Authorization
 * Users must explicitly authorize the SweepKeeper before it can manage their funds.
 * This is done by calling `authorizeAutoSweep()`. Users can revoke authorization
 * at any time by calling `revokeAutoSweep()`.
 * 
 * ### Minimum Balance
 * Users can set a custom minimum balance that will always be preserved in their
 * Spendable bucket. If no custom minimum is set, a global default is used.
 * This ensures users always have funds available for immediate spending.
 * 
 * ### Month-End Window
 * Sweeps only occur during the last 3 days of each month. The contract uses
 * accurate calendar math to handle all month lengths (28-31 days) and leap years.
 * 
 * ### Gelato Integration
 * The contract provides a `checker()` function that Gelato Network calls to
 * determine if a sweep should be executed. If conditions are met, Gelato
 * automatically calls `executeSweep()`.
 * 
 * ## Usage Example
 * 
 * ```solidity
 * // 1. User authorizes auto-sweep
 * sweepKeeper.authorizeAutoSweep();
 * 
 * // 2. User sets custom minimum (optional)
 * sweepKeeper.setUserMinimumBalance(50e6); // 50 USDC
 * 
 * // 3. User approves SweepKeeper to spend Spendable vault shares
 * spendableVault.approve(address(sweepKeeper), type(uint256).max);
 * 
 * // 4. During month-end, Gelato checks if sweep should execute
 * (bool canExec, bytes memory payload) = sweepKeeper.checker(userAddress);
 * 
 * // 5. If conditions met, Gelato executes the sweep
 * if (canExec) {
 *     (bool success, ) = address(sweepKeeper).call(payload);
 * }
 * 
 * // 6. User can check last sweep time
 * uint256 lastSweep = sweepKeeper.getLastSweepTimestamp(userAddress);
 * 
 * // 7. User can revoke authorization anytime
 * sweepKeeper.revokeAutoSweep();
 * ```
 * 
 * ## Security Considerations
 * 
 * - Users must approve the SweepKeeper to spend their Spendable vault shares
 * - Users maintain full control via authorization system
 * - Minimum balances are always preserved
 * - Contract can be paused by owner in emergencies
 * - All state-changing functions use reentrancy guards
 * - Follows checks-effects-interactions pattern
 * 
 * ## Admin Functions
 * 
 * The contract owner can:
 * - Set bucket addresses (Bills, Savings, Growth, Spendable)
 * - Update the global default minimum balance
 * - Pause/unpause the contract in emergencies
 * - Transfer ownership
 * 
 * ## Events
 * 
 * The contract emits events for:
 * - Authorization changes
 * - Sweep executions
 * - Minimum balance updates
 * - Bucket address updates
 * - Pause state changes
 */
interface ISweepKeeper {
    // ============================================
    // Events
    // ============================================
    
    /**
     * @notice Emitted when a user's authorization status changes
     * @param user The address of the user
     * @param authorized The new authorization status
     */
    event AuthorizationChanged(address indexed user, bool authorized);
    
    /**
     * @notice Emitted when a sweep is successfully executed
     * @param user The user whose funds were swept
     * @param amount The amount swept (in wei)
     * @param fromBucket The source bucket address
     * @param toBucket The destination bucket address
     * @param expectedYield The expected annual yield (in wei)
     * @param timestamp The block timestamp
     */
    event SweepExecuted(
        address indexed user,
        uint256 amount,
        address indexed fromBucket,
        address indexed toBucket,
        uint256 expectedYield,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when a user updates their custom minimum balance
     * @param user The user address
     * @param newMinimum The new minimum balance
     */
    event UserMinimumBalanceUpdated(address indexed user, uint256 newMinimum);
    
    /**
     * @notice Emitted when the global default minimum is updated
     * @param newMinimum The new global minimum balance
     */
    event GlobalMinimumBalanceUpdated(uint256 newMinimum);
    
    /**
     * @notice Emitted when bucket addresses are updated
     * @param bills Bills bucket address
     * @param savings Savings bucket address
     * @param growth Growth bucket address
     * @param spendable Spendable bucket address
     */
    event BucketAddressesUpdated(
        address bills,
        address savings,
        address growth,
        address spendable
    );

    // ============================================
    // Custom Errors
    // ============================================
    
    /// @notice Thrown when a bucket address is invalid (zero address)
    error InvalidBucketAddress();
    
    /// @notice Thrown when minimum balance exceeds reasonable limits
    error InvalidMinimumBalance();
    
    /// @notice Thrown when user has insufficient balance for sweep
    error InsufficientBalance();
    
    /// @notice Thrown when a transfer operation fails
    error TransferFailed();
    
    /// @notice Thrown when sweep attempted outside month-end window
    error NotMonthEnd();
    
    /// @notice Thrown when user has not authorized auto-sweep
    error NotAuthorized();
    
    /// @notice Thrown when user tries to authorize but already is
    error AlreadyAuthorized();
    
    /// @notice Thrown when user tries to revoke but not authorized
    error NotAuthorizedYet();
    
    /// @notice Thrown when operation attempted while paused
    error ContractPaused();

    // ============================================
    // Authorization Functions
    // ============================================
    
    /**
     * @notice Authorize the SweepKeeper to manage caller's funds
     * @dev Must be called before sweeps can occur for this user
     */
    function authorizeAutoSweep() external;
    
    /**
     * @notice Revoke authorization for the SweepKeeper
     * @dev Prevents future sweeps until re-authorized
     */
    function revokeAutoSweep() external;
    
    /**
     * @notice Check if a user has authorized auto-sweep
     * @param user The user address to check
     * @return True if authorized, false otherwise
     */
    function isAuthorized(address user) external view returns (bool);

    // ============================================
    // Minimum Balance Management
    // ============================================
    
    /**
     * @notice Set a custom minimum balance for the caller
     * @param minimum The minimum balance to maintain (in wei)
     * @dev Overrides the global default for this user
     */
    function setUserMinimumBalance(uint256 minimum) external;
    
    /**
     * @notice Get the effective minimum balance for a user
     * @param user The user address
     * @return The minimum balance (custom or global default)
     */
    function getUserMinimumBalance(address user) external view returns (uint256);
    
    /**
     * @notice Set the global default minimum balance (owner only)
     * @param minimum The new global minimum (in wei)
     * @dev Only affects users who haven't set custom minimums
     */
    function setGlobalMinimumBalance(uint256 minimum) external;

    // ============================================
    // Sweep Execution
    // ============================================
    
    /**
     * @notice Execute a sweep for a user
     * @param user The user whose funds to sweep
     * @dev Typically called by Gelato automation during month-end
     */
    function executeSweep(address user) external;
    
    /**
     * @notice Calculate the sweepable amount for a user
     * @param user The user address
     * @return The amount available to sweep (in wei)
     */
    function getSweepableAmount(address user) external view returns (uint256);
    
    /**
     * @notice Get the bucket with the highest current yield
     * @return bucket The address of the highest-yield bucket
     * @return yieldRate The yield rate in basis points
     */
    function getHighestYieldBucket() external view returns (address bucket, uint256 yieldRate);

    // ============================================
    // Time Management
    // ============================================
    
    /**
     * @notice Check if current time is within month-end window
     * @return True if in last 3 days of month, false otherwise
     */
    function isMonthEnd() external view returns (bool);
    
    /**
     * @notice Get the current day of the month
     * @return Day of month (1-31)
     */
    function getDayOfMonth() external view returns (uint256);
    
    /**
     * @notice Get the number of days in the current month
     * @return Number of days (28-31)
     */
    function getDaysInMonth() external view returns (uint256);
    
    /**
     * @notice Calculate time until next month-end window
     * @return Seconds until month-end (0 if already in window)
     */
    function getTimeUntilNextSweep() external view returns (uint256);

    // ============================================
    // Gelato Integration
    // ============================================
    
    /**
     * @notice Gelato-compatible checker function
     * @param user The user to check
     * @return canExec True if sweep should execute
     * @return execPayload The encoded function call
     * @dev Never reverts, returns false on any error
     */
    function checker(address user) external view returns (bool canExec, bytes memory execPayload);

    // ============================================
    // Admin Functions
    // ============================================
    
    /**
     * @notice Set all bucket addresses (owner only)
     * @param bills Bills bucket address
     * @param savings Savings bucket address
     * @param growth Growth bucket address
     * @param spendable Spendable bucket address
     */
    function setBucketAddresses(
        address bills,
        address savings,
        address growth,
        address spendable
    ) external;
    
    /**
     * @notice Pause the contract (owner only)
     * @dev Prevents all sweep executions
     */
    function pause() external;
    
    /**
     * @notice Unpause the contract (owner only)
     * @dev Resumes normal operation
     */
    function unpause() external;

    // ============================================
    // State Queries
    // ============================================
    
    /**
     * @notice Get the timestamp of last sweep for a user
     * @param user The user address
     * @return The Unix timestamp (0 if never swept)
     */
    function getLastSweepTimestamp(address user) external view returns (uint256);
    
    /**
     * @notice Check if the contract is paused
     * @return True if paused, false otherwise
     */
    function isPaused() external view returns (bool);
    
    /**
     * @notice Get the global minimum balance
     * @return The global default minimum (in wei)
     */
    function globalMinimumBalance() external view returns (uint256);
    
    /**
     * @notice Get the Bills bucket address
     * @return The Bills bucket vault address
     */
    function billsBucket() external view returns (address);
    
    /**
     * @notice Get the Savings bucket address
     * @return The Savings bucket vault address
     */
    function savingsBucket() external view returns (address);
    
    /**
     * @notice Get the Growth bucket address
     * @return The Growth bucket vault address
     */
    function growthBucket() external view returns (address);
    
    /**
     * @notice Get the Spendable bucket address
     * @return The Spendable bucket vault address
     */
    function spendableBucket() external view returns (address);
}
