// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../BucketVaultV2.sol";
import "../interfaces/IMeth.sol";

/**
 * @title GrowthVault
 * @notice Growth bucket that earns 4-6% APY via Mantle mETH liquid staking
 * @dev Integrates with Mantle's native mETH for liquid staking rewards
 *      Mainnet: Uses real mETH staking
 *      Testnet: Uses MockMeth with simulated rewards
 */
contract GrowthVault is BucketVaultV2 {
    // mETH protocol contracts
    IMethToken public methToken;
    IMethStaking public methStaking;
    
    // Tracking
    uint256 public totalMethBalance;
    
    event MethStaked(uint256 ethAmount, uint256 methAmount);
    event MethUnstaked(uint256 methAmount, uint256 ethAmount);
    event AssetSwapped(address fromAsset, uint256 fromAmount, uint256 toAmount);
    
    /**
     * @notice Constructor
     * @param asset_ Base asset (USDC)
     * @param maxDeposit_ Maximum total deposits
     * @param methToken_ mETH token address
     * @param methStaking_ mETH staking contract address
     */
    constructor(
        IERC20 asset_,
        uint256 maxDeposit_,
        address methToken_,
        address methStaking_
    ) BucketVaultV2(
        asset_,
        "PalmBudget Growth Vault",
        "pbGROW",
        VaultType.GROWTH,
        maxDeposit_
    ) {
        methToken = IMethToken(methToken_);
        methStaking = IMethStaking(methStaking_);
        
        // Set yield protocol for base vault
        yieldProtocol = methStaking_;
        yieldEnabled = true;
    }
    
    /**
     * @notice Deposit assets and stake for mETH
     * @param amount Amount to deposit (in base asset)
     * @dev For testnet: Simplified - assumes we can convert USDC to ETH
     *      For mainnet: Would integrate with DEX for USDC->ETH swap
     */
    function _depositToProtocol(uint256 amount) internal override {
        // In production, would swap USDC to ETH via DEX here
        // For testnet, we'll simulate by using contract's ETH balance
        
        uint256 ethAmount = _convertToETH(amount);
        
        if (address(this).balance < ethAmount) {
            // Not enough ETH, skip staking for now
            return;
        }
        
        // Stake ETH for mETH
        try methStaking.stake{value: ethAmount}() returns (uint256 methAmount) {
            totalMethBalance += methAmount;
            emit MethStaked(ethAmount, methAmount);
        } catch {
            revert YieldProtocolCallFailed();
        }
    }
    
    /**
     * @notice Unstake mETH and convert back to base asset
     * @param amount Amount to withdraw (in base asset)
     * @return Amount of base asset received
     */
    function _withdrawFromProtocol(uint256 amount) internal override returns (uint256) {
        // Convert amount to mETH equivalent
        uint256 ethNeeded = _convertToETH(amount);
        uint256 methNeeded = _ethToMeth(ethNeeded);
        
        if (methNeeded > totalMethBalance) {
            methNeeded = totalMethBalance;
        }
        
        if (methNeeded == 0) return 0;
        
        // Approve mETH for unstaking
        methToken.approve(address(methStaking), methNeeded);
        
        // Unstake mETH for ETH
        try methStaking.unstake(methNeeded) {
            totalMethBalance -= methNeeded;
            
            // In production, would swap ETH back to USDC via DEX
            uint256 ethReceived = address(this).balance;
            uint256 baseAssetAmount = _convertFromETH(ethReceived);
            
            emit MethUnstaked(methNeeded, ethReceived);
            return baseAssetAmount;
        } catch {
            revert YieldProtocolCallFailed();
        }
    }
    
    /**
     * @notice Get current yield rate from mETH staking
     * @return APY in basis points (e.g., 500 = 5%)
     */
    function _getProtocolYieldRate() internal view override returns (uint256) {
        try methStaking.getAPY() returns (uint256 apy) {
            return apy; // Returns basis points
        } catch {
            return 500; // Default 5% if call fails
        }
    }
    
    /**
     * @notice Get total mETH balance
     */
    function getMethBalance() external view returns (uint256) {
        return totalMethBalance;
    }
    
    /**
     * @notice Get current mETH/ETH exchange rate
     */
    function getMethExchangeRate() external view returns (uint256) {
        if (totalMethBalance == 0) return 1e18;
        
        try methStaking.mETHToETH(1e18) returns (uint256 ethAmount) {
            return ethAmount;
        } catch {
            return 1e18; // 1:1 default
        }
    }
    
    /**
     * @notice Override totalAssets to include mETH value
     */
    function totalAssets() public view override returns (uint256) {
        uint256 baseAssets = super.totalAssets();
        
        // Add mETH value converted to base asset
        if (totalMethBalance > 0) {
            try methStaking.mETHToETH(totalMethBalance) returns (uint256 ethValue) {
                uint256 baseAssetValue = _convertFromETH(ethValue);
                baseAssets += baseAssetValue;
            } catch {
                // If conversion fails, use 1:1 ratio
                baseAssets += totalMethBalance;
            }
        }
        
        return baseAssets;
    }
    
    // ============ Helper Functions ============
    
    /**
     * @notice Convert base asset (USDC) to ETH amount
     * @dev Simplified for testnet - uses fixed rate
     *      Production: Would use Chainlink oracle or DEX quote
     */
    function _convertToETH(uint256 usdcAmount) internal pure returns (uint256) {
        // Assume 1 ETH = $2000 for testnet
        // USDC is 6 decimals, ETH is 18 decimals
        return (usdcAmount * 1e18) / (2000 * 1e6);
    }
    
    /**
     * @notice Convert ETH to base asset (USDC) amount
     */
    function _convertFromETH(uint256 ethAmount) internal pure returns (uint256) {
        // Assume 1 ETH = $2000 for testnet
        return (ethAmount * 2000 * 1e6) / 1e18;
    }
    
    /**
     * @notice Convert ETH amount to mETH amount
     */
    function _ethToMeth(uint256 ethAmount) internal view returns (uint256) {
        if (ethAmount == 0) return 0;
        
        try methStaking.mETHToETH(1e18) returns (uint256 rate) {
            // rate is ETH per mETH, so mETH = ETH * 1e18 / rate
            return (ethAmount * 1e18) / rate;
        } catch {
            return ethAmount; // 1:1 fallback
        }
    }
    
    /**
     * @notice Receive ETH for staking operations
     */
    receive() external payable {}
}
