// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOndo
 * @notice Interface for Ondo Finance USDY protocol on Mantle
 * @dev Mainnet addresses:
 *      USDY Token: 0x5bE26527e817998A7206475496fDE1E68957c5A6
 *      USDYManager: 0x25A103A1D6AeC5967c1A4fe2039cdc514886b97e
 *      Redemption Price Oracle: 0xA96abbe61AfEdEB0D14a20440Ae7100D9aB4882f
 */
interface IUSDYToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IUSDYManager {
    /**
     * @notice Mint USDY tokens by depositing USDC
     * @param amount Amount of USDC to deposit
     */
    function mint(uint256 amount) external;
    
    /**
     * @notice Redeem USDY tokens for USDC
     * @param amount Amount of USDY to redeem
     */
    function redeem(uint256 amount) external;
    
    /**
     * @notice Get minimum deposit amount
     */
    function minimumDepositAmount() external view returns (uint256);
}

interface IRedemptionPriceOracle {
    /**
     * @notice Get current USDY redemption price (for APY calculation)
     * @return price Current price with 18 decimals
     */
    function getPrice() external view returns (uint256 price);
}
