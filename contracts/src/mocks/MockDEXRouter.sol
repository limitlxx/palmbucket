// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockDEXRouter
 * @notice Mock DEX router for testing multi-asset swaps
 * @dev Simulates FusionX/Uniswap V2 style router with simplified pricing
 */
contract MockDEXRouter {
    using SafeERC20 for IERC20;
    
    address public immutable WETH;
    
    // Simplified price oracle (token => price in USDC with 6 decimals)
    mapping(address => uint256) public prices;
    
    event Swap(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );
    
    constructor(address _weth) {
        WETH = _weth;
    }
    
    /**
     * @notice Set price for a token (in USDC with 6 decimals)
     * @dev For testing: 1 ETH = $2000, 1 mETH = $2100, etc.
     */
    function setPrice(address token, uint256 priceInUSDC) external {
        prices[token] = priceInUSDC;
    }
    
    /**
     * @notice Swap exact tokens for tokens
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        
        amounts = getAmountsOut(amountIn, path);
        uint256 amountOut = amounts[amounts.length - 1];
        
        require(amountOut >= amountOutMin, "Insufficient output");
        
        // Transfer input token from sender
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Transfer output token to recipient
        IERC20(path[path.length - 1]).safeTransfer(to, amountOut);
        
        emit Swap(path[0], path[path.length - 1], amountIn, amountOut, to);
        
        return amounts;
    }
    
    /**
     * @notice Swap exact ETH for tokens
     */
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        require(path[0] == WETH, "Invalid path");
        
        amounts = getAmountsOut(msg.value, path);
        uint256 amountOut = amounts[amounts.length - 1];
        
        require(amountOut >= amountOutMin, "Insufficient output");
        
        // Transfer output token to recipient
        IERC20(path[path.length - 1]).safeTransfer(to, amountOut);
        
        emit Swap(WETH, path[path.length - 1], msg.value, amountOut, to);
        
        return amounts;
    }
    
    /**
     * @notice Swap exact tokens for ETH
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        require(path[path.length - 1] == WETH, "Invalid path");
        
        amounts = getAmountsOut(amountIn, path);
        uint256 amountOut = amounts[amounts.length - 1];
        
        require(amountOut >= amountOutMin, "Insufficient output");
        
        // Transfer input token from sender
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Transfer ETH to recipient
        (bool success, ) = to.call{value: amountOut}("");
        require(success, "ETH transfer failed");
        
        emit Swap(path[0], WETH, amountIn, amountOut, to);
        
        return amounts;
    }
    
    /**
     * @notice Get amounts out for a given input
     * @dev Simplified pricing: uses oracle prices
     */
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        for (uint256 i = 0; i < path.length - 1; i++) {
            amounts[i + 1] = _getAmountOut(amounts[i], path[i], path[i + 1]);
        }
        
        return amounts;
    }
    
    /**
     * @notice Calculate output amount for a swap
     * @dev Simplified: uses oracle prices with 0.3% fee
     */
    function _getAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256) {
        // Get prices (in USDC with 6 decimals)
        uint256 priceIn = prices[tokenIn];
        uint256 priceOut = prices[tokenOut];
        
        require(priceIn > 0 && priceOut > 0, "Price not set");
        
        // Get token decimals (assume 18 for ETH/WETH, 6 for USDC)
        uint256 decimalsIn = _getDecimals(tokenIn);
        uint256 decimalsOut = _getDecimals(tokenOut);
        
        // Calculate value in USDC
        uint256 valueInUSDC = (amountIn * priceIn) / (10 ** decimalsIn);
        
        // Apply 0.3% fee
        valueInUSDC = (valueInUSDC * 997) / 1000;
        
        // Convert to output token
        uint256 amountOut = (valueInUSDC * (10 ** decimalsOut)) / priceOut;
        
        return amountOut;
    }
    
    /**
     * @notice Get token decimals (simplified)
     */
    function _getDecimals(address token) internal view returns (uint256) {
        if (token == WETH) return 18;
        
        // Try to get decimals from token
        try IERC20Metadata(token).decimals() returns (uint8 decimals) {
            return decimals;
        } catch {
            return 18; // Default to 18
        }
    }
    
    /**
     * @notice Fund router with tokens for swaps (testnet helper)
     */
    function fundRouter(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}

/**
 * @title IERC20Metadata
 * @notice Interface for ERC20 metadata
 */
interface IERC20Metadata {
    function decimals() external view returns (uint8);
}
