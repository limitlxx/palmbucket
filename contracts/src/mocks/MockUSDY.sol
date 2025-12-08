// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDY
 * @notice Production-like mock of Ondo USDY for Sepolia testing
 * @dev Simulates 10% APY via rebasing mechanism (0.027% daily)
 */
contract MockUSDY is ERC20, Ownable {
    // Rebasing state
    uint256 public rebasingCreditsPerToken;
    mapping(address => uint256) private _credits;
    uint256 private _totalCredits;
    
    // Yield parameters
    uint256 public constant DAILY_YIELD_BPS = 27; // 0.027% daily ≈ 10% APY
    uint256 public constant BPS_DENOMINATOR = 100000;
    uint256 public lastRebaseTimestamp;
    
    // Oracle simulation
    uint256 public redemptionPrice; // 18 decimals
    
    event Rebased(uint256 newPrice, uint256 timestamp);
    
    constructor() ERC20("Mock USDY", "mUSDY") Ownable(msg.sender) {
        rebasingCreditsPerToken = 1e18;
        redemptionPrice = 1e18; // Start at $1.00
        lastRebaseTimestamp = block.timestamp;
    }
    
    /**
     * @notice Accrue interest (simulates daily yield)
     * @dev Can be called by anyone to update yield
     */
    function accrueInterest() public {
        uint256 timePassed = block.timestamp - lastRebaseTimestamp;
        if (timePassed == 0) return;
        
        // Calculate days passed (with precision)
        uint256 daysPassed = (timePassed * 1e18) / 1 days;
        
        // Apply compound interest: newPrice = oldPrice * (1 + dailyRate)^days
        // Simplified: newPrice = oldPrice * (1 + dailyRate * days) for small periods
        uint256 yieldAccrued = (redemptionPrice * DAILY_YIELD_BPS * daysPassed) / (BPS_DENOMINATOR * 1e18);
        redemptionPrice += yieldAccrued;
        
        // Update rebasing ratio
        rebasingCreditsPerToken = (rebasingCreditsPerToken * redemptionPrice) / 1e18;
        
        lastRebaseTimestamp = block.timestamp;
        emit Rebased(redemptionPrice, block.timestamp);
    }
    
    /**
     * @notice Mint USDY (simulates USDYManager.mint)
     */
    function mint(address to, uint256 amount) external {
        accrueInterest(); // Update yield before minting
        
        uint256 credits = (amount * rebasingCreditsPerToken) / 1e18;
        _credits[to] += credits;
        _totalCredits += credits;
        
        emit Transfer(address(0), to, amount);
    }
    
    /**
     * @notice Burn USDY (simulates redemption)
     */
    function burn(address from, uint256 amount) external {
        accrueInterest(); // Update yield before burning
        
        uint256 credits = (amount * rebasingCreditsPerToken) / 1e18;
        require(_credits[from] >= credits, "Insufficient balance");
        
        _credits[from] -= credits;
        _totalCredits -= credits;
        
        emit Transfer(from, address(0), amount);
    }
    
    /**
     * @notice Get balance (includes accrued yield)
     */
    function balanceOf(address account) public view override returns (uint256) {
        if (_credits[account] == 0) return 0;
        return (_credits[account] * 1e18) / rebasingCreditsPerToken;
    }
    
    /**
     * @notice Get total supply (includes accrued yield)
     */
    function totalSupply() public view override returns (uint256) {
        if (_totalCredits == 0) return 0;
        return (_totalCredits * 1e18) / rebasingCreditsPerToken;
    }
    
    /**
     * @notice Transfer with rebasing
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        address owner = _msgSender();
        uint256 credits = (amount * rebasingCreditsPerToken) / 1e18;
        
        require(_credits[owner] >= credits, "Insufficient balance");
        _credits[owner] -= credits;
        _credits[to] += credits;
        
        emit Transfer(owner, to, amount);
        return true;
    }
    
    /**
     * @notice Get current APY (for display)
     */
    function getAPY() external pure returns (uint256) {
        return 1000; // 10% in basis points
    }
}

/**
 * @title MockUSDYManager
 * @notice Mock manager for USDY minting/redemption
 */
contract MockUSDYManager {
    MockUSDY public usdy;
    address public usdc;
    
    uint256 public constant MINIMUM_DEPOSIT = 100e6; // 100 USDC
    
    constructor(address _usdy, address _usdc) {
        usdy = MockUSDY(_usdy);
        usdc = _usdc;
    }
    
    /**
     * @notice Mint USDY by depositing USDC
     */
    function mint(uint256 amount) external {
        require(amount >= MINIMUM_DEPOSIT, "Below minimum");
        
        // Transfer USDC from user
        (bool success, ) = usdc.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amount)
        );
        require(success, "USDC transfer failed");
        
        // Mint USDY (1:1 ratio, adjusting for decimals)
        uint256 usdyAmount = amount * 1e12; // USDC is 6 decimals, USDY is 18
        usdy.mint(msg.sender, usdyAmount);
    }
    
    /**
     * @notice Redeem USDY for USDC
     */
    function redeem(uint256 amount) external {
        // Burn USDY
        usdy.burn(msg.sender, amount);
        
        // Transfer USDC to user (1:1 ratio, adjusting for decimals)
        uint256 usdcAmount = amount / 1e12;
        (bool success, ) = usdc.call(
            abi.encodeWithSignature("transfer(address,uint256)", msg.sender, usdcAmount)
        );
        require(success, "USDC transfer failed");
    }
    
    function minimumDepositAmount() external pure returns (uint256) {
        return MINIMUM_DEPOSIT;
    }
}

/**
 * @title MockRedemptionPriceOracle
 * @notice Mock oracle for USDY price
 */
contract MockRedemptionPriceOracle {
    MockUSDY public usdy;
    
    constructor(address _usdy) {
        usdy = MockUSDY(_usdy);
    }
    
    /**
     * @notice Get current redemption price
     */
    function getPrice() external view returns (uint256) {
        return usdy.redemptionPrice();
    }
}
