// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDEXRouter.sol";

/**
 * @title SwapHelperUpgradeable
 * @notice Upgradeable helper contract for multi-asset swaps with slippage protection
 */
abstract contract SwapHelperUpgradeable is Initializable {
    using SafeERC20 for IERC20;
    
    IDEXRouter public dexRouter;
    
    uint256 internal constant BPS_DENOMINATOR = 10000;
    
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippageBps
    );
    event DEXRouterUpdated(address indexed newRouter);
    
    error SlippageTooHigh();
    error SwapFailed();
    error InvalidPath();

    function __SwapHelper_init() internal onlyInitializing {
        __SwapHelper_init_unchained();
    }

    function __SwapHelper_init_unchained() internal onlyInitializing {}
    
    function _getMaxSlippage() internal view virtual returns (uint256) {
        return 50;
    }
    
    function _setDEXRouter(address router) internal {
        dexRouter = IDEXRouter(router);
        emit DEXRouterUpdated(router);
    }
    
    function _swapTokens(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        if (fromToken == toToken) {
            return amountIn;
        }
        
        address[] memory path = _getSwapPath(fromToken, toToken);
        uint256[] memory expectedAmounts = dexRouter.getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        
        uint256 slippageBps = ((expectedOut - minAmountOut) * BPS_DENOMINATOR) / expectedOut;
        if (slippageBps > _getMaxSlippage()) revert SlippageTooHigh();
        
        IERC20(fromToken).safeIncreaseAllowance(address(dexRouter), amountIn);
        
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint256[] memory amounts) {
            amountOut = amounts[amounts.length - 1];
            emit SwapExecuted(fromToken, toToken, amountIn, amountOut, slippageBps);
        } catch {
            revert SwapFailed();
        }
        
        return amountOut;
    }
    
    function _swapETHForTokens(
        address toToken,
        uint256 ethAmount,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        address weth = dexRouter.WETH();
        
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = toToken;
        
        uint256[] memory expectedAmounts = dexRouter.getAmountsOut(ethAmount, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        
        uint256 slippageBps = ((expectedOut - minAmountOut) * BPS_DENOMINATOR) / expectedOut;
        if (slippageBps > _getMaxSlippage()) revert SlippageTooHigh();
        
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
    
    function _getSwapPath(
        address fromToken,
        address toToken
    ) internal view returns (address[] memory path) {
        address weth = dexRouter.WETH();
        
        if (fromToken == weth || toToken == weth) {
            path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
            return path;
        }
        
        path = new address[](3);
        path[0] = fromToken;
        path[1] = weth;
        path[2] = toToken;
        
        return path;
    }
    
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

    uint256[50] private __gap;
}
