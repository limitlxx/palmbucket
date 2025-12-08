// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockAToken
 * @notice Mock aToken (interest-bearing token from Lendle/Aave)
 */
contract MockAToken is ERC20 {
    address public underlyingAsset;
    address public pool;
    
    // Yield tracking
    uint256 public liquidityIndex; // 27 decimals (Ray)
    uint256 public lastUpdateTimestamp;
    uint256 public constant ANNUAL_YIELD_BPS = 450; // 4.5% APY
    uint256 public constant RAY = 1e27;
    
    constructor(address _underlyingAsset, string memory name, string memory symbol) 
        ERC20(name, symbol) 
    {
        underlyingAsset = _underlyingAsset;
        pool = msg.sender;
        liquidityIndex = RAY; // Start at 1.0
        lastUpdateTimestamp = block.timestamp;
    }
    
    /**
     * @notice Update liquidity index (accrues yield)
     */
    function updateIndex() public {
        uint256 timePassed = block.timestamp - lastUpdateTimestamp;
        if (timePassed == 0) return;
        
        // Calculate yield: index * (1 + APY * time / year)
        uint256 yieldAccrued = (liquidityIndex * ANNUAL_YIELD_BPS * timePassed) / (10000 * 365 days);
        liquidityIndex += yieldAccrued;
        
        lastUpdateTimestamp = block.timestamp;
    }
    
    /**
     * @notice Mint aTokens (called by pool on supply)
     */
    function mint(address user, uint256 amount) external {
        require(msg.sender == pool, "Only pool");
        updateIndex();
        _mint(user, amount);
    }
    
    /**
     * @notice Burn aTokens (called by pool on withdraw)
     */
    function burn(address user, uint256 amount) external {
        require(msg.sender == pool, "Only pool");
        updateIndex();
        _burn(user, amount);
    }
    
    /**
     * @notice Get scaled balance (includes accrued interest)
     */
    function balanceOf(address account) public view override returns (uint256) {
        uint256 scaledBalance = super.balanceOf(account);
        if (scaledBalance == 0) return 0;
        
        // Calculate current index
        uint256 timePassed = block.timestamp - lastUpdateTimestamp;
        uint256 currentIndex = liquidityIndex;
        if (timePassed > 0) {
            uint256 yieldAccrued = (liquidityIndex * ANNUAL_YIELD_BPS * timePassed) / (10000 * 365 days);
            currentIndex += yieldAccrued;
        }
        
        // Return balance with accrued interest
        return (scaledBalance * currentIndex) / RAY;
    }
}

/**
 * @title MockLendlePool
 * @notice Production-like mock of Lendle lending pool
 */
contract MockLendlePool {
    mapping(address => address) public aTokens; // asset => aToken
    mapping(address => uint256) public liquidityRates; // asset => rate (Ray)
    
    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    
    /**
     * @notice Initialize aToken for an asset
     */
    function initReserve(address asset, string memory name, string memory symbol) external {
        require(aTokens[asset] == address(0), "Already initialized");
        
        MockAToken aToken = new MockAToken(asset, name, symbol);
        aTokens[asset] = address(aToken);
        liquidityRates[asset] = 45e25; // 4.5% in Ray (27 decimals)
    }
    
    /**
     * @notice Supply assets to earn yield
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 /* referralCode */
    ) external {
        require(aTokens[asset] != address(0), "Reserve not initialized");
        
        // Transfer underlying asset from user
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        
        // Mint aTokens
        MockAToken(aTokens[asset]).mint(onBehalfOf, amount);
        
        emit Supply(msg.sender, asset, amount);
    }
    
    /**
     * @notice Withdraw assets
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(aTokens[asset] != address(0), "Reserve not initialized");
        
        MockAToken aToken = MockAToken(aTokens[asset]);
        uint256 userBalance = aToken.balanceOf(msg.sender);
        
        // Handle max withdrawal
        uint256 amountToWithdraw = amount;
        if (amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }
        
        require(userBalance >= amountToWithdraw, "Insufficient balance");
        
        // Burn aTokens
        aToken.burn(msg.sender, amountToWithdraw);
        
        // Transfer underlying asset
        IERC20(asset).transfer(to, amountToWithdraw);
        
        emit Withdraw(msg.sender, asset, amountToWithdraw);
        return amountToWithdraw;
    }
    
    /**
     * @notice Get reserve data (simplified for testing)
     */
    function getReserveData(address asset) external view returns (
        uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16,
        address, address, address, address, uint128, uint128, uint128
    ) {
        address aTokenAddr = aTokens[asset];
        uint128 rate = uint128(liquidityRates[asset] / 1e9);
        
        return (
            0, 0, rate, 0, 0, 0, 0, 0,
            aTokenAddr, address(0), address(0), address(0), 0, 0, 0
        );
    }
    
    /**
     * @notice Get aToken address for an asset
     */
    function getAToken(address asset) external view returns (address) {
        return aTokens[asset];
    }
    
    /**
     * @notice Get current supply rate for an asset
     */
    function getSupplyRate(address asset) external view returns (uint256) {
        return liquidityRates[asset];
    }
}
