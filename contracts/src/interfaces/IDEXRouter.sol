// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDEXRouter
 * @notice Interface for DEX routers (FusionX, Uniswap V2 style)
 * @dev Used for multi-asset swaps in vaults
 *      Mainnet: FusionX on Mantle
 *      Testnet: MockDEXRouter for simulation
 */
interface IDEXRouter {
    /**
     * @notice Swap exact tokens for tokens
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum amount of output tokens
     * @param path Array of token addresses for swap path
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @notice Swap exact ETH for tokens
     * @param amountOutMin Minimum amount of output tokens
     * @param path Array of token addresses for swap path
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step
     */
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    /**
     * @notice Swap exact tokens for ETH
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum amount of ETH
     * @param path Array of token addresses for swap path
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @notice Get amounts out for a given input
     * @param amountIn Amount of input tokens
     * @param path Array of token addresses for swap path
     * @return amounts Array of amounts for each step
     */
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
    
    /**
     * @notice Get WETH address
     */
    function WETH() external view returns (address);
}
