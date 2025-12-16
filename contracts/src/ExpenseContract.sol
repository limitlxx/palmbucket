// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ExpenseContract
 * @notice Stores expense records on-chain with immutable audit trails and efficient querying
 * @dev Implements expense logging with events for off-chain indexing and comprehensive query functions
 */
contract ExpenseContract is Ownable, ReentrancyGuard {
    // Custom errors for gas efficiency
    error InvalidAmount();
    error InvalidTimestamp();
    error EmptyMerchant();
    error EmptyCategory();
    error InvalidReceiptHash();
    error InvalidBusinessPercentage();
    error ExpenseNotFound();
    error InvalidDateRange();
    error Unauthorized();

    // Expense record structure
    struct ExpenseRecord {
        uint256 amount;
        uint256 timestamp;
        string merchant;
        string category;
        bytes32 receiptHash;
        bool isBusinessExpense;
        uint8 businessPercentage;
    }

    // Storage
    mapping(address => ExpenseRecord[]) private userExpenses;
    mapping(address => uint256) public userExpenseCount;
    
    // Events
    event ExpenseLogged(
        address indexed user,
        uint256 indexed expenseId,
        uint256 amount,
        uint256 timestamp,
        string merchant,
        string category,
        bytes32 receiptHash
    );

    event ExpenseUpdated(
        address indexed user,
        uint256 indexed expenseId,
        string field,
        string oldValue,
        string newValue
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Log a new expense record
     * @param expense The expense record to log
     * @dev Validates all fields and emits ExpenseLogged event
     */
    function logExpense(ExpenseRecord calldata expense) external nonReentrant {
        // Input validation
        if (expense.amount == 0) {
            revert InvalidAmount();
        }
        if (expense.timestamp == 0 || expense.timestamp > block.timestamp) {
            revert InvalidTimestamp();
        }
        if (bytes(expense.merchant).length == 0) {
            revert EmptyMerchant();
        }
        if (bytes(expense.category).length == 0) {
            revert EmptyCategory();
        }
        if (expense.receiptHash == bytes32(0)) {
            revert InvalidReceiptHash();
        }
        if (expense.businessPercentage > 100) {
            revert InvalidBusinessPercentage();
        }

        // Store expense
        uint256 expenseId = userExpenseCount[msg.sender];
        userExpenses[msg.sender].push(expense);
        userExpenseCount[msg.sender]++;

        // Emit event for off-chain indexing
        emit ExpenseLogged(
            msg.sender,
            expenseId,
            expense.amount,
            expense.timestamp,
            expense.merchant,
            expense.category,
            expense.receiptHash
        );
    }

    /**
     * @notice Get expenses by date range
     * @param user The user address
     * @param startDate Start timestamp (inclusive)
     * @param endDate End timestamp (inclusive)
     * @return Array of expense records within the date range
     */
    function getExpensesByDateRange(
        address user,
        uint256 startDate,
        uint256 endDate
    ) external view returns (ExpenseRecord[] memory) {
        if (startDate > endDate) {
            revert InvalidDateRange();
        }

        ExpenseRecord[] storage allExpenses = userExpenses[user];
        uint256 count = 0;

        // First pass: count matching expenses
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (allExpenses[i].timestamp >= startDate && allExpenses[i].timestamp <= endDate) {
                count++;
            }
        }

        // Second pass: collect matching expenses
        ExpenseRecord[] memory result = new ExpenseRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (allExpenses[i].timestamp >= startDate && allExpenses[i].timestamp <= endDate) {
                result[index] = allExpenses[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Get expenses by category
     * @param user The user address
     * @param category The category to filter by
     * @return Array of expense records in the specified category
     */
    function getExpensesByCategory(
        address user,
        string calldata category
    ) external view returns (ExpenseRecord[] memory) {
        if (bytes(category).length == 0) {
            revert EmptyCategory();
        }

        ExpenseRecord[] storage allExpenses = userExpenses[user];
        uint256 count = 0;

        // First pass: count matching expenses
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (keccak256(bytes(allExpenses[i].category)) == keccak256(bytes(category))) {
                count++;
            }
        }

        // Second pass: collect matching expenses
        ExpenseRecord[] memory result = new ExpenseRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (keccak256(bytes(allExpenses[i].category)) == keccak256(bytes(category))) {
                result[index] = allExpenses[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Get total spending by category within a date range
     * @param user The user address
     * @param startDate Start timestamp (inclusive)
     * @param endDate End timestamp (inclusive)
     * @return categories Array of unique categories
     * @return amounts Array of total amounts per category
     */
    function getTotalSpendingByCategory(
        address user,
        uint256 startDate,
        uint256 endDate
    ) external view returns (string[] memory categories, uint256[] memory amounts) {
        if (startDate > endDate) {
            revert InvalidDateRange();
        }

        ExpenseRecord[] storage allExpenses = userExpenses[user];
        
        // Temporary arrays to collect unique categories and their totals
        string[] memory tempCategories = new string[](allExpenses.length);
        uint256[] memory tempAmounts = new uint256[](allExpenses.length);
        uint256 uniqueCount = 0;

        // Process each expense in the date range
        for (uint256 i = 0; i < allExpenses.length; i++) {
            ExpenseRecord storage expense = allExpenses[i];
            
            if (expense.timestamp >= startDate && expense.timestamp <= endDate) {
                // Find if category already exists
                bool found = false;
                for (uint256 j = 0; j < uniqueCount; j++) {
                    if (keccak256(bytes(tempCategories[j])) == keccak256(bytes(expense.category))) {
                        tempAmounts[j] += expense.amount;
                        found = true;
                        break;
                    }
                }
                
                // If category not found, add it
                if (!found) {
                    tempCategories[uniqueCount] = expense.category;
                    tempAmounts[uniqueCount] = expense.amount;
                    uniqueCount++;
                }
            }
        }

        // Create result arrays with exact size
        categories = new string[](uniqueCount);
        amounts = new uint256[](uniqueCount);
        
        for (uint256 i = 0; i < uniqueCount; i++) {
            categories[i] = tempCategories[i];
            amounts[i] = tempAmounts[i];
        }

        return (categories, amounts);
    }

    /**
     * @notice Get a specific expense by ID
     * @param user The user address
     * @param expenseId The expense ID
     * @return The expense record
     */
    function getExpenseById(
        address user,
        uint256 expenseId
    ) external view returns (ExpenseRecord memory) {
        if (expenseId >= userExpenses[user].length) {
            revert ExpenseNotFound();
        }
        return userExpenses[user][expenseId];
    }

    /**
     * @notice Get all expenses for a user
     * @param user The user address
     * @return Array of all expense records for the user
     */
    function getAllExpenses(address user) external view returns (ExpenseRecord[] memory) {
        return userExpenses[user];
    }

    /**
     * @notice Get user's expense count
     * @param user The user address
     * @return Total number of expenses for the user
     */
    function getUserExpenseCount(address user) external view returns (uint256) {
        return userExpenseCount[user];
    }

    /**
     * @notice Search expenses by merchant name (partial match)
     * @param user The user address
     * @param merchantQuery The merchant name to search for
     * @return Array of expense records matching the merchant query
     */
    function searchExpensesByMerchant(
        address user,
        string calldata merchantQuery
    ) external view returns (ExpenseRecord[] memory) {
        if (bytes(merchantQuery).length == 0) {
            revert EmptyMerchant();
        }

        ExpenseRecord[] storage allExpenses = userExpenses[user];
        uint256 count = 0;

        // First pass: count matching expenses
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (_containsString(allExpenses[i].merchant, merchantQuery)) {
                count++;
            }
        }

        // Second pass: collect matching expenses
        ExpenseRecord[] memory result = new ExpenseRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (_containsString(allExpenses[i].merchant, merchantQuery)) {
                result[index] = allExpenses[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Get expenses by category with pagination support
     * @param user The user address
     * @param category The category to filter by
     * @param offset Starting index for pagination
     * @param limit Maximum number of results to return
     * @return Array of expense records in the specified category
     */
    function getExpensesByCategoryPaginated(
        address user,
        string calldata category,
        uint256 offset,
        uint256 limit
    ) external view returns (ExpenseRecord[] memory) {
        if (bytes(category).length == 0) {
            revert EmptyCategory();
        }

        ExpenseRecord[] storage allExpenses = userExpenses[user];
        uint256 matchCount = 0;
        uint256 returnCount = 0;

        // First pass: count total matching expenses and determine return count
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (keccak256(bytes(allExpenses[i].category)) == keccak256(bytes(category))) {
                if (matchCount >= offset && returnCount < limit) {
                    returnCount++;
                }
                matchCount++;
            }
        }

        // Second pass: collect paginated results
        ExpenseRecord[] memory result = new ExpenseRecord[](returnCount);
        uint256 currentMatch = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < allExpenses.length && resultIndex < returnCount; i++) {
            if (keccak256(bytes(allExpenses[i].category)) == keccak256(bytes(category))) {
                if (currentMatch >= offset) {
                    result[resultIndex] = allExpenses[i];
                    resultIndex++;
                }
                currentMatch++;
            }
        }

        return result;
    }

    /**
     * @notice Get expenses by date range with pagination support
     * @param user The user address
     * @param startDate Start timestamp (inclusive)
     * @param endDate End timestamp (inclusive)
     * @param offset Starting index for pagination
     * @param limit Maximum number of results to return
     * @return Array of expense records within the date range
     */
    function getExpensesByDateRangePaginated(
        address user,
        uint256 startDate,
        uint256 endDate,
        uint256 offset,
        uint256 limit
    ) external view returns (ExpenseRecord[] memory) {
        if (startDate > endDate) {
            revert InvalidDateRange();
        }

        ExpenseRecord[] storage allExpenses = userExpenses[user];
        uint256 matchCount = 0;
        uint256 returnCount = 0;

        // First pass: count total matching expenses and determine return count
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (allExpenses[i].timestamp >= startDate && allExpenses[i].timestamp <= endDate) {
                if (matchCount >= offset && returnCount < limit) {
                    returnCount++;
                }
                matchCount++;
            }
        }

        // Second pass: collect paginated results
        ExpenseRecord[] memory result = new ExpenseRecord[](returnCount);
        uint256 currentMatch = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < allExpenses.length && resultIndex < returnCount; i++) {
            if (allExpenses[i].timestamp >= startDate && allExpenses[i].timestamp <= endDate) {
                if (currentMatch >= offset) {
                    result[resultIndex] = allExpenses[i];
                    resultIndex++;
                }
                currentMatch++;
            }
        }

        return result;
    }

    /**
     * @notice Get expenses with multiple filters applied
     * @param user The user address
     * @param startDate Start timestamp (inclusive, 0 to ignore)
     * @param endDate End timestamp (inclusive, 0 to ignore)
     * @param category Category filter (empty string to ignore)
     * @param minAmount Minimum amount filter (0 to ignore)
     * @param maxAmount Maximum amount filter (0 to ignore)
     * @return Array of expense records matching all filters
     */
    function getExpensesWithFilters(
        address user,
        uint256 startDate,
        uint256 endDate,
        string calldata category,
        uint256 minAmount,
        uint256 maxAmount
    ) external view returns (ExpenseRecord[] memory) {
        ExpenseRecord[] storage allExpenses = userExpenses[user];
        uint256 count = 0;

        // First pass: count matching expenses
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (_matchesFilters(allExpenses[i], startDate, endDate, category, minAmount, maxAmount)) {
                count++;
            }
        }

        // Second pass: collect matching expenses
        ExpenseRecord[] memory result = new ExpenseRecord[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allExpenses.length; i++) {
            if (_matchesFilters(allExpenses[i], startDate, endDate, category, minAmount, maxAmount)) {
                result[index] = allExpenses[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Helper function to check if an expense matches all provided filters
     * @param expense The expense to check
     * @param startDate Start timestamp filter (0 to ignore)
     * @param endDate End timestamp filter (0 to ignore)
     * @param category Category filter (empty string to ignore)
     * @param minAmount Minimum amount filter (0 to ignore)
     * @param maxAmount Maximum amount filter (0 to ignore)
     * @return True if expense matches all filters
     */
    function _matchesFilters(
        ExpenseRecord storage expense,
        uint256 startDate,
        uint256 endDate,
        string calldata category,
        uint256 minAmount,
        uint256 maxAmount
    ) private view returns (bool) {
        // Date range filter
        if (startDate > 0 && expense.timestamp < startDate) {
            return false;
        }
        if (endDate > 0 && expense.timestamp > endDate) {
            return false;
        }

        // Category filter
        if (bytes(category).length > 0) {
            if (keccak256(bytes(expense.category)) != keccak256(bytes(category))) {
                return false;
            }
        }

        // Amount range filter
        if (minAmount > 0 && expense.amount < minAmount) {
            return false;
        }
        if (maxAmount > 0 && expense.amount > maxAmount) {
            return false;
        }

        return true;
    }

    /**
     * @notice Helper function to check if a string contains a substring (case-insensitive)
     * @param source The source string
     * @param query The query string to search for
     * @return True if source contains query
     */
    function _containsString(string memory source, string memory query) private pure returns (bool) {
        bytes memory sourceBytes = bytes(source);
        bytes memory queryBytes = bytes(query);
        
        if (queryBytes.length > sourceBytes.length) {
            return false;
        }
        
        if (queryBytes.length == 0) {
            return true;
        }

        // Simple substring search (case-sensitive for now)
        for (uint256 i = 0; i <= sourceBytes.length - queryBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < queryBytes.length; j++) {
                if (sourceBytes[i + j] != queryBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }
        
        return false;
    }
}