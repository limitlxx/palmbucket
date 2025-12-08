// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockYieldProtocol
 * @notice Mock yield protocol for testing BucketVault integration
 */
contract MockYieldProtocol {
    mapping(address => uint256) public deposits;
    
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * @notice Mock deposit function
     */
    function deposit(uint256 amount) external returns (bool) {
        deposits[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
        return true;
    }

    /**
     * @notice Mock withdraw function
     */
    function withdraw(uint256 shares) external returns (uint256) {
        uint256 amount = shares; // 1:1 for simplicity
        deposits[msg.sender] -= amount;
        emit Withdrawn(msg.sender, amount);
        return amount;
    }

    /**
     * @notice Get deposited amount for an address
     */
    function balanceOf(address user) external view returns (uint256) {
        return deposits[user];
    }
}
