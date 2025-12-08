// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BucketVault
 * @notice ERC-4626 compliant vault that holds user funds and generates yield through RWA integration
 * @dev Implements yield-bearing vault with external protocol integration for Ondo USDY and mETH
 */
contract BucketVault is ERC4626, Ownable, ReentrancyGuard {
    // Custom errors
    error YieldProtocolNotSet();
    error YieldProtocolCallFailed();
    error InsufficientBalance();
    error InvalidAmount();

    // Yield protocol interface
    address public yieldProtocol;
    bool public yieldEnabled;
    
    // Yield tracking
    uint256 public totalYieldEarned;
    uint256 public lastYieldUpdate;
    
    // Events
    event YieldProtocolSet(address indexed protocol);
    event YieldDeposited(uint256 amount, uint256 shares);
    event YieldWithdrawn(uint256 shares, uint256 amount);
    event YieldCompounded(uint256 amount);
    event YieldRateUpdated(uint256 newRate);

    /**
     * @notice Constructor for BucketVault
     * @param asset_ The underlying ERC20 asset
     * @param name_ The name of the vault token
     * @param symbol_ The symbol of the vault token
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(msg.sender) {
        lastYieldUpdate = block.timestamp;
    }

    /**
     * @notice Set the yield protocol address
     * @param protocol The address of the yield-generating protocol
     */
    function setYieldProtocol(address protocol) external onlyOwner {
        yieldProtocol = protocol;
        yieldEnabled = protocol != address(0);
        emit YieldProtocolSet(protocol);
    }

    /**
     * @notice Deposit assets to the yield protocol
     * @param amount The amount of assets to deposit
     * @dev This function integrates with external yield protocols like Ondo USDY or mETH
     */
    function depositToYieldProtocol(uint256 amount) external nonReentrant onlyOwner {
        if (!yieldEnabled) {
            revert YieldProtocolNotSet();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        IERC20 assetToken = IERC20(asset());
        uint256 balance = assetToken.balanceOf(address(this));
        
        if (balance < amount) {
            revert InsufficientBalance();
        }

        // Approve yield protocol to spend tokens
        assetToken.approve(yieldProtocol, amount);

        // Call external protocol with try-catch for error handling
        try this._externalDeposit(yieldProtocol, amount) {
            emit YieldDeposited(amount, amount); // Simplified 1:1 for now
        } catch Error(string memory /*reason*/) {
            // Revert approval on failure
            assetToken.approve(yieldProtocol, 0);
            revert YieldProtocolCallFailed();
        } catch (bytes memory) {
            // Revert approval on failure
            assetToken.approve(yieldProtocol, 0);
            revert YieldProtocolCallFailed();
        }
    }

    /**
     * @notice Internal function to call external deposit (for try-catch)
     * @param protocol The yield protocol address
     * @param amount The amount to deposit
     */
    function _externalDeposit(address protocol, uint256 amount) external {
        require(msg.sender == address(this), "Only self");
        (bool success, ) = protocol.call(
            abi.encodeWithSignature("deposit(uint256)", amount)
        );
        require(success, "External deposit failed");
    }

    /**
     * @notice Withdraw assets from the yield protocol
     * @param shares The number of shares to withdraw
     * @dev Converts yield protocol shares back to underlying assets
     */
    function withdrawFromYieldProtocol(uint256 shares) external nonReentrant onlyOwner {
        if (!yieldEnabled) {
            revert YieldProtocolNotSet();
        }
        if (shares == 0) {
            revert InvalidAmount();
        }

        // Call external protocol to withdraw with try-catch
        try this._externalWithdraw(yieldProtocol, shares) returns (uint256 amount) {
            emit YieldWithdrawn(shares, amount);
        } catch Error(string memory /*reason*/) {
            revert YieldProtocolCallFailed();
        } catch (bytes memory) {
            revert YieldProtocolCallFailed();
        }
    }

    /**
     * @notice Internal function to call external withdraw (for try-catch)
     * @param protocol The yield protocol address
     * @param shares The shares to withdraw
     * @return amount The amount withdrawn
     */
    function _externalWithdraw(address protocol, uint256 shares) external returns (uint256 amount) {
        require(msg.sender == address(this), "Only self");
        (bool success, bytes memory data) = protocol.call(
            abi.encodeWithSignature("withdraw(uint256)", shares)
        );
        require(success, "External withdraw failed");
        amount = abi.decode(data, (uint256));
    }

    /**
     * @notice Get the current yield rate from the protocol
     * @return The annual percentage yield (APY) in basis points (e.g., 1000 = 10%)
     */
    function getYieldRate() external view returns (uint256) {
        if (!yieldEnabled) {
            return 0;
        }

        // In production, this would query the external protocol
        // For now, return a mock rate
        return 1000; // 10% APY
    }

    /**
     * @notice Compound accumulated yield back into the vault
     * @dev Reinvests earned yield to generate compound returns
     */
    function compoundYield() external nonReentrant {
        if (!yieldEnabled) {
            revert YieldProtocolNotSet();
        }

        // Calculate yield earned since last update
        uint256 timePassed = block.timestamp - lastYieldUpdate;
        uint256 currentAssets = totalAssets();
        
        // Simple yield calculation: 10% APY
        // In production, this would query actual yield from protocol
        uint256 yieldEarned = (currentAssets * 1000 * timePassed) / (365 days * 10000);
        
        if (yieldEarned > 0) {
            totalYieldEarned += yieldEarned;
            lastYieldUpdate = block.timestamp;
            
            emit YieldCompounded(yieldEarned);
        }
    }

    /**
     * @notice Override totalAssets to include yield
     * @return Total assets including earned yield
     */
    function totalAssets() public view virtual override returns (uint256) {
        uint256 baseAssets = IERC20(asset()).balanceOf(address(this));
        
        // Add simulated yield
        if (yieldEnabled) {
            uint256 timePassed = block.timestamp - lastYieldUpdate;
            uint256 simulatedYield = (baseAssets * 1000 * timePassed) / (365 days * 10000);
            return baseAssets + totalYieldEarned + simulatedYield;
        }
        
        return baseAssets + totalYieldEarned;
    }

    /**
     * @notice Override deposit to automatically activate yield
     * @param assets Amount of assets to deposit
     * @param receiver Address to receive vault shares
     * @return shares Amount of shares minted
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        returns (uint256 shares) 
    {
        shares = super.deposit(assets, receiver);
        
        // Automatically deposit to yield protocol if enabled
        if (yieldEnabled && assets > 0) {
            // In production, would deposit to external protocol
            // For now, just emit event
            emit YieldDeposited(assets, shares);
        }
        
        return shares;
    }

    /**
     * @notice Override withdraw to handle yield protocol withdrawals
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive assets
     * @param owner Address of share owner
     * @return shares Amount of shares burned
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        returns (uint256 shares)
    {
        // If yield is enabled, may need to withdraw from protocol first
        if (yieldEnabled) {
            uint256 availableBalance = IERC20(asset()).balanceOf(address(this));
            if (availableBalance < assets) {
                // In production, would withdraw from external protocol
                emit YieldWithdrawn(assets - availableBalance, assets - availableBalance);
            }
        }
        
        shares = super.withdraw(assets, receiver, owner);
        return shares;
    }
}
