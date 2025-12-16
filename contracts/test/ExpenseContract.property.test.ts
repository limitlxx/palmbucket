import { expect } from "chai";
import { ethers } from "hardhat";
import { ExpenseContract } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as fc from "fast-check";

/**
 * Feature: expense-management, Property 3: Blockchain Storage Integrity
 * Validates: Requirements 2.1, 2.2, 2.3, 7.3
 * 
 * For any confirmed expense, the system should store essential data on-chain, 
 * emit complete events for querying, and maintain cryptographic proof of data integrity
 */

describe("ExpenseContract - Property-Based Tests", function () {
  let expenseContract: ExpenseContract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy ExpenseContract
    const ExpenseContractFactory = await ethers.getContractFactory("ExpenseContract");
    expenseContract = await ExpenseContractFactory.deploy();
    await expenseContract.waitForDeployment();
  });

  describe("Property 3: Blockchain Storage Integrity", function () {
    it("should store expense data correctly and emit events for any valid expense", async function () {
      this.timeout(60000); // Property tests may take longer

      await fc.assert(
        fc.asyncProperty(
          // Generate valid expense data
          fc.record({
            amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }), // Positive amounts only
            timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) - 60 }), // 2022 to 1 min ago
            merchant: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            category: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
              ethers.hexlify(arr)
            ),
            isBusinessExpense: fc.boolean(),
            businessPercentage: fc.integer({ min: 0, max: 100 })
          }),
          async (expenseData) => {
            // Get initial expense count
            const initialCount = await expenseContract.getUserExpenseCount(user1.address);

            // Log the expense and capture the transaction
            const tx = await expenseContract.connect(user1).logExpense(expenseData);
            const receipt = await tx.wait();

            // Property 1: Expense count should increase by 1
            const finalCount = await expenseContract.getUserExpenseCount(user1.address);
            expect(finalCount).to.equal(initialCount + 1n);

            // Property 2: ExpenseLogged event should be emitted with correct data
            const events = receipt?.logs.filter(log => {
              try {
                const parsed = expenseContract.interface.parseLog({
                  topics: log.topics,
                  data: log.data
                });
                return parsed?.name === "ExpenseLogged";
              } catch {
                return false;
              }
            });

            expect(events).to.have.length(1);
            
            if (events && events.length > 0) {
              const parsedEvent = expenseContract.interface.parseLog({
                topics: events[0].topics,
                data: events[0].data
              });

              expect(parsedEvent?.args.user).to.equal(user1.address);
              expect(parsedEvent?.args.expenseId).to.equal(initialCount);
              expect(parsedEvent?.args.amount).to.equal(expenseData.amount);
              expect(parsedEvent?.args.timestamp).to.equal(expenseData.timestamp);
              expect(parsedEvent?.args.merchant).to.equal(expenseData.merchant);
              expect(parsedEvent?.args.category).to.equal(expenseData.category);
              expect(parsedEvent?.args.receiptHash).to.equal(expenseData.receiptHash);
            }

            // Property 3: Stored expense should match input data exactly
            const storedExpense = await expenseContract.getExpenseById(user1.address, initialCount);
            expect(storedExpense.amount).to.equal(expenseData.amount);
            expect(storedExpense.timestamp).to.equal(expenseData.timestamp);
            expect(storedExpense.merchant).to.equal(expenseData.merchant);
            expect(storedExpense.category).to.equal(expenseData.category);
            expect(storedExpense.receiptHash).to.equal(expenseData.receiptHash);
            expect(storedExpense.isBusinessExpense).to.equal(expenseData.isBusinessExpense);
            expect(storedExpense.businessPercentage).to.equal(expenseData.businessPercentage);

            // Property 4: Expense should appear in getAllExpenses
            const allExpenses = await expenseContract.getAllExpenses(user1.address);
            expect(allExpenses.length).to.equal(Number(finalCount));
            
            const lastExpense = allExpenses[allExpenses.length - 1];
            expect(lastExpense.amount).to.equal(expenseData.amount);
            expect(lastExpense.merchant).to.equal(expenseData.merchant);
            expect(lastExpense.category).to.equal(expenseData.category);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      );
    });

    it("should maintain data integrity across multiple users", async function () {
      this.timeout(60000);

      await fc.assert(
        fc.asyncProperty(
          // Generate expenses for two different users
          fc.tuple(
            fc.record({
              amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }),
              timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) - 60 }),
              merchant: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              category: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 0, max: 100 })
            }),
            fc.record({
              amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }),
              timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) - 60 }),
              merchant: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              category: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 0, max: 100 })
            })
          ),
          async ([expense1, expense2]) => {
            // Log expenses for different users
            await expenseContract.connect(user1).logExpense(expense1);
            await expenseContract.connect(user2).logExpense(expense2);

            // Property: Each user should only see their own expenses
            const user1Expenses = await expenseContract.getAllExpenses(user1.address);
            const user2Expenses = await expenseContract.getAllExpenses(user2.address);

            expect(user1Expenses.length).to.be.greaterThan(0);
            expect(user2Expenses.length).to.be.greaterThan(0);

            // Verify user1's expense
            const user1LastExpense = user1Expenses[user1Expenses.length - 1];
            expect(user1LastExpense.merchant).to.equal(expense1.merchant);
            expect(user1LastExpense.amount).to.equal(expense1.amount);

            // Verify user2's expense
            const user2LastExpense = user2Expenses[user2Expenses.length - 1];
            expect(user2LastExpense.merchant).to.equal(expense2.merchant);
            expect(user2LastExpense.amount).to.equal(expense2.amount);

            // Property: Users should not see each other's expenses
            expect(user1LastExpense.merchant).to.not.equal(user2LastExpense.merchant);
          }
        ),
        { numRuns: 50 } // Reduced runs due to complexity
      );
    });

    it("should reject invalid expense data", async function () {
      this.timeout(60000);

      await fc.assert(
        fc.asyncProperty(
          // Generate invalid expense data
          fc.oneof(
            // Invalid amount (zero)
            fc.record({
              amount: fc.constant(0n),
              timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) }),
              merchant: fc.string({ minLength: 1, maxLength: 100 }),
              category: fc.string({ minLength: 1, maxLength: 50 }),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 0, max: 100 })
            }),
            // Invalid timestamp (future)
            fc.record({
              amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }),
              timestamp: fc.integer({ min: Math.floor(Date.now() / 1000) + 3600, max: Math.floor(Date.now() / 1000) + 86400 }),
              merchant: fc.string({ minLength: 1, maxLength: 100 }),
              category: fc.string({ minLength: 1, maxLength: 50 }),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 0, max: 100 })
            }),
            // Empty merchant
            fc.record({
              amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }),
              timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) - 60 }),
              merchant: fc.constant(""),
              category: fc.string({ minLength: 1, maxLength: 50 }),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 0, max: 100 })
            }),
            // Empty category
            fc.record({
              amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }),
              timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) - 60 }),
              merchant: fc.string({ minLength: 1, maxLength: 100 }),
              category: fc.constant(""),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 0, max: 100 })
            }),
            // Invalid business percentage (> 100)
            fc.record({
              amount: fc.bigInt({ min: 1n, max: ethers.parseEther("1000000") }),
              timestamp: fc.integer({ min: 1640995200, max: Math.floor(Date.now() / 1000) - 60 }),
              merchant: fc.string({ minLength: 1, maxLength: 100 }),
              category: fc.string({ minLength: 1, maxLength: 50 }),
              receiptHash: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(arr => 
                ethers.hexlify(arr)
              ),
              isBusinessExpense: fc.boolean(),
              businessPercentage: fc.integer({ min: 101, max: 255 })
            })
          ),
          async (invalidExpense) => {
            // Property: Invalid expense data should be rejected
            await expect(
              expenseContract.connect(user1).logExpense(invalidExpense)
            ).to.be.reverted;

            // Property: Expense count should not change when invalid data is rejected
            const countBefore = await expenseContract.getUserExpenseCount(user1.address);
            
            try {
              await expenseContract.connect(user1).logExpense(invalidExpense);
            } catch {
              // Expected to fail
            }
            
            const countAfter = await expenseContract.getUserExpenseCount(user1.address);
            expect(countAfter).to.equal(countBefore);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle edge case: zero receipt hash", async function () {
      const invalidExpense = {
        amount: ethers.parseEther("100"),
        timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago to avoid timestamp issues
        merchant: "Test Merchant",
        category: "Test Category",
        receiptHash: ethers.ZeroHash, // Invalid: zero hash
        isBusinessExpense: false,
        businessPercentage: 0
      };

      await expect(
        expenseContract.connect(user1).logExpense(invalidExpense)
      ).to.be.revertedWithCustomError(expenseContract, "InvalidReceiptHash");
    });

    it("should handle edge case: maximum valid values", async function () {
      const maxExpense = {
        amount: ethers.parseEther("1000000"), // Large but reasonable amount
        timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
        merchant: "A".repeat(100), // Max length merchant
        category: "B".repeat(50), // Max length category
        receiptHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
        isBusinessExpense: true,
        businessPercentage: 100
      };

      // Should not revert with maximum valid values
      await expect(
        expenseContract.connect(user1).logExpense(maxExpense)
      ).to.not.be.reverted;

      const storedExpense = await expenseContract.getExpenseById(user1.address, 0);
      expect(storedExpense.amount).to.equal(maxExpense.amount);
      expect(storedExpense.businessPercentage).to.equal(100);
    });

    it("should handle edge case: minimum valid values", async function () {
      const minExpense = {
        amount: 1n, // Minimum positive amount
        timestamp: 1, // Minimum valid timestamp
        merchant: "A", // Minimum length merchant
        category: "B", // Minimum length category
        receiptHash: ethers.keccak256(ethers.toUtf8Bytes("test")),
        isBusinessExpense: false,
        businessPercentage: 0
      };

      // Should not revert with minimum valid values
      await expect(
        expenseContract.connect(user1).logExpense(minExpense)
      ).to.not.be.reverted;

      const storedExpense = await expenseContract.getExpenseById(user1.address, 0);
      expect(storedExpense.amount).to.equal(1n);
      expect(storedExpense.businessPercentage).to.equal(0);
    });
  });
});