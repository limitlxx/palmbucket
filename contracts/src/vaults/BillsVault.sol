// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../BucketVaultV2.sol";
import "../interfaces/ILendle.sol";

/**
 * @title BillsVault
 * @notice Bills bucket that earns 4-6% APY via Lendle lending
 * @dev Integrates with Lendle (Aave V3 fork) for low-risk stablecoin yield
 *      Features 7-day withdrawal delay and 2% fee to encourage stability
 *      Mainnet: Uses real Lendle protocol
 *      Testnet: Uses MockLendle with simulated yield
 */
contract BillsVault is BucketVaultV2 {
    // Lendle protocol contracts
    ILendlePool public lendlePool;
    IAToken public aToken;
    
    // Tracking
    uint256 public totalATokenBalance;
    
    event LendleSupplied(uint256 amount);
    event LendleWithdrawn(uint256 amount);
    
    /**
     * @notice Constructor
     * @param asset_ USDC token address
     * @param maxDeposit_ Maximum total deposits
     * @param lendlePool_ Lendle pool address
     * @param aToken_ aUSDC token address
     */
    constructor(
        IERC20 asset_,
        uint256 maxDeposit_,
        address lendlePool_,
        address aToken_
    ) BucketVaultV2(
        asset_,
        "PalmBudget Bills Vault",
        "pbBILLS",
        VaultType.BILLS,
        maxDeposit_
    ) {
        lendlePool = ILendlePool(lendlePool_);
        aToken = IAToken(aToken_);
        
        // Set yield protocol for base vault
        yieldProtocol = lendlePool_;
        yieldEnabled = true;
        
        // Bills vault has 7-day delay and 2% fee (set in base constructor)
    }
    
    /**
     * @notice Supply USDC to Lendle lending pool
     * @param amount Amount of USDC to supply
     */
    function _depositToProtocol(uint256 amount) internal override {
        // Approve USDC for Lendle pool
        IERC20(asset()).approve(address(lendlePool), amount);
        
        // Supply to Lendle (receives aTokens)
        try lendlePool.supply(
            address(asset()),
            amount,
            address(this),
            0 // referral code
        ) {
            // aTokens are minted 1:1 initially, then accrue interest
            totalATokenBalance += amount;
            emit LendleSupplied(amount);
        } catch {
            revert YieldProtocolCallFailed();
        }
    }
    
    /**
     * @notice Withdraw from Lendle lending pool
     * @param amount Amount of USDC to withdraw
     * @return Amount of USDC received
     */
    function _withdrawFromProtocol(uint256 amount) internal override returns (uint256) {
        // Check available aToken balance
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        
        if (amount > aTokenBalance) {
            amount = aTokenBalance;
        }
        
        if (amount == 0) return 0;
        
        // Withdraw from Lendle (burns aTokens, receives USDC)
        try lendlePool.withdraw(
            address(asset()),
            amount,
            address(this)
        ) returns (uint256 withdrawn) {
            totalATokenBalance = aToken.balanceOf(address(this));
            emit LendleWithdrawn(withdrawn);
            return withdrawn;
        } catch {
            revert YieldProtocolCallFailed();
        }
    }
    
    /**
     * @notice Get current yield rate from Lendle
     * @return APY in basis points (e.g., 450 = 4.5%)
     */
    function _getProtocolYieldRate() internal view override returns (uint256) {
        try lendlePool.getReserveData(address(asset())) returns (
            uint256, uint128, uint128 currentLiquidityRate, uint128, uint128, uint128,
            uint40, uint16, address, address, address, address, uint128, uint128, uint128
        ) {
            // Convert Ray (27 decimals) to basis points
            // Ray rate is per second, convert to annual
            uint256 annualRate = uint256(currentLiquidityRate) * 365 days;
            // Convert to basis points (divide by 1e23 to get from Ray to bps)
            return annualRate / 1e23;
        } catch {
            return 450; // Default 4.5% if call fails
        }
    }
    
    /**
     * @notice Get total aToken balance (includes accrued interest)
     */
    function getATokenBalance() external view returns (uint256) {
        return aToken.balanceOf(address(this));
    }
    
    /**
     * @notice Get current supply rate from Lendle
     */
    function getSupplyRate() external view returns (uint256) {
        return _getProtocolYieldRate();
    }
    
    /**
     * @notice Override totalAssets to include aToken value
     */
    function totalAssets() public view override returns (uint256) {
        uint256 baseAssets = IERC20(asset()).balanceOf(address(this));
        
        // Add aToken balance (includes accrued interest)
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        baseAssets += aTokenBalance;
        
        // Add tracked yield from base vault
        baseAssets += totalYieldEarned;
        
        return baseAssets;
    }
    
    /**
     * @notice Emergency withdraw all funds from Lendle
     * @dev Only callable by owner in emergency situations
     */
    function emergencyWithdrawFromLendle() external onlyOwner {
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        if (aTokenBalance > 0) {
            lendlePool.withdraw(
                address(asset()),
                type(uint256).max, // Withdraw all
                address(this)
            );
        }
    }
}
