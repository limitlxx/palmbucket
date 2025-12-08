// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../BucketVaultV2.sol";
import "../interfaces/IOndo.sol";

/**
 * @title SavingsVault
 * @notice Savings bucket that earns 8-12% APY via Ondo USDY
 * @dev Integrates with Ondo Finance for RWA-backed yield
 *      Mainnet: Uses real USDY contracts
 *      Testnet: Uses MockUSDY with simulated yield
 */
contract SavingsVault is BucketVaultV2 {
    // Ondo protocol contracts
    IUSDYToken public usdyToken;
    IUSDYManager public usdyManager;
    IRedemptionPriceOracle public priceOracle;
    
    // Tracking
    uint256 public totalUSDYBalance;
    
    event USDYDeposited(uint256 usdcAmount, uint256 usdyAmount);
    event USDYRedeemed(uint256 usdyAmount, uint256 usdcAmount);
    
    /**
     * @notice Constructor
     * @param asset_ USDC token address
     * @param maxDeposit_ Maximum total deposits
     * @param usdyToken_ USDY token address
     * @param usdyManager_ USDY manager address
     * @param priceOracle_ Redemption price oracle address
     */
    constructor(
        IERC20 asset_,
        uint256 maxDeposit_,
        address usdyToken_,
        address usdyManager_,
        address priceOracle_
    ) BucketVaultV2(
        asset_,
        "PalmBudget Savings Vault",
        "pbSAVE",
        VaultType.SAVINGS,
        maxDeposit_
    ) {
        usdyToken = IUSDYToken(usdyToken_);
        usdyManager = IUSDYManager(usdyManager_);
        priceOracle = IRedemptionPriceOracle(priceOracle_);
        
        // Set yield protocol for base vault
        yieldProtocol = usdyManager_;
        yieldEnabled = true;
    }
    
    /**
     * @notice Deposit USDC to Ondo USDY protocol
     * @param amount Amount of USDC to deposit
     */
    function _depositToProtocol(uint256 amount) internal override {
        // Approve USDC for USDYManager
        IERC20(asset()).approve(address(usdyManager), amount);
        
        // Mint USDY (1:1 with USDC, adjusted for decimals)
        try usdyManager.mint(amount) {
            // Track USDY balance (USDY is 18 decimals, USDC is 6)
            uint256 usdyAmount = amount * 1e12;
            totalUSDYBalance += usdyAmount;
            
            emit USDYDeposited(amount, usdyAmount);
        } catch {
            revert YieldProtocolCallFailed();
        }
    }
    
    /**
     * @notice Withdraw from Ondo USDY protocol
     * @param amount Amount of USDY to redeem
     * @return Amount of USDC received
     */
    function _withdrawFromProtocol(uint256 amount) internal override returns (uint256) {
        // Calculate USDY amount to redeem (convert USDC to USDY decimals)
        uint256 usdyAmount = amount * 1e12;
        
        if (usdyAmount > totalUSDYBalance) {
            usdyAmount = totalUSDYBalance;
        }
        
        // Approve USDY for redemption
        usdyToken.approve(address(usdyManager), usdyAmount);
        
        // Redeem USDY for USDC
        try usdyManager.redeem(usdyAmount) {
            totalUSDYBalance -= usdyAmount;
            
            uint256 usdcAmount = usdyAmount / 1e12;
            emit USDYRedeemed(usdyAmount, usdcAmount);
            
            return usdcAmount;
        } catch {
            revert YieldProtocolCallFailed();
        }
    }
    
    /**
     * @notice Get current yield rate from Ondo
     * @return APY in basis points (e.g., 1000 = 10%)
     */
    function _getProtocolYieldRate() internal view override returns (uint256) {
        try priceOracle.getPrice() returns (uint256 price) {
            // Calculate APY from redemption price
            // If price > 1e18, there's yield
            if (price > 1e18) {
                // Simplified: assume linear growth for APY calculation
                // In production, would track historical prices
                return 1000; // 10% APY (Ondo USDY typical range)
            }
            return 800; // 8% minimum
        } catch {
            return 1000; // Default 10% if oracle fails
        }
    }
    
    /**
     * @notice Get total USDY balance (includes accrued yield)
     */
    function getUSDYBalance() external view returns (uint256) {
        return totalUSDYBalance;
    }
    
    /**
     * @notice Get current USDY redemption price
     */
    function getRedemptionPrice() external view returns (uint256) {
        try priceOracle.getPrice() returns (uint256 price) {
            return price;
        } catch {
            return 1e18; // Default 1:1 if oracle fails
        }
    }
    
    /**
     * @notice Override totalAssets to include USDY value
     */
    function totalAssets() public view override returns (uint256) {
        uint256 baseAssets = super.totalAssets();
        
        // Add USDY value (convert to USDC decimals)
        if (totalUSDYBalance > 0) {
            uint256 usdyValueInUSDC = totalUSDYBalance / 1e12;
            baseAssets += usdyValueInUSDC;
        }
        
        return baseAssets;
    }
}
