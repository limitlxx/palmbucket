// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDEXRouter.sol";

/**
 * @title SwapHelper
 * @notice Helper contract for multi-asset swaps with slippage protection
 * @dev Used by vaults to accept deposits in various tokens
 */
abstract contract SwapHelper {
    using SafeERC20 for IERC20;
    
    // DEX router for swaps
    IDEXRouter public dexRouter;
    
    // Note: maxSlippageBps is defined in parent contract
    uint256 internal constant BPS_DENOMINATOR = 10000;
    
    // Events
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippageBps
    );
    event DEXRouterUpdated(address indexed newRouter);
    
    // Errors
    error SlippageTooHigh();
    error SwapFailed();
    error InvalidPath();
    
    /**
     * @notice Get maximum slippage (to be overridden by parent)
     */
    function _getMaxSlippage() internal view virtual returns (uint256) {
        return 50; // Default 0.5%
    }
    
    /**
     * @notice Set DEX router address
     */
    function _setDEXRouter(address router) internal {
        dexRouter = IDEXRouter(router);
        emit DEXRouterUpdated(router);
    }
    
    /**
     * @notice Swap tokens with slippage protection
     * @param fromToken Input token address
     * @param toToken Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum amount of output tokens
     * @return amountOut Actual amount of output tokens received
     */
    function _swapTokens(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        if (fromToken == toToken) {
            return amountIn; // No swap needed
        }
        
        // Get expected output amount
        address[] memory path = _getSwapPath(fromToken, toToken);
        uint256[] memory expectedAmounts = dexRouter.getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        
        // Calculate slippage
        uint256 slippageBps = ((expectedOut - minAmountOut) * BPS_DENOMINATOR) / expectedOut;
        if (slippageBps > _getMaxSlippage()) revert SlippageTooHigh();
        
        // Approve router
        IERC20(fromToken).safeIncreaseAllowance(address(dexRouter), amountIn);
        
        // Execute swap
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        ) returns (uint256[] memory amounts) {
            amountOut = amounts[amounts.length - 1];
            emit SwapExecuted(fromToken, toToken, amountIn, amountOut, slippageBps);
        } catch {
            revert SwapFailed();
        }
        
        return amountOut;
    }
    
    /**
     * @notice Swap ETH for tokens with slippage protection
     * @param toToken Output token address
     * @param ethAmount Amount of ETH to swap
     * @param minAmountOut Minimum amount of output tokens
     * @return amountOut Actual amount of output tokens received
     */
    function _swapETHForTokens(
        address toToken,
        uint256 ethAmount,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        address weth = dexRouter.WETH();
        
        // Get expected output amount
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = toToken;
        
        uint256[] memory expectedAmounts = dexRouter.getAmountsOut(ethAmount, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        
        // Calculate slippage
        uint256 slippageBps = ((expectedOut - minAmountOut) * BPS_DENOMINATOR) / expectedOut;
        if (slippageBps > _getMaxSlippage()) revert SlippageTooHigh();
        
        // Execute swap
        try dexRouter.swapExactETHForTokens{value: ethAmount}(
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint256[] memory amounts) {
            amountOut = amounts[amounts.length - 1];
            emit SwapExecuted(weth, toToken, ethAmount, amountOut, slippageBps);
        } catch {
            revert SwapFailed();
        }
        
        return amountOut;
    }
    
    /**
     * @notice Get swap path between two tokens
     * @dev For testnet: direct path. For mainnet: may route through WETH
     */
    function _getSwapPath(
        address fromToken,
        address toToken
    ) internal view returns (address[] memory path) {
        address weth = dexRouter.WETH();
        
        // Direct path if one token is WETH
        if (fromToken == weth || toToken == weth) {
            path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
            return path;
        }
        
        // Route through WETH for other pairs
        path = new address[](3);
        path[0] = fromToken;
        path[1] = weth;
        path[2] = toToken;
        
        return path;
    }
    
    /**
     * @notice Calculate minimum output with slippage
     * @param expectedAmount Expected output amount
     * @param slippageBps Slippage tolerance in basis points
     * @return minAmount Minimum acceptable output amount
     */
    function _calculateMinOutput(
        uint256 expectedAmount,
        uint256 slippageBps
    ) internal pure returns (uint256 minAmount) {
        return (expectedAmount * (BPS_DENOMINATOR - slippageBps)) / BPS_DENOMINATOR;
    }
    
    /**
     * @notice Get quote for a swap
     * @param fromToken Input token
     * @param toToken Output token
     * @param amountIn Input amount
     * @return amountOut Expected output amount
     */
    function getSwapQuote(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        if (fromToken == toToken) return amountIn;
        
        address[] memory path = _getSwapPath(fromToken, toToken);
        uint256[] memory amounts = dexRouter.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }
}
