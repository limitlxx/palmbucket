// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMeth
 * @notice Interface for Mantle's native mETH liquid staking
 * @dev Mainnet addresses:
 *      mETH Token: 0xd5F7838F5C461fefF7FE49ea5ebaF7728bB0ADfa
 *      Staking Contract: 0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f
 */
interface IMethToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IMethStaking {
    /**
     * @notice Stake ETH to receive mETH
     * @return mETH amount received
     */
    function stake() external payable returns (uint256);
    
    /**
     * @notice Unstake mETH to receive ETH
     * @param amount Amount of mETH to unstake
     */
    function unstake(uint256 amount) external;
    
    /**
     * @notice Get current mETH/ETH exchange rate
     * @return rate Exchange rate with 18 decimals
     */
    function mETHToETH(uint256 mETHAmount) external view returns (uint256);
    
    /**
     * @notice Get current staking APY
     * @return apy Annual percentage yield in basis points
     */
    function getAPY() external view returns (uint256 apy);
}
