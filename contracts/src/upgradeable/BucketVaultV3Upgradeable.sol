// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BucketVaultV2Upgradeable.sol";
import "../utils/SwapHelperUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BucketVaultV3Upgradeable
 * @notice Enhanced upgradeable vault with multi-asset support via DEX integration
 */
contract BucketVaultV3Upgradeable is BucketVaultV2Upgradeable, SwapHelperUpgradeable {
    using SafeERC20 for IERC20;
    
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;
    
    event TokenSupportAdded(address indexed token);
    event TokenSupportRemoved(address indexed token);
    event MultiAssetDeposit(
        address indexed user,
        address indexed depositToken,
        uint256 depositAmount,
        uint256 baseAssetAmount,
        uint256 shares
    );
    
    error TokenNotSupported();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        VaultType vaultType_,
        uint256 maxDeposit_,
        address owner_
    ) public override initializer {
        super.initialize(asset_, name_, symbol_, vaultType_, maxDeposit_, owner_);
        __SwapHelper_init();
        
        supportedTokens[address(asset_)] = true;
        supportedTokenList.push(address(asset_));
    }
    
    function _getMaxSlippage() internal view override returns (uint256) {
        return maxSlippageBps;
    }
    
    function setDEXRouter(address router) external onlyOwner {
        _setDEXRouter(router);
    }
    
    function addSupportedToken(address token) external onlyOwner {
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        supportedTokenList.push(token);
        emit TokenSupportAdded(token);
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        require(token != address(asset()), "Cannot remove base asset");
        require(supportedTokens[token], "Not supported");
        
        supportedTokens[token] = false;
        
        for (uint256 i = 0; i < supportedTokenList.length; i++) {
            if (supportedTokenList[i] == token) {
                supportedTokenList[i] = supportedTokenList[supportedTokenList.length - 1];
                supportedTokenList.pop();
                break;
            }
        }
        
        emit TokenSupportRemoved(token);
    }
    
    function depositWithSwap(
        address depositToken,
        uint256 depositAmount,
        uint256 minBaseAssetAmount,
        address receiver
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (!supportedTokens[depositToken]) revert TokenNotSupported();
        
        IERC20(depositToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        uint256 baseAssetAmount;
        
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
        
        if (totalAssets() + baseAssetAmount > maxDepositLimit) revert ExceedsMaxDeposit();
        
        shares = previewDeposit(baseAssetAmount);
        _deposit(address(this), receiver, baseAssetAmount, shares);
        
        lastDepositTimestamp[receiver] = block.timestamp;
        
        emit MultiAssetDeposit(msg.sender, depositToken, depositAmount, baseAssetAmount, shares);
        
        return shares;
    }
    
    function depositETH(
        uint256 minBaseAssetAmount,
        address receiver
    ) external payable nonReentrant whenNotPaused returns (uint256 shares) {
        require(msg.value > 0, "No ETH sent");
        
        uint256 baseAssetAmount = _swapETHForTokens(
            address(asset()),
            msg.value,
            minBaseAssetAmount
        );
        
        if (totalAssets() + baseAssetAmount > maxDepositLimit) revert ExceedsMaxDeposit();
        
        shares = previewDeposit(baseAssetAmount);
        _deposit(address(this), receiver, baseAssetAmount, shares);
        
        lastDepositTimestamp[receiver] = block.timestamp;
        
        emit MultiAssetDeposit(msg.sender, address(0), msg.value, baseAssetAmount, shares);
        
        return shares;
    }
    
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
    
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokenList;
    }
    
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }

    uint256[50] private __gap;
}
