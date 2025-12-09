// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@quant-finance/solidity-datetime/contracts/DateTime.sol";

interface IBucketVault {
    function getYieldRate() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function asset() external view returns (address);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

/**
 * @title SweepKeeperUpgradeable
 * @notice Upgradeable automated keeper for sweeping funds to highest-yielding buckets
 */
contract SweepKeeperUpgradeable is 
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    error InvalidBucketAddress();
    error InvalidMinimumBalance();
    error InsufficientBalance();
    error TransferFailed();
    error NotMonthEnd();
    error NotAuthorized();
    error AlreadyAuthorized();
    error NotAuthorizedYet();
    error ContractPaused();

    mapping(address => bool) private _authorized;
    mapping(address => uint256) private _userMinimumBalance;
    mapping(address => bool) private _hasCustomMinimum;

    uint256 public globalMinimumBalance;
    uint256 public minimumSpendableBalance;

    address public billsBucket;
    address public savingsBucket;
    address public growthBucket;
    address public spendableBucket;

    uint256 public lastSweepTimestamp;
    mapping(address => uint256) private _lastSweepTimestamp;

    event AuthorizationChanged(address indexed user, bool authorized);
    event SweepExecuted(
        address indexed user,
        uint256 amount,
        address indexed fromBucket,
        address indexed toBucket,
        uint256 expectedYield,
        uint256 timestamp
    );
    event MinimumBalanceUpdated(uint256 newMinimum);
    event UserMinimumBalanceUpdated(address indexed user, uint256 newMinimum);
    event GlobalMinimumBalanceUpdated(uint256 newMinimum);
    event BucketAddressesUpdated(
        address bills,
        address savings,
        address growth,
        address spendable
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _minimumSpendableBalance, address owner_) public initializer {
        __Ownable_init(owner_);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        globalMinimumBalance = _minimumSpendableBalance;
        minimumSpendableBalance = _minimumSpendableBalance;
        lastSweepTimestamp = block.timestamp;
    }

    function authorizeAutoSweep() external {
        if (_authorized[msg.sender]) {
            revert AlreadyAuthorized();
        }
        _authorized[msg.sender] = true;
        emit AuthorizationChanged(msg.sender, true);
    }

    function revokeAutoSweep() external {
        if (!_authorized[msg.sender]) {
            revert NotAuthorizedYet();
        }
        _authorized[msg.sender] = false;
        emit AuthorizationChanged(msg.sender, false);
    }

    function isAuthorized(address user) public view returns (bool) {
        return _authorized[user];
    }

    function isPaused() public view returns (bool) {
        return paused();
    }

    function setUserMinimumBalance(uint256 minimum) external {
        if (minimum > 1e12) {
            revert InvalidMinimumBalance();
        }
        
        _userMinimumBalance[msg.sender] = minimum;
        _hasCustomMinimum[msg.sender] = true;
        
        emit UserMinimumBalanceUpdated(msg.sender, minimum);
    }

    function getUserMinimumBalance(address user) public view returns (uint256) {
        if (_hasCustomMinimum[user]) {
            return _userMinimumBalance[user];
        }
        return globalMinimumBalance;
    }

    function setBucketAddresses(
        address _bills,
        address _savings,
        address _growth,
        address _spendable
    ) external onlyOwner {
        if (_bills == address(0) || _savings == address(0) || 
            _growth == address(0) || _spendable == address(0)) {
            revert InvalidBucketAddress();
        }

        billsBucket = _bills;
        savingsBucket = _savings;
        growthBucket = _growth;
        spendableBucket = _spendable;

        emit BucketAddressesUpdated(_bills, _savings, _growth, _spendable);
    }

    function setMinimumBalance(uint256 _minimum) external onlyOwner {
        minimumSpendableBalance = _minimum;
        globalMinimumBalance = _minimum;
        emit MinimumBalanceUpdated(_minimum);
    }

    function setGlobalMinimumBalance(uint256 minimum) external onlyOwner {
        if (minimum > 1e12) {
            revert InvalidMinimumBalance();
        }
        
        globalMinimumBalance = minimum;
        minimumSpendableBalance = minimum;
        
        emit GlobalMinimumBalanceUpdated(minimum);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getDayOfMonth() public view returns (uint256) {
        return DateTime.getDay(block.timestamp);
    }

    function getMonth() public view returns (uint256) {
        return DateTime.getMonth(block.timestamp);
    }

    function getYear() public view returns (uint256) {
        return DateTime.getYear(block.timestamp);
    }

    function getDaysInMonth() public view returns (uint256) {
        return DateTime.getDaysInMonth(block.timestamp);
    }

    function isMonthEnd() public view returns (bool) {
        uint256 dayOfMonth = getDayOfMonth();
        uint256 daysInMonth = getDaysInMonth();
        
        return dayOfMonth >= daysInMonth - 2;
    }

    function getHighestYieldBucket() public view returns (address, uint256) {
        uint256 billsYield = IBucketVault(billsBucket).getYieldRate();
        uint256 savingsYield = IBucketVault(savingsBucket).getYieldRate();
        uint256 growthYield = IBucketVault(growthBucket).getYieldRate();

        address highestBucket = billsBucket;
        uint256 highestYield = billsYield;

        if (savingsYield > highestYield) {
            highestBucket = savingsBucket;
            highestYield = savingsYield;
        }

        if (growthYield > highestYield) {
            highestBucket = growthBucket;
            highestYield = growthYield;
        }

        return (highestBucket, highestYield);
    }

    function getSweepableAmount(address user) public view returns (uint256) {
        uint256 spendableBalance = IBucketVault(spendableBucket).balanceOf(user);
        
        uint256 applicableMinimum = getUserMinimumBalance(user);
        
        if (spendableBalance <= applicableMinimum) {
            return 0;
        }

        return spendableBalance - applicableMinimum;
    }

    function executeSweep(address user) external nonReentrant whenNotPaused {
        if (billsBucket == address(0) || savingsBucket == address(0) || 
            growthBucket == address(0) || spendableBucket == address(0)) {
            revert InvalidBucketAddress();
        }

        if (!_authorized[user]) {
            revert NotAuthorized();
        }

        if (!isMonthEnd()) {
            revert NotMonthEnd();
        }

        uint256 sweepAmount = getSweepableAmount(user);
        
        if (sweepAmount == 0) {
            revert InsufficientBalance();
        }

        (address targetBucket, uint256 yieldRate) = getHighestYieldBucket();

        uint256 expectedYield = (sweepAmount * yieldRate) / 10000;

        lastSweepTimestamp = block.timestamp;
        _lastSweepTimestamp[user] = block.timestamp;

        uint256 sharesRedeemed = IBucketVault(spendableBucket).withdraw(
            sweepAmount,
            address(this),
            user
        );
        
        if (sharesRedeemed == 0) {
            revert TransferFailed();
        }

        IERC20 underlyingAsset = IERC20(IBucketVault(spendableBucket).asset());
        underlyingAsset.approve(targetBucket, sweepAmount);
        
        uint256 sharesMinted = IBucketVault(targetBucket).deposit(sweepAmount, user);
        
        if (sharesMinted == 0) {
            revert TransferFailed();
        }

        emit SweepExecuted(
            user,
            sweepAmount,
            spendableBucket,
            targetBucket,
            expectedYield,
            block.timestamp
        );
    }

    function checker(address user) 
        external 
        view 
        returns (bool canExec, bytes memory execPayload) 
    {
        if (paused()) {
            return (false, bytes(""));
        }

        if (!_authorized[user]) {
            return (false, bytes(""));
        }

        if (spendableBucket == address(0)) {
            return (false, bytes(""));
        }

        try this.isMonthEnd() returns (bool isMonthEndNow) {
            if (!isMonthEndNow) {
                return (false, bytes(""));
            }
        } catch {
            return (false, bytes(""));
        }

        uint256 sweepAmount;
        try this.getSweepableAmount(user) returns (uint256 amount) {
            sweepAmount = amount;
        } catch {
            return (false, bytes(""));
        }

        if (sweepAmount == 0) {
            return (false, bytes(""));
        }

        canExec = true;
        execPayload = abi.encodeWithSelector(
            this.executeSweep.selector,
            user
        );
    }

    function getTimeUntilNextSweep() external view returns (uint256) {
        if (isMonthEnd()) {
            return 0;
        }

        uint256 dayOfMonth = getDayOfMonth();
        uint256 daysInMonth = getDaysInMonth();
        
        uint256 monthEndStartDay = daysInMonth - 2;
        uint256 daysUntilMonthEnd = monthEndStartDay - dayOfMonth;
        
        return daysUntilMonthEnd * 1 days;
    }

    function getLastSweepTimestamp(address user) external view returns (uint256) {
        return _lastSweepTimestamp[user];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}
