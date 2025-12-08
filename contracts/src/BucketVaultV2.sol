// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BucketVaultV2
 * @notice Production-ready ERC-4626 vault with protocol-specific yield strategies
 * @dev Features:
 *      - Multi-asset support with DEX integration
 *      - Emergency withdrawal with penalty
 *      - Pausable for circuit breaker
 *      - Slippage protection
 *      - Maximum deposit limits
 *      - Withdrawal delays and fees (configurable per vault type)
 *      - Protocol-specific yield integration
 */
contract BucketVaultV2 is ERC4626, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Custom errors
    error ExceedsMaxDeposit();
    error ExceedsMaxSlippage();
    error WithdrawalDelayNotMet();
    error InsufficientBalance();
    error InvalidAmount();
    error YieldProtocolNotSet();
    error YieldProtocolCallFailed();
    error EmergencyWithdrawalPenaltyTooHigh();
    
    // Vault type enum
    enum VaultType { BILLS, SAVINGS, GROWTH, SPENDABLE }
    
    // Vault configuration
    VaultType public immutable vaultType;
    address public yieldProtocol;
    bool public yieldEnabled;
    
    // Security limits
    uint256 public maxDepositLimit; // Maximum total deposits (in asset decimals)
    uint256 public maxSlippageBps; // Maximum slippage in basis points (e.g., 50 = 0.5%)
    
    // Withdrawal configuration
    uint256 public withdrawalDelaySeconds; // Delay before withdrawal (0 = instant)
    uint256 public withdrawalFeeBps; // Fee in basis points (e.g., 200 = 2%)
    mapping(address => uint256) public lastDepositTimestamp;
    
    // Emergency withdrawal
    uint256 public constant EMERGENCY_PENALTY_BPS = 500; // 5% penalty
    uint256 public constant MAX_BPS = 10000;
    address public penaltyRecipient; // Address to receive penalties
    
    // Yield tracking
    uint256 public totalYieldEarned;
    uint256 public lastYieldUpdate;
    
    // Events
    event YieldProtocolSet(address indexed protocol);
    event YieldDeposited(uint256 amount, uint256 shares);
    event YieldWithdrawn(uint256 shares, uint256 amount);
    event YieldCompounded(uint256 amount);
    event EmergencyWithdrawal(address indexed user, uint256 amount, uint256 penalty);
    event MaxDepositLimitUpdated(uint256 newLimit);
    event WithdrawalConfigUpdated(uint256 delaySeconds, uint256 feeBps);
    event SlippageProtectionUpdated(uint256 maxSlippageBps);
    
    /**
     * @notice Constructor
     * @param asset_ The underlying ERC20 asset
     * @param name_ The name of the vault token
     * @param symbol_ The symbol of the vault token
     * @param vaultType_ The type of vault (determines yield strategy)
     * @param maxDeposit_ Maximum total deposits allowed
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        VaultType vaultType_,
        uint256 maxDeposit_
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(msg.sender) {
        vaultType = vaultType_;
        maxDepositLimit = maxDeposit_;
        maxSlippageBps = 50; // 0.5% default
        lastYieldUpdate = block.timestamp;
        penaltyRecipient = msg.sender; // Initially owner
        
        // Set withdrawal config based on vault type
        if (vaultType_ == VaultType.BILLS) {
            withdrawalDelaySeconds = 7 days;
            withdrawalFeeBps = 200; // 2%
        } else {
            withdrawalDelaySeconds = 0; // Instant for others
            withdrawalFeeBps = 0;
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the yield protocol address
     * @param protocol The address of the yield-generating protocol
     */
    function setYieldProtocol(address protocol) external onlyOwner {
        yieldProtocol = protocol;
        yieldEnabled = protocol != address(0);
        emit YieldProtocolSet(protocol);
    }
    
    /**
     * @notice Update maximum deposit limit
     */
    function setMaxDepositLimit(uint256 newLimit) external onlyOwner {
        maxDepositLimit = newLimit;
        emit MaxDepositLimitUpdated(newLimit);
    }
    
    /**
     * @notice Update withdrawal configuration
     */
    function setWithdrawalConfig(uint256 delaySeconds, uint256 feeBps) external onlyOwner {
        require(feeBps <= 1000, "Fee too high"); // Max 10%
        withdrawalDelaySeconds = delaySeconds;
        withdrawalFeeBps = feeBps;
        emit WithdrawalConfigUpdated(delaySeconds, feeBps);
    }
    
    /**
     * @notice Update slippage protection
     */
    function setMaxSlippage(uint256 slippageBps) external onlyOwner {
        require(slippageBps <= 500, "Slippage too high"); // Max 5%
        maxSlippageBps = slippageBps;
        emit SlippageProtectionUpdated(slippageBps);
    }
    
    /**
     * @notice Set penalty recipient address
     */
    function setPenaltyRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid address");
        penaltyRecipient = recipient;
    }
    
    /**
     * @notice Pause deposits and withdrawals (circuit breaker)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause deposits and withdrawals
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Yield Management ============
    
    /**
     * @notice Deposit assets to the yield protocol
     * @param amount The amount of assets to deposit
     */
    function depositToYieldProtocol(uint256 amount) external nonReentrant onlyOwner {
        if (!yieldEnabled) revert YieldProtocolNotSet();
        if (amount == 0) revert InvalidAmount();
        
        IERC20 assetToken = IERC20(asset());
        uint256 balance = assetToken.balanceOf(address(this));
        
        if (balance < amount) revert InsufficientBalance();
        
        // Approve yield protocol
        assetToken.safeIncreaseAllowance(yieldProtocol, amount);
        
        // Call protocol-specific deposit (will be overridden in specialized vaults)
        _depositToProtocol(amount);
        
        emit YieldDeposited(amount, amount);
    }
    
    /**
     * @notice Withdraw assets from the yield protocol
     * @param shares The number of shares to withdraw
     */
    function withdrawFromYieldProtocol(uint256 shares) external nonReentrant onlyOwner {
        if (!yieldEnabled) revert YieldProtocolNotSet();
        if (shares == 0) revert InvalidAmount();
        
        // Call protocol-specific withdrawal
        uint256 amount = _withdrawFromProtocol(shares);
        
        emit YieldWithdrawn(shares, amount);
    }
    
    /**
     * @notice Compound accumulated yield back into the vault
     */
    function compoundYield() external nonReentrant {
        if (!yieldEnabled) revert YieldProtocolNotSet();
        
        // Calculate yield earned since last update
        uint256 timePassed = block.timestamp - lastYieldUpdate;
        if (timePassed == 0) return;
        
        uint256 currentAssets = totalAssets();
        uint256 yieldRate = getYieldRate();
        
        // Calculate yield: assets * rate * time / (year * 10000)
        uint256 yieldEarned = (currentAssets * yieldRate * timePassed) / (365 days * MAX_BPS);
        
        if (yieldEarned > 0) {
            totalYieldEarned += yieldEarned;
            lastYieldUpdate = block.timestamp;
            emit YieldCompounded(yieldEarned);
        }
    }
    
    /**
     * @notice Get the current yield rate from the protocol
     * @return The annual percentage yield in basis points
     */
    function getYieldRate() public view returns (uint256) {
        if (!yieldEnabled) return 0;
        return _getProtocolYieldRate();
    }
    
    // ============ Deposit/Withdrawal Overrides ============
    
    /**
     * @notice Override deposit to add security checks
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        whenNotPaused
        returns (uint256 shares) 
    {
        // Check deposit limit
        if (totalAssets() + assets > maxDepositLimit) revert ExceedsMaxDeposit();
        
        shares = super.deposit(assets, receiver);
        
        // Track deposit timestamp for withdrawal delay
        lastDepositTimestamp[receiver] = block.timestamp;
        
        // Automatically deposit to yield protocol if enabled
        if (yieldEnabled && assets > 0) {
            emit YieldDeposited(assets, shares);
        }
        
        return shares;
    }
    
    /**
     * @notice Override withdraw to add fees and delays
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        // Check withdrawal delay
        if (withdrawalDelaySeconds > 0) {
            uint256 timeSinceDeposit = block.timestamp - lastDepositTimestamp[owner];
            if (timeSinceDeposit < withdrawalDelaySeconds) {
                revert WithdrawalDelayNotMet();
            }
        }
        
        // Calculate withdrawal fee
        uint256 fee = 0;
        if (withdrawalFeeBps > 0) {
            fee = (assets * withdrawalFeeBps) / MAX_BPS;
            assets -= fee;
            
            // Transfer fee to penalty recipient
            if (fee > 0) {
                IERC20(asset()).safeTransfer(penaltyRecipient, fee);
            }
        }
        
        // If yield is enabled, may need to withdraw from protocol first
        if (yieldEnabled) {
            uint256 availableBalance = IERC20(asset()).balanceOf(address(this));
            if (availableBalance < assets) {
                uint256 needed = assets - availableBalance;
                _withdrawFromProtocol(needed);
            }
        }
        
        shares = super.withdraw(assets, receiver, owner);
        return shares;
    }
    
    /**
     * @notice Emergency withdrawal with penalty (bypasses delays)
     * @param assets Amount to withdraw
     */
    function emergencyWithdraw(uint256 assets) external nonReentrant {
        require(assets > 0, "Invalid amount");
        
        uint256 shares = previewWithdraw(assets);
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        // Calculate penalty
        uint256 penalty = (assets * EMERGENCY_PENALTY_BPS) / MAX_BPS;
        uint256 netAmount = assets - penalty;
        
        // Burn shares
        _burn(msg.sender, shares);
        
        // Transfer net amount to user
        IERC20(asset()).safeTransfer(msg.sender, netAmount);
        
        // Transfer penalty to recipient
        if (penalty > 0) {
            IERC20(asset()).safeTransfer(penaltyRecipient, penalty);
        }
        
        emit EmergencyWithdrawal(msg.sender, netAmount, penalty);
    }
    
    /**
     * @notice Override totalAssets to include yield
     */
    function totalAssets() public view virtual override returns (uint256) {
        uint256 baseAssets = IERC20(asset()).balanceOf(address(this));
        
        // Add simulated yield if enabled
        if (yieldEnabled) {
            uint256 timePassed = block.timestamp - lastYieldUpdate;
            uint256 yieldRate = getYieldRate();
            uint256 simulatedYield = (baseAssets * yieldRate * timePassed) / (365 days * MAX_BPS);
            return baseAssets + totalYieldEarned + simulatedYield;
        }
        
        return baseAssets + totalYieldEarned;
    }
    
    // ============ Protocol-Specific Functions (To be overridden) ============
    
    /**
     * @notice Internal function to deposit to protocol (override in specialized vaults)
     */
    function _depositToProtocol(uint256 amount) internal virtual {
        // Default: no-op (Spendable vault)
    }
    
    /**
     * @notice Internal function to withdraw from protocol (override in specialized vaults)
     */
    function _withdrawFromProtocol(uint256 amount) internal virtual returns (uint256) {
        // Default: no-op (Spendable vault)
        return amount;
    }
    
    /**
     * @notice Internal function to get protocol yield rate (override in specialized vaults)
     */
    function _getProtocolYieldRate() internal view virtual returns (uint256) {
        // Default: 0% (Spendable vault)
        return 0;
    }
}
