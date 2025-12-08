// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentRouter
 * @notice Automatically splits incoming payments into predefined buckets based on user-configured ratios
 * @dev Implements payment routing with configurable split ratios that must sum to 100%
 */
contract PaymentRouter is Ownable, ReentrancyGuard {
    // Custom errors for gas efficiency
    error InvalidRatioSum();
    error InvalidBucketAddresses();
    error InvalidToken();
    error InvalidAmount();
    error TransferFailed();
    error InsufficientAllowance();
    error AutoSplitNotEnabled();

    // Split ratio must sum to this value (100%)
    uint256 public constant RATIO_DENOMINATOR = 100;
    
    // Number of buckets (Bills, Savings, Growth, Spendable)
    uint256 public constant NUM_BUCKETS = 4;

    // User configuration
    struct UserConfig {
        uint256[NUM_BUCKETS] splitRatios; // Ratios must sum to 100
        address[NUM_BUCKETS] bucketAddresses; // Vault addresses for each bucket
        bool initialized;
    }

    // Mapping from user address to their configuration
    mapping(address => UserConfig) public userConfigs;

    // Track which tokens have unlimited approval enabled
    mapping(address => mapping(address => bool)) public autoSplitEnabled; // user => token => enabled
    
    // Events
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

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set the bucket addresses for a user
     * @param buckets Array of 4 bucket vault addresses
     */
    function setBucketAddresses(address[NUM_BUCKETS] calldata buckets) external {
        // Validate that all addresses are non-zero
        for (uint256 i = 0; i < NUM_BUCKETS; i++) {
            if (buckets[i] == address(0)) {
                revert InvalidBucketAddresses();
            }
        }

        userConfigs[msg.sender].bucketAddresses = buckets;
        userConfigs[msg.sender].initialized = true;

        emit BucketAddressesUpdated(msg.sender, buckets);
    }

    /**
     * @notice Enable auto-split for a token (one-time unlimited approval)
     * @param token The token to enable auto-split for
     * @dev User approves this contract to spend unlimited tokens
     *      This is the "magic button" - approve once, auto-split forever
     *      Same pattern used by Yearn, Sablier, Superfluid
     */
    function enableAutoSplit(address token) external {
        require(token != address(0), "Invalid token");
        
        // Check current allowance
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(msg.sender, address(this));
        
        // Mark as enabled if allowance is sufficient (> 1M tokens)
        // Using 1M as threshold to detect "unlimited" approvals
        uint256 threshold = 1_000_000 * (10 ** 6); // 1M USDC (6 decimals)
        
        if (currentAllowance >= threshold || currentAllowance == type(uint256).max) {
            autoSplitEnabled[msg.sender][token] = true;
            emit AutoSplitEnabled(msg.sender, token, currentAllowance);
        } else {
            revert InsufficientAllowance();
        }
    }
    
    /**
     * @notice Disable auto-split for a token
     * @param token The token to disable auto-split for
     * @dev User should also revoke approval in their wallet for full security
     */
    function disableAutoSplit(address token) external {
        autoSplitEnabled[msg.sender][token] = false;
        emit AutoSplitDisabled(msg.sender, token);
    }
    
    /**
     * @notice Check if auto-split is enabled for a user and token
     */
    function isAutoSplitEnabled(address user, address token) external view returns (bool) {
        return autoSplitEnabled[user][token];
    }
    
    /**
     * @notice Set split ratios for the caller
     * @param ratios Array of 4 ratios that must sum to 100
     * @dev Ratios represent percentages (e.g., [50, 20, 20, 10] = 50%, 20%, 20%, 10%)
     */
    function setSplitRatios(uint256[NUM_BUCKETS] calldata ratios) external {
        // Validate ratios sum to 100
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

    /**
     * @notice Route a payment by splitting it according to user's configured ratios
     * @param token The ERC20 token address to split
     * @param amount The total amount to split
     * @dev After enableAutoSplit(), this works automatically with no popups!
     *      The router pulls funds using pre-approved allowance
     */
    function routePayment(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) {
            revert InvalidToken();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        UserConfig storage config = userConfigs[msg.sender];
        
        // Check if user has initialized their configuration
        if (!config.initialized) {
            revert InvalidBucketAddresses();
        }

        // Check token approval before executing auto-split
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

        // Calculate split amounts
        uint256[NUM_BUCKETS] memory amounts;
        uint256 totalAllocated = 0;
        
        for (uint256 i = 0; i < NUM_BUCKETS - 1; i++) {
            amounts[i] = (amount * config.splitRatios[i]) / RATIO_DENOMINATOR;
            totalAllocated += amounts[i];
        }
        
        // Last bucket gets remainder to handle rounding
        amounts[NUM_BUCKETS - 1] = amount - totalAllocated;

        // Transfer tokens from user to this contract first
        bool transferSuccess = tokenContract.transferFrom(msg.sender, address(this), amount);
        if (!transferSuccess) {
            revert TransferFailed();
        }

        // Distribute to buckets
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

    /**
     * @notice Get the bucket addresses for a user
     * @param user The user address
     * @return Array of 4 bucket addresses
     */
    function getUserBuckets(address user) external view returns (address[NUM_BUCKETS] memory) {
        return userConfigs[user].bucketAddresses;
    }

    /**
     * @notice Get the split ratios for a user
     * @param user The user address
     * @return Array of 4 split ratios
     */
    function getUserRatios(address user) external view returns (uint256[NUM_BUCKETS] memory) {
        return userConfigs[user].splitRatios;
    }

    /**
     * @notice Check if a user has initialized their configuration
     * @param user The user address
     * @return True if user has set bucket addresses
     */
    function isUserInitialized(address user) external view returns (bool) {
        return userConfigs[user].initialized;
    }
}
