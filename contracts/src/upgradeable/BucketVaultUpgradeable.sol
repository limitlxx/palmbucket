// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BucketVaultUpgradeable
 * @notice Upgradeable ERC-4626 compliant vault with yield generation
 * @dev UUPS upgradeable pattern for future improvements
 */
contract BucketVaultUpgradeable is 
    Initializable,
    ERC4626Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // Custom errors
    error YieldProtocolNotSet();
    error YieldProtocolCallFailed();
    error InsufficientBalance();
    error InvalidAmount();

    // Yield protocol interface
    address public yieldProtocol;
    bool public yieldEnabled;
    
    // Yield tracking
    uint256 public totalYieldEarned;
    uint256 public lastYieldUpdate;
    
    // Events
    event YieldProtocolSet(address indexed protocol);
    event YieldDeposited(uint256 amount, uint256 shares);
    event YieldWithdrawn(uint256 shares, uint256 amount);
    event YieldCompounded(uint256 amount);
    event YieldRateUpdated(uint256 newRate);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the vault
     * @param asset_ The underlying ERC20 asset
     * @param name_ The name of the vault token
     * @param symbol_ The symbol of the vault token
     * @param owner_ The owner address
     */
    function initialize(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address owner_
    ) public initializer {
        __ERC4626_init(asset_);
        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        lastYieldUpdate = block.timestamp;
    }

    /**
     * @notice Set the yield protocol address
     */
    function setYieldProtocol(address protocol) external onlyOwner {
        yieldProtocol = protocol;
        yieldEnabled = protocol != address(0);
        emit YieldProtocolSet(protocol);
    }

    /**
     * @notice Get the current yield rate
     */
    function getYieldRate() external view returns (uint256) {
        if (!yieldEnabled) {
            return 0;
        }
        return 1000; // 10% APY
    }

    /**
     * @notice Override totalAssets to include yield
     */
    function totalAssets() public view virtual override returns (uint256) {
        uint256 baseAssets = IERC20(asset()).balanceOf(address(this));
        
        if (yieldEnabled) {
            uint256 timePassed = block.timestamp - lastYieldUpdate;
            uint256 simulatedYield = (baseAssets * 1000 * timePassed) / (365 days * 10000);
            return baseAssets + totalYieldEarned + simulatedYield;
        }
        
        return baseAssets + totalYieldEarned;
    }

    /**
     * @notice Override deposit with reentrancy protection
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        returns (uint256 shares) 
    {
        shares = super.deposit(assets, receiver);
        
        if (yieldEnabled && assets > 0) {
            emit YieldDeposited(assets, shares);
        }
        
        return shares;
    }

    /**
     * @notice Override withdraw with reentrancy protection
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        returns (uint256 shares)
    {
        shares = super.withdraw(assets, receiver, owner);
        return shares;
    }

    /**
     * @notice Required by UUPS pattern
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev This empty reserved space for future upgrades
     */
    uint256[50] private __gap;
}
