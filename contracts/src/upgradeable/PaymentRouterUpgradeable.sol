// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title PaymentRouterUpgradeable
 * @notice Upgradeable payment router with automatic split functionality
 */
contract PaymentRouterUpgradeable is 
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    error InvalidRatioSum();
    error InvalidBucketAddresses();
    error InvalidToken();
    error InvalidAmount();
    error TransferFailed();
    error InsufficientAllowance();
    error AutoSplitNotEnabled();

    uint256 public constant RATIO_DENOMINATOR = 100;
    uint256 public constant NUM_BUCKETS = 4;

    struct UserConfig {
        uint256[NUM_BUCKETS] splitRatios;
        address[NUM_BUCKETS] bucketAddresses;
        bool initialized;
    }

    mapping(address => UserConfig) public userConfigs;
    mapping(address => mapping(address => bool)) public autoSplitEnabled;
    
    event SplitRatiosUpdated(address indexed user, uint256[NUM_BUCKETS] ratios);
    event PaymentRouted(
        address indexed user,
        address indexed token,
        uint256 totalAmount,
        uint256[NUM_BUCKETS] amounts
    );
    event BucketAddressesUpdated(address indexed user, address[NUM_BUCKETS] buckets);
    event AutoSplitEnabled(address indexed user, address indexed token, uint256 approvalAmount);
    event AutoSplitDisabled(address indexed user, address indexed token);
    event AutoSplitSkipped(
        address indexed user,
        address indexed token,
        uint256 amount,
        string reason
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) public initializer {
        __Ownable_init(owner_);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    function setBucketAddresses(address[NUM_BUCKETS] calldata buckets) external {
        for (uint256 i = 0; i < NUM_BUCKETS; i++) {
            if (buckets[i] == address(0)) {
                revert InvalidBucketAddresses();
            }
        }

        userConfigs[msg.sender].bucketAddresses = buckets;
        userConfigs[msg.sender].initialized = true;

        emit BucketAddressesUpdated(msg.sender, buckets);
    }

    function enableAutoSplit(address token) external {
        require(token != address(0), "Invalid token");
        
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(msg.sender, address(this));
        
        uint256 threshold = 1_000_000 * (10 ** 6);
        
        if (currentAllowance >= threshold || currentAllowance == type(uint256).max) {
            autoSplitEnabled[msg.sender][token] = true;
            emit AutoSplitEnabled(msg.sender, token, currentAllowance);
        } else {
            revert InsufficientAllowance();
        }
    }
    
    function disableAutoSplit(address token) external {
        autoSplitEnabled[msg.sender][token] = false;
        emit AutoSplitDisabled(msg.sender, token);
    }
    
    function isAutoSplitEnabled(address user, address token) external view returns (bool) {
        return autoSplitEnabled[user][token];
    }
    
    function setSplitRatios(uint256[NUM_BUCKETS] calldata ratios) external {
        uint256 sum = 0;
        for (uint256 i = 0; i < NUM_BUCKETS; i++) {
            sum += ratios[i];
        }
        
        if (sum != RATIO_DENOMINATOR) {
            revert InvalidRatioSum();
        }

        userConfigs[msg.sender].splitRatios = ratios;
        
        emit SplitRatiosUpdated(msg.sender, ratios);
    }

    function routePayment(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) {
            revert InvalidToken();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        UserConfig storage config = userConfigs[msg.sender];
        
        if (!config.initialized) {
            revert InvalidBucketAddresses();
        }

        IERC20 tokenContract = IERC20(token);
        uint256 allowance = tokenContract.allowance(msg.sender, address(this));
        
        if (allowance < amount) {
            emit AutoSplitSkipped(
                msg.sender,
                token,
                amount,
                "Insufficient token approval"
            );
            revert InsufficientAllowance();
        }

        uint256[NUM_BUCKETS] memory amounts;
        uint256 totalAllocated = 0;
        
        for (uint256 i = 0; i < NUM_BUCKETS - 1; i++) {
            amounts[i] = (amount * config.splitRatios[i]) / RATIO_DENOMINATOR;
            totalAllocated += amounts[i];
        }
        
        amounts[NUM_BUCKETS - 1] = amount - totalAllocated;

        bool transferSuccess = tokenContract.transferFrom(msg.sender, address(this), amount);
        if (!transferSuccess) {
            revert TransferFailed();
        }

        for (uint256 i = 0; i < NUM_BUCKETS; i++) {
            if (amounts[i] > 0) {
                bool success = tokenContract.transfer(config.bucketAddresses[i], amounts[i]);
                if (!success) {
                    revert TransferFailed();
                }
            }
        }

        emit PaymentRouted(msg.sender, token, amount, amounts);
    }

    function getUserBuckets(address user) external view returns (address[NUM_BUCKETS] memory) {
        return userConfigs[user].bucketAddresses;
    }

    function getUserRatios(address user) external view returns (uint256[NUM_BUCKETS] memory) {
        return userConfigs[user].splitRatios;
    }

    function isUserInitialized(address user) external view returns (bool) {
        return userConfigs[user].initialized;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}
