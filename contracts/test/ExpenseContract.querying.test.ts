import { expect } from "chai";
import { ethers } from "hardhat";
import { ExpenseContract } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ExpenseContract - Querying Functions", function () {
  let expenseContract: ExpenseContract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy ExpenseContract
    const ExpenseContractFactory = await ethers.getContractFactory("ExpenseContract");
    expenseContract = await ExpenseContractFactory.deploy();
    await expenseContract.waitForDeployment();

    // Add some test expenses
    const baseTimestamp = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
    
    const expenses = [
      {
        amount: ethers.parseEther("100"),
        timestamp: baseTimestamp,
        merchant: "Grocery Store",
        category: "Food",
        receiptHash: ethers.keccak256(ethers.toUtf8Bytes("receipt1")),
        isBusinessExpense: false,
        businessPercentage: 0
      },
      {
        amount: ethers.parseEther("50"),
        timestamp: baseTimestamp + 3600, // 1 hour later
        merchant: "Gas Station",
        category: "Transportation",
        receiptHash: ethers.keccak256(ethers.toUtf8Bytes("receipt2")),
        isBusinessExpense: true,
        businessPercentage: 100
      },
      {
        amount: ethers.parseEther("200"),
        timestamp: baseTimestamp + 7200, // 2 hours later
        merchant: "Restaurant",
        category: "Food",
        receiptHash: ethers.keccak256(ethers.toUtf8Bytes("receipt3")),
        isBusinessExpense: false,
        businessPercentage: 0
      }
    ];

    for (const expense of expenses) {
      await expenseContract.connect(user).logExpense(expense);
    }
  });

  describe("Pagination Functions", function () {
    it("should paginate expenses by category correctly", async function () {
      // Get first Food expense (offset 0, limit 1)
      const firstFood = await expenseContract.getExpensesByCategoryPaginated(
        user.address, 
        "Food", 
        0, 
        1
      );
      
      expect(firstFood.length).to.equal(1);
      expect(firstFood[0].merchant).to.equal("Grocery Store");

      // Get second Food expense (offset 1, limit 1)
      const secondFood = await expenseContract.getExpensesByCategoryPaginated(
        user.address, 
        "Food", 
        1, 
        1
      );
      
      expect(secondFood.length).to.equal(1);
      expect(secondFood[0].merchant).to.equal("Restaurant");

      // Get all Food expenses (offset 0, limit 10)
      const allFood = await expenseContract.getExpensesByCategoryPaginated(
        user.address, 
        "Food", 
        0, 
        10
      );
      
      expect(allFood.length).to.equal(2);
    });

    it("should paginate expenses by date range correctly", async function () {
      const baseTimestamp = Math.floor(Date.now() / 1000) - 86400;
      
      // Get first expense in range (offset 0, limit 1)
      const firstExpense = await expenseContract.getExpensesByDateRangePaginated(
        user.address,
        baseTimestamp,
        baseTimestamp + 10800, // 3 hours range
        0,
        1
      );
      
      expect(firstExpense.length).to.equal(1);
      expect(firstExpense[0].merchant).to.equal("Grocery Store");

      // Get all expenses in range
      const allExpenses = await expenseContract.getExpensesByDateRangePaginated(
        user.address,
        baseTimestamp,
        baseTimestamp + 10800,
        0,
        10
      );
      
      expect(allExpenses.length).to.equal(3);
    });
  });

  describe("Multi-Filter Function", function () {
    it("should filter expenses by multiple criteria", async function () {
      const baseTimestamp = Math.floor(Date.now() / 1000) - 86400;
      
      // Filter by category only
      const foodExpenses = await expenseContract.getExpensesWithFilters(
        user.address,
        0, // no start date filter
        0, // no end date filter
        "Food",
        0, // no min amount filter
        0  // no max amount filter
      );
      
      expect(foodExpenses.length).to.equal(2);

      // Filter by amount range
      const expensiveExpenses = await expenseContract.getExpensesWithFilters(
        user.address,
        0,
        0,
        "", // no category filter
        ethers.parseEther("75"), // min amount
        0
      );
      
      expect(expensiveExpenses.length).to.equal(2); // $100 and $200 expenses

      // Filter by date and category
      const recentFood = await expenseContract.getExpensesWithFilters(
        user.address,
        baseTimestamp + 3600, // start from 1 hour after first expense
        baseTimestamp + 10800, // end 3 hours after first expense
        "Food",
        0,
        0
      );
      
      expect(recentFood.length).to.equal(1);
      expect(recentFood[0].merchant).to.equal("Restaurant");
    });

    it("should handle empty results for strict filters", async function () {
      // Filter that should return no results
      const noResults = await expenseContract.getExpensesWithFilters(
        user.address,
        0,
        0,
        "NonexistentCategory",
        0,
        0
      );
      
      expect(noResults.length).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle pagination beyond available results", async function () {
      // Try to get results starting from index 10 (beyond available data)
      const beyondResults = await expenseContract.getExpensesByCategoryPaginated(
        user.address,
        "Food",
        10, // offset beyond available data
        5
      );
      
      expect(beyondResults.length).to.equal(0);
    });

    it("should handle zero limit in pagination", async function () {
      const zeroLimit = await expenseContract.getExpensesByCategoryPaginated(
        user.address,
        "Food",
        0,
        0 // zero limit
      );
      
      expect(zeroLimit.length).to.equal(0);
    });

    it("should handle invalid date ranges in filters", async function () {
      await expect(
        expenseContract.getExpensesByDateRangePaginated(
          user.address,
          Math.floor(Date.now() / 1000), // start date after end date
          Math.floor(Date.now() / 1000) - 3600,
          0,
          10
        )
      ).to.be.revertedWithCustomError(expenseContract, "InvalidDateRange");
    });
  });
});