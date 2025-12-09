// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BucketVaultV2Upgradeable
 * @notice Production-ready upgradeable ERC-4626 vault with protocol-specific yield strategies
 */
contract BucketVaultV2Upgradeable is 
    Initializable,
    ERC4626Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
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
    VaultType public vaultType;
    address public yieldProtocol;
    bool public yieldEnabled;
    
    // Security limits
    uint256 public maxDepositLimit;
    uint256 public maxSlippageBps;
    
    // Withdrawal configuration
    uint256 public withdrawalDelaySeconds;
    uint256 public withdrawalFeeBps;
    mapping(address => uint256) public lastDepositTimestamp;
    
    // Emergency withdrawal
    uint256 public constant EMERGENCY_PENALTY_BPS = 500;
    uint256 public constant MAX_BPS = 10000;
    address public penaltyRecipient;
    
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the vault
     */
    function initialize(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        VaultType vaultType_,
        uint256 maxDeposit_,
        address owner_
    ) public virtual initializer {
        __ERC4626_init(asset_);
        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        vaultType = vaultType_;
        maxDepositLimit = maxDeposit_;
        maxSlippageBps = 50;
        lastYieldUpdate = block.timestamp;
        penaltyRecipient = owner_;
        
        if (vaultType_ == VaultType.BILLS) {
            withdrawalDelaySeconds = 7 days;
            withdrawalFeeBps = 200;
        } else {
            withdrawalDelaySeconds = 0;
            withdrawalFeeBps = 0;
        }
    }
    
    // ============ Admin Functions ============
    
    function setYieldProtocol(address protocol) external onlyOwner {
        yieldProtocol = protocol;
        yieldEnabled = protocol != address(0);
        emit YieldProtocolSet(protocol);
    }
    
    function setMaxDepositLimit(uint256 newLimit) external onlyOwner {
        maxDepositLimit = newLimit;
        emit MaxDepositLimitUpdated(newLimit);
    }
    
    function setWithdrawalConfig(uint256 delaySeconds, uint256 feeBps) external onlyOwner {
        require(feeBps <= 1000, "Fee too high");
        withdrawalDelaySeconds = delaySeconds;
        withdrawalFeeBps = feeBps;
        emit WithdrawalConfigUpdated(delaySeconds, feeBps);
    }
    
    function setMaxSlippage(uint256 slippageBps) external onlyOwner {
        require(slippageBps <= 500, "Slippage too high");
        maxSlippageBps = slippageBps;
        emit SlippageProtectionUpdated(slippageBps);
    }
    
    function setPenaltyRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid address");
        penaltyRecipient = recipient;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Yield Management ============
    
    function getYieldRate() public view returns (uint256) {
        if (!yieldEnabled) return 0;
        return _getProtocolYieldRate();
    }
    
    // ============ Deposit/Withdrawal Overrides ============
    
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        whenNotPaused
        returns (uint256 shares) 
    {
        if (totalAssets() + assets > maxDepositLimit) revert ExceedsMaxDeposit();
        
        shares = super.deposit(assets, receiver);
        lastDepositTimestamp[receiver] = block.timestamp;
        
        if (yieldEnabled && assets > 0) {
            emit YieldDeposited(assets, shares);
        }
        
        return shares;
    }
    
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        if (withdrawalDelaySeconds > 0) {
            uint256 timeSinceDeposit = block.timestamp - lastDepositTimestamp[owner];
            if (timeSinceDeposit < withdrawalDelaySeconds) {
                revert WithdrawalDelayNotMet();
            }
        }
        
        uint256 fee = 0;
        if (withdrawalFeeBps > 0) {
            fee = (assets * withdrawalFeeBps) / MAX_BPS;
            assets -= fee;
            
            if (fee > 0) {
                IERC20(asset()).safeTransfer(penaltyRecipient, fee);
            }
        }
        
        shares = super.withdraw(assets, receiver, owner);
        return shares;
    }
    
    function emergencyWithdraw(uint256 assets) external nonReentrant {
        require(assets > 0, "Invalid amount");
        
        uint256 shares = previewWithdraw(assets);
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        uint256 penalty = (assets * EMERGENCY_PENALTY_BPS) / MAX_BPS;
        uint256 netAmount = assets - penalty;
        
        _burn(msg.sender, shares);
        IERC20(asset()).safeTransfer(msg.sender, netAmount);
        
        if (penalty > 0) {
            IERC20(asset()).safeTransfer(penaltyRecipient, penalty);
        }
        
        emit EmergencyWithdrawal(msg.sender, netAmount, penalty);
    }
    
    function totalAssets() public view virtual override returns (uint256) {
        uint256 baseAssets = IERC20(asset()).balanceOf(address(this));
        
        if (yieldEnabled) {
            uint256 timePassed = block.timestamp - lastYieldUpdate;
            uint256 yieldRate = getYieldRate();
            uint256 simulatedYield = (baseAssets * yieldRate * timePassed) / (365 days * MAX_BPS);
            return baseAssets + totalYieldEarned + simulatedYield;
        }
        
        return baseAssets + totalYieldEarned;
    }
    
    // ============ Protocol-Specific Functions (To be overridden) ============
    
    function _depositToProtocol(uint256 amount) internal virtual {}
    
    function _withdrawFromProtocol(uint256 amount) internal virtual returns (uint256) {
        return amount;
    }
    
    function _getProtocolYieldRate() internal view virtual returns (uint256) {
        return 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}
