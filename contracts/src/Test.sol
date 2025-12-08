// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@quant-finance/solidity-datetime/contracts/DateTime.sol";

/**
 * @title DateTimeTest
 * @notice Test contract to verify DateTime library installation
 */
contract DateTimeTest {
    using DateTime for uint256;

    function testGetDay(uint256 timestamp) external pure returns (uint256) {
        return DateTime.getDay(timestamp);
    }

    function testGetMonth(uint256 timestamp) external pure returns (uint256) {
        return DateTime.getMonth(timestamp);
    }

    function testGetYear(uint256 timestamp) external pure returns (uint256) {
        return DateTime.getYear(timestamp);
    }

    function testGetDaysInMonth(uint256 timestamp) external pure returns (uint256) {
        return DateTime.getDaysInMonth(timestamp);
    }

    function testIsLeapYear(uint256 timestamp) external pure returns (bool) {
        return DateTime.isLeapYear(timestamp);
    }
}
