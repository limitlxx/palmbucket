// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../BucketVaultV2.sol";

/**
 * @title SpendableVault
 * @notice Spendable bucket with no yield - optimized for instant access
 * @dev Simple vault for daily expenses with instant withdrawals
 *      No yield generation, no delays, no fees
 *      Optimized for frequent deposits and withdrawals
 */
contract SpendableVault is BucketVaultV2 {
    /**
     * @notice Constructor
     * @param asset_ Base asset (USDC)
     * @param maxDeposit_ Maximum total deposits
     */
    constructor(
        IERC20 asset_,
        uint256 maxDeposit_
    ) BucketVaultV2(
        asset_,
        "PalmBudget Spendable Vault",
        "pbSPEND",
        VaultType.SPENDABLE,
        maxDeposit_
    ) {
        // No yield protocol
        yieldEnabled = false;
        
        // Override withdrawal config for instant access
        withdrawalDelaySeconds = 0;
        withdrawalFeeBps = 0;
    }
    
    /**
     * @notice No protocol deposit (Spendable doesn't earn yield)
     */
    function _depositToProtocol(uint256) internal pure override {
        // No-op: Spendable vault doesn't use yield protocols
    }
    
    /**
     * @notice No protocol withdrawal (Spendable doesn't earn yield)
     */
    function _withdrawFromProtocol(uint256 amount) internal pure override returns (uint256) {
        // No-op: Spendable vault doesn't use yield protocols
        return amount;
    }
    
    /**
     * @notice No yield rate (Spendable doesn't earn yield)
     */
    function _getProtocolYieldRate() internal pure override returns (uint256) {
        return 0; // No yield
    }
    
    /**
     * @notice Override totalAssets for simple balance
     * @dev No yield accrual, just base balance
     */
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
    
    /**
     * @notice Optimized deposit for frequent use
     * @dev Skips yield protocol integration
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        returns (uint256 shares) 
    {
        // Check deposit limit
        if (totalAssets() + assets > maxDepositLimit) revert ExceedsMaxDeposit();
        
        // Standard ERC4626 deposit
        shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);
        
        // No yield protocol deposit needed
        return shares;
    }
    
    /**
     * @notice Optimized withdrawal for frequent use
     * @dev No delays, no fees, instant access
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        returns (uint256 shares)
    {
        // Standard ERC4626 withdrawal (no delays or fees)
        shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);
        
        return shares;
    }
    
    /**
     * @notice Fast transfer between users (optimized for payments)
     * @dev Useful for peer-to-peer transfers within the vault
     */
    function fastTransfer(address to, uint256 shares) external returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf(msg.sender) >= shares, "Insufficient balance");
        
        _transfer(msg.sender, to, shares);
        return true;
    }
    
    /**
     * @notice Get instant withdrawal amount (no fees)
     */
    function previewInstantWithdraw(uint256 assets) external view returns (uint256 shares) {
        return previewWithdraw(assets);
    }
}
