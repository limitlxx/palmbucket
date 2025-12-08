// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BucketVaultV2.sol";
import "./utils/SwapHelper.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BucketVaultV3
 * @notice Enhanced vault with multi-asset support via DEX integration
 * @dev Extends BucketVaultV2 with ability to accept deposits in various tokens
 *      Automatically swaps non-native assets to vault's base asset
 */
abstract contract BucketVaultV3 is BucketVaultV2, SwapHelper {
    using SafeERC20 for IERC20;
    
    // Supported deposit tokens
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;
    
    // Events
    event TokenSupportAdded(address indexed token);
    event TokenSupportRemoved(address indexed token);
    event MultiAssetDeposit(
        address indexed user,
        address indexed depositToken,
        uint256 depositAmount,
        uint256 baseAssetAmount,
        uint256 shares
    );
    
    // Errors
    error TokenNotSupported();
    
    /**
     * @notice Constructor
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        VaultType vaultType_,
        uint256 maxDeposit_
    ) BucketVaultV2(asset_, name_, symbol_, vaultType_, maxDeposit_) {
        // Base asset is always supported
        supportedTokens[address(asset_)] = true;
        supportedTokenList.push(address(asset_));
    }
    
    /**
     * @notice Override to use parent's maxSlippageBps
     */
    function _getMaxSlippage() internal view override returns (uint256) {
        return maxSlippageBps;
    }
    
    /**
     * @notice Set DEX router for swaps
     */
    function setDEXRouter(address router) external onlyOwner {
        _setDEXRouter(router);
    }
    
    /**
     * @notice Add support for a deposit token
     */
    function addSupportedToken(address token) external onlyOwner {
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        supportedTokenList.push(token);
        emit TokenSupportAdded(token);
    }
    
    /**
     * @notice Remove support for a deposit token
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(token != address(asset()), "Cannot remove base asset");
        require(supportedTokens[token], "Not supported");
        
        supportedTokens[token] = false;
        
        // Remove from list
        for (uint256 i = 0; i < supportedTokenList.length; i++) {
            if (supportedTokenList[i] == token) {
                supportedTokenList[i] = supportedTokenList[supportedTokenList.length - 1];
                supportedTokenList.pop();
                break;
            }
        }
        
        emit TokenSupportRemoved(token);
    }
    
    /**
     * @notice Deposit with automatic swap from any supported token
     * @param depositToken Token to deposit (will be swapped to base asset)
     * @param depositAmount Amount of deposit token
     * @param minBaseAssetAmount Minimum base asset after swap (slippage protection)
     * @param receiver Address to receive vault shares
     * @return shares Amount of vault shares minted
     */
    function depositWithSwap(
        address depositToken,
        uint256 depositAmount,
        uint256 minBaseAssetAmount,
        address receiver
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (!supportedTokens[depositToken]) revert TokenNotSupported();
        
        // Transfer deposit token from user
        IERC20(depositToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        uint256 baseAssetAmount;
        
        // Swap to base asset if needed
        if (depositToken == address(asset())) {
            baseAssetAmount = depositAmount;
        } else {
            baseAssetAmount = _swapTokens(
                depositToken,
                address(asset()),
                depositAmount,
                minBaseAssetAmount
            );
        }
        
        // Check deposit limit
        if (totalAssets() + baseAssetAmount > maxDepositLimit) revert ExceedsMaxDeposit();
        
        // Mint shares
        shares = previewDeposit(baseAssetAmount);
        _deposit(address(this), receiver, baseAssetAmount, shares);
        
        // Track deposit timestamp
        lastDepositTimestamp[receiver] = block.timestamp;
        
        // Emit event
        emit MultiAssetDeposit(msg.sender, depositToken, depositAmount, baseAssetAmount, shares);
        
        return shares;
    }
    
    /**
     * @notice Deposit ETH with automatic swap to base asset
     * @param minBaseAssetAmount Minimum base asset after swap
     * @param receiver Address to receive vault shares
     * @return shares Amount of vault shares minted
     */
    function depositETH(
        uint256 minBaseAssetAmount,
        address receiver
    ) external payable nonReentrant whenNotPaused returns (uint256 shares) {
        require(msg.value > 0, "No ETH sent");
        
        // Swap ETH to base asset
        uint256 baseAssetAmount = _swapETHForTokens(
            address(asset()),
            msg.value,
            minBaseAssetAmount
        );
        
        // Check deposit limit
        if (totalAssets() + baseAssetAmount > maxDepositLimit) revert ExceedsMaxDeposit();
        
        // Mint shares
        shares = previewDeposit(baseAssetAmount);
        _deposit(address(this), receiver, baseAssetAmount, shares);
        
        // Track deposit timestamp
        lastDepositTimestamp[receiver] = block.timestamp;
        
        // Emit event
        emit MultiAssetDeposit(msg.sender, address(0), msg.value, baseAssetAmount, shares);
        
        return shares;
    }
    
    /**
     * @notice Get quote for depositing a specific token
     * @param depositToken Token to deposit
     * @param depositAmount Amount of deposit token
     * @return baseAssetAmount Expected base asset amount after swap
     * @return shares Expected vault shares to receive
     */
    function quoteDeposit(
        address depositToken,
        uint256 depositAmount
    ) external view returns (uint256 baseAssetAmount, uint256 shares) {
        if (!supportedTokens[depositToken]) revert TokenNotSupported();
        
        if (depositToken == address(asset())) {
            baseAssetAmount = depositAmount;
        } else {
            baseAssetAmount = getSwapQuote(depositToken, address(asset()), depositAmount);
        }
        
        shares = previewDeposit(baseAssetAmount);
        return (baseAssetAmount, shares);
    }
    
    /**
     * @notice Get list of supported deposit tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokenList;
    }
    
    /**
     * @notice Check if a token is supported for deposits
     */
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
}
