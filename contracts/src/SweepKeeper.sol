// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@quant-finance/solidity-datetime/contracts/DateTime.sol";

/**
 * @title IBucketVault
 * @notice Interface for bucket vault operations (ERC4626 compatible)
 * @dev Vaults are ERC4626 tokens where balanceOf returns shares, not underlying assets.
 *      This interface defines the required functions for interacting with bucket vaults
 *      that hold user funds and generate yield through various DeFi protocols.
 */
interface IBucketVault {
    /**
     * @notice Get the current annual yield rate for this vault
     * @return The yield rate in basis points (1% = 100 basis points)
     * @dev Used to determine which bucket has the highest yield for sweep operations
     */
    function getYieldRate() external view returns (uint256);
    
    /**
     * @notice Get the share balance of an account
     * @param account The address to query
     * @return The number of vault shares owned by the account
     * @dev Returns shares, not underlying asset amount. Use convertToAssets for asset value.
     */
    function balanceOf(address account) external view returns (uint256);
    
    /**
     * @notice Get the underlying asset token address
     * @return The address of the ERC20 token used as the vault's underlying asset
     */
    function asset() external view returns (address);
    
    /**
     * @notice Convert share amount to underlying asset amount
     * @param shares The number of shares to convert
     * @return The equivalent amount of underlying assets
     */
    function convertToAssets(uint256 shares) external view returns (uint256);
    
    /**
     * @notice Convert asset amount to share amount
     * @param assets The amount of underlying assets to convert
     * @return The equivalent number of shares
     */
    function convertToShares(uint256 assets) external view returns (uint256);
    
    /**
     * @notice Transfer shares from one address to another
     * @param from The address to transfer from
     * @param to The address to transfer to
     * @param amount The number of shares to transfer
     * @return True if transfer succeeded
     * @dev Requires approval from the 'from' address
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    /**
     * @notice Withdraw assets from the vault by burning shares
     * @param assets The amount of underlying assets to withdraw
     * @param receiver The address that will receive the assets
     * @param owner The address that owns the shares being burned
     * @return shares The number of shares burned
     * @dev Requires approval if caller is not the owner
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    
    /**
     * @notice Deposit assets into the vault and mint shares
     * @param assets The amount of underlying assets to deposit
     * @param receiver The address that will receive the minted shares
     * @return shares The number of shares minted
     * @dev Requires approval for the vault to spend caller's assets
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

/**
 * @title SweepKeeper
 * @notice Automated keeper contract for sweeping leftover funds to highest-yielding buckets
 * @dev Designed to be triggered by Gelato Network at month-end. This contract optimizes user
 *      funds by automatically moving idle balances from the Spendable bucket to the bucket
 *      with the highest yield during the last 3 days of each month.
 * 
 * Key Features:
 * - User-controlled authorization system for opt-in automation
 * - Accurate calendar-based month-end detection (handles all month lengths and leap years)
 * - Per-user customizable minimum balances in Spendable bucket
 * - Emergency pause functionality for security incidents
 * - Gelato Network integration for decentralized automation
 * - Comprehensive access controls and reentrancy protection
 * 
 * Security:
 * - Users must explicitly authorize the contract before sweeps can occur
 * - Minimum balances are always preserved in Spendable bucket
 * - All state-changing functions use reentrancy guards
 * - Owner-only admin functions for critical operations
 * - Emergency pause mechanism to halt all sweeps
 * 
 * Usage Flow:
 * 1. User calls authorizeAutoSweep() to enable automation
 * 2. User optionally sets custom minimum balance via setUserMinimumBalance()
 * 3. During month-end (last 3 days), Gelato calls checker() to verify conditions
 * 4. If conditions met, Gelato calls executeSweep() to move funds
 * 5. Funds are swept from Spendable to the highest-yielding bucket
 * 6. User can revoke authorization anytime via revokeAutoSweep()
 */
contract SweepKeeper is Ownable, ReentrancyGuard, Pausable {
    // ============================================
    // Custom Errors
    // ============================================
    
    /// @notice Thrown when a bucket address is zero or not initialized
    error InvalidBucketAddress();
    
    /// @notice Thrown when minimum balance exceeds reasonable limits (>1M USDC)
    error InvalidMinimumBalance();
    
    /// @notice Thrown when user has insufficient balance for sweep operation
    error InsufficientBalance();
    
    /// @notice Thrown when a transfer operation fails
    error TransferFailed();
    
    /// @notice Thrown when sweep is attempted outside month-end window
    error NotMonthEnd();
    
    /// @notice Thrown when user has not authorized auto-sweep
    error NotAuthorized();
    
    /// @notice Thrown when user tries to authorize but is already authorized
    error AlreadyAuthorized();
    
    /// @notice Thrown when user tries to revoke but is not authorized
    error NotAuthorizedYet();
    
    /// @notice Thrown when operation is attempted while contract is paused
    error ContractPaused();

    // ============================================
    // State Variables
    // ============================================
    
    /// @notice Mapping of user addresses to their authorization status
    /// @dev True if user has authorized auto-sweep, false otherwise
    mapping(address => bool) private _authorized;

    /// @notice Per-user custom minimum balances (in wei of underlying asset)
    /// @dev Only used if _hasCustomMinimum[user] is true
    mapping(address => uint256) private _userMinimumBalance;
    
    /// @notice Flag indicating if user has set a custom minimum balance
    /// @dev If false, globalMinimumBalance is used instead
    mapping(address => bool) private _hasCustomMinimum;

    /// @notice Global default minimum balance to maintain in Spendable bucket (in wei)
    /// @dev Used for users who haven't set a custom minimum. Default: 10 USDC (10e6)
    uint256 public globalMinimumBalance;
    
    /// @notice Deprecated minimum balance variable kept for backward compatibility
    /// @dev Use globalMinimumBalance instead. This is kept in sync with globalMinimumBalance.
    uint256 public minimumSpendableBalance;

    /// @notice Address of the Bills bucket vault (typically highest yield, short-term)
    address public billsBucket;
    
    /// @notice Address of the Savings bucket vault (typically medium yield, medium-term)
    address public savingsBucket;
    
    /// @notice Address of the Growth bucket vault (typically variable yield, long-term)
    address public growthBucket;
    
    /// @notice Address of the Spendable bucket vault (source of funds for sweeps)
    address public spendableBucket;

    /// @notice Deprecated global last sweep timestamp kept for backward compatibility
    /// @dev Use getLastSweepTimestamp(user) instead for per-user timestamps
    uint256 public lastSweepTimestamp;
    
    /// @notice Per-user timestamp of last successful sweep
    /// @dev Returns 0 for users who have never been swept
    mapping(address => uint256) private _lastSweepTimestamp;

    // ============================================
    // Events
    // ============================================
    
    /**
     * @notice Emitted when a user's authorization status changes
     * @param user The address of the user
     * @param authorized The new authorization status (true = authorized, false = revoked)
     */
    event AuthorizationChanged(address indexed user, bool authorized);
    
    /**
     * @notice Emitted when a sweep is successfully executed
     * @param user The address of the user whose funds were swept
     * @param amount The amount of underlying assets swept (in wei)
     * @param fromBucket The source bucket (Spendable vault address)
     * @param toBucket The destination bucket (highest yield vault address)
     * @param expectedYield The expected annual yield from the sweep (in wei)
     * @param timestamp The block timestamp when sweep occurred
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
     * @notice Emitted when the global minimum balance is updated (deprecated)
     * @param newMinimum The new minimum balance in wei
     * @dev Deprecated: Use GlobalMinimumBalanceUpdated instead
     */
    event MinimumBalanceUpdated(uint256 newMinimum);
    
    /**
     * @notice Emitted when a user updates their custom minimum balance
     * @param user The address of the user
     * @param newMinimum The new custom minimum balance in wei
     */
    event UserMinimumBalanceUpdated(address indexed user, uint256 newMinimum);
    
    /**
     * @notice Emitted when the global default minimum balance is updated
     * @param newMinimum The new global minimum balance in wei
     */
    event GlobalMinimumBalanceUpdated(uint256 newMinimum);
    
    /**
     * @notice Emitted when bucket addresses are updated by owner
     * @param bills The Bills bucket vault address
     * @param savings The Savings bucket vault address
     * @param growth The Growth bucket vault address
     * @param spendable The Spendable bucket vault address
     */
    event BucketAddressesUpdated(
        address bills,
        address savings,
        address growth,
        address spendable
    );

    // ============================================
    // Constructor
    // ============================================
    
    /**
     * @notice Initialize the SweepKeeper contract
     * @param _minimumSpendableBalance The initial global minimum balance (in wei)
     * @dev Sets the deployer as the owner and initializes the global minimum balance.
     *      Typical value: 10 USDC = 10e6 (assuming 6 decimals for USDC)
     */
    constructor(uint256 _minimumSpendableBalance) Ownable(msg.sender) {
        globalMinimumBalance = _minimumSpendableBalance;
        minimumSpendableBalance = _minimumSpendableBalance; // Backward compatibility
        lastSweepTimestamp = block.timestamp;
    }

    // ============================================
    // Authorization Functions
    // ============================================
    
    /**
     * @notice Authorize the SweepKeeper to manage caller's funds
     * @dev Users must call this function to enable auto-sweep functionality.
     *      Once authorized, the SweepKeeper can sweep funds during month-end.
     *      Users must also approve the SweepKeeper to spend their Spendable vault shares.
     * 
     * Requirements:
     * - Caller must not already be authorized
     * 
     * Emits:
     * - AuthorizationChanged event with user address and true status
     * 
     * Reverts:
     * - AlreadyAuthorized if caller is already authorized
     * 
     * @custom:security Users maintain full control and can revoke anytime
     */
    function authorizeAutoSweep() external {
        if (_authorized[msg.sender]) {
            revert AlreadyAuthorized();
        }
        _authorized[msg.sender] = true;
        emit AuthorizationChanged(msg.sender, true);
    }

    /**
     * @notice Revoke authorization for the SweepKeeper
     * @dev Users can call this function to disable auto-sweep functionality.
     *      After revocation, no sweeps can be executed until re-authorized.
     * 
     * Requirements:
     * - Caller must currently be authorized
     * 
     * Emits:
     * - AuthorizationChanged event with user address and false status
     * 
     * Reverts:
     * - NotAuthorizedYet if caller is not currently authorized
     * 
     * @custom:security Users can revoke authorization at any time
     */
    function revokeAutoSweep() external {
        if (!_authorized[msg.sender]) {
            revert NotAuthorizedYet();
        }
        _authorized[msg.sender] = false;
        emit AuthorizationChanged(msg.sender, false);
    }

    /**
     * @notice Check if a user has authorized auto-sweep
     * @param user The user address to check
     * @return authorized True if user has authorized auto-sweep, false otherwise
     * @dev This is a view function that can be called by anyone to check authorization status
     */
    function isAuthorized(address user) public view returns (bool) {
        return _authorized[user];
    }

    /**
     * @notice Check if the contract is currently paused
     * @return paused True if contract is paused, false if operational
     * @dev When paused, all sweep executions are blocked but view functions still work
     */
    function isPaused() public view returns (bool) {
        return paused();
    }

    // ============================================
    // Minimum Balance Management
    // ============================================
    
    /**
     * @notice Set a custom minimum balance for the caller
     * @param minimum The minimum balance to maintain in Spendable bucket (in wei)
     * @dev Users can set their own minimum balance preference to ensure they always
     *      have enough funds available for immediate spending needs. This overrides
     *      the global default minimum balance for this user.
     * 
     * Requirements:
     * - Minimum must not exceed 1 million USDC (1e12 wei with 6 decimals)
     * 
     * Emits:
     * - UserMinimumBalanceUpdated event with user address and new minimum
     * 
     * Reverts:
     * - InvalidMinimumBalance if minimum exceeds reasonable limits
     * 
     * Example:
     * - To set 50 USDC minimum: setUserMinimumBalance(50e6)
     * - To set 0 minimum (sweep everything): setUserMinimumBalance(0)
     */
    function setUserMinimumBalance(uint256 minimum) external {
        // Validate reasonable minimum (not more than 1 million USDC = 1e12)
        if (minimum > 1e12) {
            revert InvalidMinimumBalance();
        }
        
        _userMinimumBalance[msg.sender] = minimum;
        _hasCustomMinimum[msg.sender] = true;
        
        emit UserMinimumBalanceUpdated(msg.sender, minimum);
    }

    /**
     * @notice Get the effective minimum balance for a user
     * @param user The user address to query
     * @return minimum The minimum balance in wei (custom if set, otherwise global default)
     * @dev Returns the user's custom minimum if they've set one, otherwise returns
     *      the global default minimum balance. This is the amount that will be
     *      preserved in the Spendable bucket during sweeps.
     */
    function getUserMinimumBalance(address user) public view returns (uint256) {
        if (_hasCustomMinimum[user]) {
            return _userMinimumBalance[user];
        }
        return globalMinimumBalance;
    }

    // ============================================
    // Admin Functions (Owner Only)
    // ============================================
    
    /**
     * @notice Set the addresses of all bucket vaults
     * @param _bills Address of the Bills bucket vault
     * @param _savings Address of the Savings bucket vault
     * @param _growth Address of the Growth bucket vault
     * @param _spendable Address of the Spendable bucket vault
     * @dev This function must be called after deployment to initialize the bucket addresses.
     *      All addresses must be valid ERC4626-compatible vault contracts.
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - All addresses must be non-zero
     * 
     * Emits:
     * - BucketAddressesUpdated event with all four addresses
     * 
     * Reverts:
     * - InvalidBucketAddress if any address is zero
     * - Ownable: caller is not the owner (from OpenZeppelin)
     * 
     * @custom:security Only owner can call this function
     */
    function setBucketAddresses(
        address _bills,
        address _savings,
        address _growth,
        address _spendable
    ) external onlyOwner {
        if (_bills == address(0) || _savings == address(0) || 
            _growth == address(0) || _spendable == address(0)) {
            revert InvalidBucketAddress();
        }

        billsBucket = _bills;
        savingsBucket = _savings;
        growthBucket = _growth;
        spendableBucket = _spendable;

        emit BucketAddressesUpdated(_bills, _savings, _growth, _spendable);
    }

    /**
     * @notice Set the minimum balance to maintain in Spendable bucket (deprecated)
     * @param _minimum New minimum balance in wei
     * @dev DEPRECATED: Use setGlobalMinimumBalance() instead.
     *      This function is kept for backward compatibility only.
     * 
     * Requirements:
     * - Caller must be the contract owner
     * 
     * Emits:
     * - MinimumBalanceUpdated event (deprecated)
     * 
     * @custom:security Only owner can call this function
     */
    function setMinimumBalance(uint256 _minimum) external onlyOwner {
        minimumSpendableBalance = _minimum;
        globalMinimumBalance = _minimum;
        emit MinimumBalanceUpdated(_minimum);
    }

    /**
     * @notice Set the global default minimum balance for all users
     * @param minimum New global minimum balance in wei
     * @dev This sets the default minimum balance used for users who haven't set
     *      a custom minimum. Existing custom minimums are not affected.
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - Minimum must not exceed 1 million USDC (1e12 wei with 6 decimals)
     * 
     * Emits:
     * - GlobalMinimumBalanceUpdated event with new minimum
     * 
     * Reverts:
     * - InvalidMinimumBalance if minimum exceeds reasonable limits
     * - Ownable: caller is not the owner (from OpenZeppelin)
     * 
     * Example:
     * - To set 10 USDC default: setGlobalMinimumBalance(10e6)
     * 
     * @custom:security Only owner can call this function
     */
    function setGlobalMinimumBalance(uint256 minimum) external onlyOwner {
        // Validate reasonable minimum (not more than 1 million USDC = 1e12)
        if (minimum > 1e12) {
            revert InvalidMinimumBalance();
        }
        
        globalMinimumBalance = minimum;
        minimumSpendableBalance = minimum; // Keep backward compatibility
        
        emit GlobalMinimumBalanceUpdated(minimum);
    }

    /**
     * @notice Pause the contract to prevent all sweep executions
     * @dev Emergency function to halt all sweep operations. View functions and
     *      user configuration functions remain operational. The Gelato checker
     *      will return false when paused, preventing automated execution.
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - Contract must not already be paused
     * 
     * Emits:
     * - Paused event from OpenZeppelin Pausable
     * 
     * Reverts:
     * - Pausable: paused (from OpenZeppelin if already paused)
     * - Ownable: caller is not the owner (from OpenZeppelin)
     * 
     * @custom:security Only owner can call this function. Use in emergencies.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract to resume sweep executions
     * @dev Restores normal operation after an emergency pause. Sweeps can be
     *      executed again once unpaused (subject to other conditions).
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - Contract must currently be paused
     * 
     * Emits:
     * - Unpaused event from OpenZeppelin Pausable
     * 
     * Reverts:
     * - Pausable: not paused (from OpenZeppelin if not paused)
     * - Ownable: caller is not the owner (from OpenZeppelin)
     * 
     * @custom:security Only owner can call this function
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // Time Calculation Functions
    // ============================================
    
    /**
     * @notice Get the current day of the month
     * @return day The day of month (1-31)
     * @dev Uses BokkyPooBah's DateTime library for accurate calendar calculations.
     *      Handles all month lengths and leap years correctly.
     */
    function getDayOfMonth() public view returns (uint256) {
        return DateTime.getDay(block.timestamp);
    }

    /**
     * @notice Get the current month
     * @return month The month number (1-12, where 1=January, 12=December)
     * @dev Uses BokkyPooBah's DateTime library for accurate calendar calculations
     */
    function getMonth() public view returns (uint256) {
        return DateTime.getMonth(block.timestamp);
    }

    /**
     * @notice Get the current year
     * @return year The current year (e.g., 2024, 2025)
     * @dev Uses BokkyPooBah's DateTime library for accurate calendar calculations
     */
    function getYear() public view returns (uint256) {
        return DateTime.getYear(block.timestamp);
    }

    /**
     * @notice Get the number of days in the current month
     * @return days The number of days in the current month (28-31)
     * @dev Correctly handles:
     *      - 31-day months: Jan, Mar, May, Jul, Aug, Oct, Dec
     *      - 30-day months: Apr, Jun, Sep, Nov
     *      - 29-day month: Feb in leap years
     *      - 28-day month: Feb in non-leap years
     */
    function getDaysInMonth() public view returns (uint256) {
        return DateTime.getDaysInMonth(block.timestamp);
    }

    /**
     * @notice Check if current time is within the month-end window
     * @return isEnd True if within the last 3 days of the current month, false otherwise
     * @dev Month-end window is defined as the last 3 days of any month:
     *      - 31-day month: days 29, 30, 31
     *      - 30-day month: days 28, 29, 30
     *      - 29-day month (leap Feb): days 27, 28, 29
     *      - 28-day month (non-leap Feb): days 26, 27, 28
     * 
     * This function is critical for determining when sweeps can be executed.
     * It uses accurate calendar math to handle all month lengths and leap years.
     * 
     * Example:
     * - January 29, 2024 → true (31-day month, day 29)
     * - February 26, 2024 → true (leap year, 29-day month, day 26)
     * - February 26, 2025 → true (non-leap year, 28-day month, day 26)
     * - March 25, 2024 → false (31-day month, day 25)
     */
    function isMonthEnd() public view returns (bool) {
        uint256 dayOfMonth = getDayOfMonth();
        uint256 daysInMonth = getDaysInMonth();
        
        // Last 3 days of month: if day >= (daysInMonth - 2)
        return dayOfMonth >= daysInMonth - 2;
    }

    // ============================================
    // Sweep Calculation Functions
    // ============================================
    
    /**
     * @notice Determine which bucket currently has the highest yield
     * @return bucket The address of the bucket vault with the highest yield rate
     * @return yieldRate The yield rate of the highest bucket (in basis points)
     * @dev Compares yield rates across Bills, Savings, and Growth buckets.
     *      Yield rates are in basis points (1% = 100 basis points).
     *      This function is used to determine the destination for sweep operations.
     * 
     * Example:
     * - Bills: 500 (5% APY)
     * - Savings: 300 (3% APY)
     * - Growth: 400 (4% APY)
     * - Returns: (billsBucket, 500)
     */
    function getHighestYieldBucket() public view returns (address, uint256) {
        uint256 billsYield = IBucketVault(billsBucket).getYieldRate();
        uint256 savingsYield = IBucketVault(savingsBucket).getYieldRate();
        uint256 growthYield = IBucketVault(growthBucket).getYieldRate();

        address highestBucket = billsBucket;
        uint256 highestYield = billsYield;

        if (savingsYield > highestYield) {
            highestBucket = savingsBucket;
            highestYield = savingsYield;
        }

        if (growthYield > highestYield) {
            highestBucket = growthBucket;
            highestYield = growthYield;
        }

        return (highestBucket, highestYield);
    }

    /**
     * @notice Calculate the amount of funds available for sweeping for a user
     * @param user The user address to check
     * @return amount The amount available to sweep in vault shares (wei)
     * @dev Calculates: balance - minimum_balance
     *      Returns 0 if balance is less than or equal to minimum balance.
     *      Uses the user's custom minimum if set, otherwise uses global default.
     * 
     * The minimum balance is always preserved to ensure users have funds
     * available for immediate spending needs.
     * 
     * Example:
     * - User has 100 USDC in Spendable bucket
     * - User's minimum is 10 USDC
     * - Returns: 90 USDC (90e6 wei)
     * 
     * @custom:note This returns shares, not underlying assets. The actual asset
     *              amount may differ based on the vault's share price.
     */
    function getSweepableAmount(address user) public view returns (uint256) {
        uint256 spendableBalance = IBucketVault(spendableBucket).balanceOf(user);
        
        // Get applicable minimum (custom if set, otherwise global default)
        uint256 applicableMinimum = getUserMinimumBalance(user);
        
        // Return 0 if balance is less than or equal to minimum
        if (spendableBalance <= applicableMinimum) {
            return 0;
        }

        return spendableBalance - applicableMinimum;
    }

    // ============================================
    // Sweep Execution
    // ============================================
    
    /**
     * @notice Execute a sweep operation to move funds from Spendable to highest-yield bucket
     * @param user The address of the user whose funds should be swept
     * @dev This function is designed to be called by Gelato Network automation during month-end.
     *      It performs a two-step process:
     *      1. Withdraw underlying assets from the Spendable vault
     *      2. Deposit those assets into the highest-yielding bucket vault
     * 
     * Prerequisites:
     * - User must have called authorizeAutoSweep() to grant permission
     * - User must have approved SweepKeeper to spend their Spendable vault shares
     * - Current time must be within month-end window (last 3 days of month)
     * - Contract must not be paused
     * - Bucket addresses must be initialized
     * - User must have sufficient balance above their minimum
     * 
     * Requirements:
     * - All bucket addresses must be non-zero (initialized)
     * - User must be authorized
     * - Must be month-end (last 3 days of month)
     * - User must have sweepable amount > 0
     * - Contract must not be paused (enforced by whenNotPaused modifier)
     * 
     * Effects:
     * - Updates lastSweepTimestamp (global, deprecated)
     * - Updates _lastSweepTimestamp[user] (per-user)
     * - Withdraws assets from Spendable vault
     * - Deposits assets into highest-yield vault
     * - Mints shares in target vault to user
     * 
     * Emits:
     * - SweepExecuted event with sweep details
     * 
     * Reverts:
     * - InvalidBucketAddress if any bucket address is zero
     * - NotAuthorized if user hasn't authorized sweeps
     * - NotMonthEnd if not within month-end window
     * - InsufficientBalance if sweepable amount is zero
     * - TransferFailed if withdrawal or deposit fails
     * - ContractPaused if contract is paused (from whenNotPaused modifier)
     * - ReentrancyGuard: reentrant call (from nonReentrant modifier)
     * 
     * @custom:security Protected by nonReentrant and whenNotPaused modifiers.
     *                  Follows checks-effects-interactions pattern.
     *                  User authorization required.
     * 
     * Example Flow:
     * 1. Gelato calls checker(user) → returns true with execPayload
     * 2. Gelato calls executeSweep(user) with the payload
     * 3. Contract verifies all conditions
     * 4. Withdraws 90 USDC from Spendable (leaving 10 USDC minimum)
     * 5. Deposits 90 USDC into Bills bucket (highest yield)
     * 6. User now has shares in Bills bucket earning higher yield
     */
    function executeSweep(address user) external nonReentrant whenNotPaused {
        // Check bucket addresses are initialized
        if (billsBucket == address(0) || savingsBucket == address(0) || 
            growthBucket == address(0) || spendableBucket == address(0)) {
            revert InvalidBucketAddress();
        }

        // Check authorization
        if (!_authorized[user]) {
            revert NotAuthorized();
        }

        // Check if it's month-end
        if (!isMonthEnd()) {
            revert NotMonthEnd();
        }

        // Get sweepable amount (in underlying assets)
        uint256 sweepAmount = getSweepableAmount(user);
        
        if (sweepAmount == 0) {
            revert InsufficientBalance();
        }

        // Get highest yielding bucket
        (address targetBucket, uint256 yieldRate) = getHighestYieldBucket();

        // Calculate expected additional yield (annualized)
        uint256 expectedYield = (sweepAmount * yieldRate) / 10000;

        // Update state before external calls (checks-effects-interactions pattern)
        lastSweepTimestamp = block.timestamp; // Deprecated global timestamp
        _lastSweepTimestamp[user] = block.timestamp; // Per-user timestamp

        // Step 1: Withdraw assets from Spendable vault
        // This requires user to have approved SweepKeeper to spend their shares
        uint256 sharesRedeemed = IBucketVault(spendableBucket).withdraw(
            sweepAmount,
            address(this), // SweepKeeper receives the assets temporarily
            user           // Owner of the shares
        );
        
        if (sharesRedeemed == 0) {
            revert TransferFailed();
        }

        // Step 2: Deposit assets into target vault on behalf of user
        // First approve the target vault to spend the assets
        IERC20 underlyingAsset = IERC20(IBucketVault(spendableBucket).asset());
        underlyingAsset.approve(targetBucket, sweepAmount);
        
        // Deposit into target vault, minting shares to the user
        uint256 sharesMinted = IBucketVault(targetBucket).deposit(sweepAmount, user);
        
        if (sharesMinted == 0) {
            revert TransferFailed();
        }

        emit SweepExecuted(
            user,
            sweepAmount,
            spendableBucket,
            targetBucket,
            expectedYield,
            block.timestamp
        );
    }

    // ============================================
    // Gelato Integration
    // ============================================
    
    /**
     * @notice Gelato-compatible checker function to determine if sweep should execute
     * @param user The user address to check for sweep eligibility
     * @return canExec True if all conditions are met and sweep should execute
     * @return execPayload The encoded function call to execute (or empty if canExec is false)
     * @dev This function is called by Gelato Network to determine if executeSweep should be triggered.
     *      It performs all necessary checks and returns the execution payload if conditions are met.
     * 
     * Conditions Checked (in order):
     * 1. Contract is not paused
     * 2. User has authorized auto-sweep
     * 3. Spendable bucket address is initialized
     * 4. Current time is within month-end window
     * 5. User has sweepable amount > 0
     * 
     * Return Values:
     * - If all conditions met: (true, encoded executeSweep call)
     * - If any condition fails: (false, empty bytes)
     * 
     * Important Properties:
     * - This function NEVER reverts, even if checks fail
     * - All potentially reverting calls are wrapped in try-catch
     * - Returns false gracefully on any error
     * - Returns empty payload when canExec is false
     * 
     * Gelato Integration Pattern:
     * ```
     * (bool canExec, bytes memory execPayload) = sweepKeeper.checker(userAddress);
     * if (canExec) {
     *     (bool success, ) = address(sweepKeeper).call(execPayload);
     *     require(success, "Execution failed");
     * }
     * ```
     * 
     * @custom:gelato This function is designed for Gelato Network automation.
     *                It should be called periodically (e.g., every 6 hours during month-end).
     */
    function checker(address user) 
        external 
        view 
        returns (bool canExec, bytes memory execPayload) 
    {
        // Check pause state first
        if (paused()) {
            return (false, bytes(""));
        }

        // Check authorization
        if (!_authorized[user]) {
            return (false, bytes(""));
        }

        // Check if buckets are initialized
        if (spendableBucket == address(0)) {
            return (false, bytes(""));
        }

        // Wrap all potentially reverting calls in try-catch
        try this.isMonthEnd() returns (bool isMonthEndNow) {
            if (!isMonthEndNow) {
                return (false, bytes(""));
            }
        } catch {
            // If month-end check fails, return false
            return (false, bytes(""));
        }

        // Try to get sweepable amount
        uint256 sweepAmount;
        try this.getSweepableAmount(user) returns (uint256 amount) {
            sweepAmount = amount;
        } catch {
            // If getting sweepable amount fails, return false
            return (false, bytes(""));
        }

        // Check if there's anything to sweep
        if (sweepAmount == 0) {
            return (false, bytes(""));
        }

        // All conditions met - return true with encoded payload
        canExec = true;
        execPayload = abi.encodeWithSelector(
            this.executeSweep.selector,
            user
        );
    }

    // ============================================
    // Query Functions
    // ============================================
    
    /**
     * @notice Calculate the time remaining until the next month-end sweep window
     * @return seconds The number of seconds until the month-end window starts (0 if already in window)
     * @dev Returns 0 if currently within the month-end window (last 3 days of month).
     *      Otherwise, calculates the number of days until the month-end window begins
     *      and converts to seconds.
     * 
     * Calculation:
     * - Month-end window starts on day (daysInMonth - 2)
     * - For 31-day month: starts on day 29
     * - For 30-day month: starts on day 28
     * - For 29-day month: starts on day 27
     * - For 28-day month: starts on day 26
     * 
     * Example:
     * - Current: January 15 (31-day month)
     * - Month-end starts: January 29
     * - Days until: 29 - 15 = 14 days
     * - Returns: 14 * 86400 = 1,209,600 seconds
     * 
     * Use Cases:
     * - Display countdown to users
     * - Schedule Gelato task activation
     * - Estimate next sweep opportunity
     */
    function getTimeUntilNextSweep() external view returns (uint256) {
        if (isMonthEnd()) {
            return 0;
        }

        uint256 dayOfMonth = getDayOfMonth();
        uint256 daysInMonth = getDaysInMonth();
        
        // Calculate days until the start of month-end window (daysInMonth - 2)
        uint256 monthEndStartDay = daysInMonth - 2;
        uint256 daysUntilMonthEnd = monthEndStartDay - dayOfMonth;
        
        return daysUntilMonthEnd * 1 days;
    }

    /**
     * @notice Get the timestamp of the last successful sweep for a user
     * @param user The user address to query
     * @return timestamp The Unix timestamp of the last sweep, or 0 if never swept
     * @dev Returns 0 for users who have never had a sweep executed.
     *      This can be used to track sweep history and verify automation is working.
     * 
     * Example:
     * - User swept on January 31, 2024 at 12:00 PM UTC
     * - Returns: 1706702400 (Unix timestamp)
     * - User never swept: Returns 0
     * 
     * Use Cases:
     * - Display last sweep time to users
     * - Verify Gelato automation is functioning
     * - Track sweep frequency
     * - Audit sweep history
     */
    function getLastSweepTimestamp(address user) external view returns (uint256) {
        return _lastSweepTimestamp[user];
    }
}
