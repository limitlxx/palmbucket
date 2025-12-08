// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockMeth
 * @notice Production-like mock of Mantle mETH for Sepolia testing
 * @dev Simulates 5% APY liquid staking rewards
 */
contract MockMeth is ERC20, Ownable {
    // Exchange rate tracking
    uint256 public exchangeRate; // mETH per ETH (18 decimals)
    uint256 public lastUpdateTimestamp;
    
    // Yield parameters
    uint256 public constant ANNUAL_YIELD_BPS = 500; // 5% APY
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    event Staked(address indexed user, uint256 ethAmount, uint256 mEthAmount);
    event Unstaked(address indexed user, uint256 mEthAmount, uint256 ethAmount);
    event ExchangeRateUpdated(uint256 newRate, uint256 timestamp);
    
    constructor() ERC20("Mock mETH", "mMETH") Ownable(msg.sender) {
        exchangeRate = 1e18; // Start at 1:1
        lastUpdateTimestamp = block.timestamp;
    }
    
    /**
     * @notice Update exchange rate based on time passed
     */
    function updateExchangeRate() public {
        uint256 timePassed = block.timestamp - lastUpdateTimestamp;
        if (timePassed == 0) return;
        
        // Calculate yield: rate * (1 + APY * time / year)
        uint256 yieldAccrued = (exchangeRate * ANNUAL_YIELD_BPS * timePassed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        exchangeRate += yieldAccrued;
        
        lastUpdateTimestamp = block.timestamp;
        emit ExchangeRateUpdated(exchangeRate, block.timestamp);
    }
    
    /**
     * @notice Stake ETH to receive mETH
     */
    function stake() external payable returns (uint256) {
        require(msg.value > 0, "Must stake ETH");
        updateExchangeRate();
        
        // Calculate mETH amount: ethAmount * 1e18 / exchangeRate
        uint256 mEthAmount = (msg.value * 1e18) / exchangeRate;
        
        _mint(msg.sender, mEthAmount);
        emit Staked(msg.sender, msg.value, mEthAmount);
        
        return mEthAmount;
    }
    
    /**
     * @notice Unstake mETH to receive ETH
     */
    function unstake(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient mETH");
        updateExchangeRate();
        
        // Calculate ETH amount: mEthAmount * exchangeRate / 1e18
        uint256 ethAmount = (amount * exchangeRate) / 1e18;
        require(address(this).balance >= ethAmount, "Insufficient ETH in contract");
        
        _burn(msg.sender, amount);
        
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        
        emit Unstaked(msg.sender, amount, ethAmount);
    }
    
    /**
     * @notice Convert mETH amount to ETH
     */
    function mETHToETH(uint256 mETHAmount) external view returns (uint256) {
        return (mETHAmount * exchangeRate) / 1e18;
    }
    
    /**
     * @notice Get current staking APY
     */
    function getAPY() external pure returns (uint256) {
        return ANNUAL_YIELD_BPS; // 500 = 5%
    }
    
    /**
     * @notice Fund contract with ETH for unstaking (testnet helper)
     */
    receive() external payable {}
}

/**
 * @title MockMethStaking
 * @notice Wrapper contract that matches IMethStaking interface
 */
contract MockMethStaking {
    MockMeth public meth;
    
    constructor(address _meth) {
        meth = MockMeth(payable(_meth));
    }
    
    function stake() external payable returns (uint256) {
        return meth.stake{value: msg.value}();
    }
    
    function unstake(uint256 amount) external {
        // Transfer mETH from user to this contract
        (bool success, ) = address(meth).call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amount)
        );
        require(success, "mETH transfer failed");
        
        // Unstake and forward ETH to user
        meth.unstake(amount);
        (success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "ETH transfer failed");
    }
    
    function mETHToETH(uint256 mETHAmount) external view returns (uint256) {
        return meth.mETHToETH(mETHAmount);
    }
    
    function getAPY() external pure returns (uint256) {
        return 500; // 5%
    }
    
    receive() external payable {}
}
