// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILendle
 * @notice Interface for Lendle Protocol (Aave V3 fork on Mantle)
 * @dev Used for Bills Vault low-risk yield (4-6% APY on USDC)
 */
interface ILendlePool {
    /**
     * @notice Supply assets to the lending pool
     * @param asset The address of the underlying asset
     * @param amount The amount to be supplied
     * @param onBehalfOf The address that will receive the aTokens
     * @param referralCode Referral code for integrators
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    /**
     * @notice Withdraw assets from the lending pool
     * @param asset The address of the underlying asset
     * @param amount The amount to withdraw (use type(uint256).max for all)
     * @param to The address that will receive the underlying
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
    
    /**
     * @notice Get the current supply APY for an asset
     * @param asset The address of the underlying asset
     */
    function getReserveData(address asset) external view returns (
        uint256 configuration,
        uint128 liquidityIndex,
        uint128 currentLiquidityRate,
        uint128 variableBorrowIndex,
        uint128 currentVariableBorrowRate,
        uint128 currentStableBorrowRate,
        uint40 lastUpdateTimestamp,
        uint16 id,
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress,
        address interestRateStrategyAddress,
        uint128 accruedToTreasury,
        uint128 unbacked,
        uint128 isolationModeTotalDebt
    );
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
