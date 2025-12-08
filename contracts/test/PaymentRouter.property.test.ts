import { expect } from "chai";
import { ethers } from "hardhat";
import { PaymentRouter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as fc from "fast-check";

/**
 * Feature: palmbudget, Property 1: Payment split ratio correctness
 * Validates: Requirements 1.1, 7.1
 * 
 * For any incoming payment amount and token type, when the Payment_Router splits the payment,
 * the sum of all bucket allocations should equal the original payment amount, and each bucket
 * should receive exactly its configured percentage.
 */

describe("PaymentRouter - Property-Based Tests", function () {
  let paymentRouter: PaymentRouter;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let bucket1: SignerWithAddress;
  let bucket2: SignerWithAddress;
  let bucket3: SignerWithAddress;
  let bucket4: SignerWithAddress;
  let mockToken: any;

  beforeEach(async function () {
    [owner, user, bucket1, bucket2, bucket3, bucket4] = await ethers.getSigners();

    // Deploy PaymentRouter
    const PaymentRouterFactory = await ethers.getContractFactory("PaymentRouter");
    paymentRouter = await PaymentRouterFactory.deploy();
    await paymentRouter.waitForDeployment();

    // Deploy a mock ERC20 token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Mock Token", "MTK", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();

    // Transfer tokens to user
    await mockToken.transfer(user.address, ethers.parseEther("100000"));
  });

  describe("Property 1: Payment split ratio correctness", function () {
    it("should split payments correctly for any valid ratio configuration and amount", async function () {
      this.timeout(60000); // Property tests may take longer

      await fc.assert(
        fc.asyncProperty(
          // Generate valid split ratios that sum to 100
          fc.tuple(
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 })
          ).chain(([r1, r2, r3]) => {
            const r4 = 100 - r1 - r2 - r3;
            if (r4 < 0 || r4 > 100) {
              // Skip invalid combinations
              return fc.constant([r1, r2, r3, 0] as [number, number, number, number]);
            }
            return fc.constant([r1, r2, r3, r4] as [number, number, number, number]);
          }).filter(([r1, r2, r3, r4]) => r1 + r2 + r3 + r4 === 100),
          // Generate payment amounts (reasonable range in ether, then convert to wei)
          fc.integer({ min: 1, max: 1000 }).map(n => ethers.parseEther(n.toString())),
          async (ratios, amount) => {
            // Setup: Configure user's buckets and ratios
            await paymentRouter.connect(user).setBucketAddresses([
              bucket1.address,
              bucket2.address,
              bucket3.address,
              bucket4.address
            ]);

            await paymentRouter.connect(user).setSplitRatios(ratios);

            // Approve tokens for payment router
            await mockToken.connect(user).approve(await paymentRouter.getAddress(), amount);

            // Get initial balances
            const initialBalances = await Promise.all([
              mockToken.balanceOf(bucket1.address),
              mockToken.balanceOf(bucket2.address),
              mockToken.balanceOf(bucket3.address),
              mockToken.balanceOf(bucket4.address)
            ]);

            // Execute payment routing
            await paymentRouter.connect(user).routePayment(await mockToken.getAddress(), amount);

            // Get final balances
            const finalBalances = await Promise.all([
              mockToken.balanceOf(bucket1.address),
              mockToken.balanceOf(bucket2.address),
              mockToken.balanceOf(bucket3.address),
              mockToken.balanceOf(bucket4.address)
            ]);

            // Calculate received amounts
            const receivedAmounts = finalBalances.map((final, i) => final - initialBalances[i]);

            // Property 1: Sum of all allocations equals original amount
            const totalReceived = receivedAmounts.reduce((sum, amt) => sum + amt, 0n);
            expect(totalReceived).to.equal(amount, "Total received should equal payment amount");

            // Property 2: Each bucket receives its configured percentage (within rounding tolerance)
            for (let i = 0; i < 4; i++) {
              const expectedAmount = (amount * BigInt(ratios[i])) / 100n;
              const tolerance = 1n; // Allow 1 wei tolerance for rounding
              
              expect(receivedAmounts[i]).to.be.closeTo(
                expectedAmount,
                tolerance,
                `Bucket ${i} should receive approximately ${ratios[i]}%`
              );
            }
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      );
    });

    it("should handle edge case: all funds to one bucket", async function () {
      // Setup
      await paymentRouter.connect(user).setBucketAddresses([
        bucket1.address,
        bucket2.address,
        bucket3.address,
        bucket4.address
      ]);

      // All to first bucket
      await paymentRouter.connect(user).setSplitRatios([100, 0, 0, 0]);

      const amount = ethers.parseEther("100");
      await mockToken.connect(user).approve(await paymentRouter.getAddress(), amount);

      const initialBalance = await mockToken.balanceOf(bucket1.address);
      await paymentRouter.connect(user).routePayment(await mockToken.getAddress(), amount);
      const finalBalance = await mockToken.balanceOf(bucket1.address);

      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("should handle edge case: equal split across all buckets", async function () {
      // Setup
      await paymentRouter.connect(user).setBucketAddresses([
        bucket1.address,
        bucket2.address,
        bucket3.address,
        bucket4.address
      ]);

      // Equal split
      await paymentRouter.connect(user).setSplitRatios([25, 25, 25, 25]);

      const amount = ethers.parseEther("100");
      await mockToken.connect(user).approve(await paymentRouter.getAddress(), amount);

      const initialBalances = await Promise.all([
        mockToken.balanceOf(bucket1.address),
        mockToken.balanceOf(bucket2.address),
        mockToken.balanceOf(bucket3.address),
        mockToken.balanceOf(bucket4.address)
      ]);

      await paymentRouter.connect(user).routePayment(await mockToken.getAddress(), amount);

      const finalBalances = await Promise.all([
        mockToken.balanceOf(bucket1.address),
        mockToken.balanceOf(bucket2.address),
        mockToken.balanceOf(bucket3.address),
        mockToken.balanceOf(bucket4.address)
      ]);

      const expectedPerBucket = amount / 4n;
      for (let i = 0; i < 4; i++) {
        expect(finalBalances[i] - initialBalances[i]).to.equal(expectedPerBucket);
      }
    });
  });

  /**
   * Feature: palmbudget, Property 2: Split ratio invariant
   * Validates: Requirements 1.5
   * 
   * For any set of split ratios, the system should accept them if and only if they sum to exactly 100%,
   * and reject any configuration that doesn't meet this constraint.
   */
  describe("Property 2: Split ratio invariant", function () {
    it("should accept any ratio configuration that sums to exactly 100", async function () {
      this.timeout(60000);

      await fc.assert(
        fc.asyncProperty(
          // Generate valid split ratios that sum to 100
          fc.tuple(
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 })
          ).chain(([r1, r2, r3]) => {
            const r4 = 100 - r1 - r2 - r3;
            if (r4 < 0 || r4 > 100) {
              // Skip invalid combinations
              return fc.constant([r1, r2, r3, 0] as [number, number, number, number]);
            }
            return fc.constant([r1, r2, r3, r4] as [number, number, number, number]);
          }).filter(([r1, r2, r3, r4]) => r1 + r2 + r3 + r4 === 100),
          async (ratios) => {
            // Setup: Configure user's buckets first
            await paymentRouter.connect(user).setBucketAddresses([
              bucket1.address,
              bucket2.address,
              bucket3.address,
              bucket4.address
            ]);

            // Property: Any ratios that sum to 100 should be accepted
            await expect(
              paymentRouter.connect(user).setSplitRatios(ratios)
            ).to.not.be.reverted;

            // Verify the ratios were set correctly
            const storedRatios = await paymentRouter.getUserRatios(user.address);
            for (let i = 0; i < 4; i++) {
              expect(storedRatios[i]).to.equal(ratios[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject any ratio configuration that does not sum to 100", async function () {
      this.timeout(60000);

      await fc.assert(
        fc.asyncProperty(
          // Generate invalid split ratios that don't sum to 100
          fc.tuple(
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 100 })
          ).filter(([r1, r2, r3, r4]) => r1 + r2 + r3 + r4 !== 100),
          async (ratios) => {
            // Setup: Configure user's buckets first
            await paymentRouter.connect(user).setBucketAddresses([
              bucket1.address,
              bucket2.address,
              bucket3.address,
              bucket4.address
            ]);

            // Property: Any ratios that don't sum to 100 should be rejected
            await expect(
              paymentRouter.connect(user).setSplitRatios(ratios)
            ).to.be.revertedWithCustomError(paymentRouter, "InvalidRatioSum");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle edge case: ratios summing to 99", async function () {
      await paymentRouter.connect(user).setBucketAddresses([
        bucket1.address,
        bucket2.address,
        bucket3.address,
        bucket4.address
      ]);

      await expect(
        paymentRouter.connect(user).setSplitRatios([25, 25, 25, 24])
      ).to.be.revertedWithCustomError(paymentRouter, "InvalidRatioSum");
    });

    it("should handle edge case: ratios summing to 101", async function () {
      await paymentRouter.connect(user).setBucketAddresses([
        bucket1.address,
        bucket2.address,
        bucket3.address,
        bucket4.address
      ]);

      await expect(
        paymentRouter.connect(user).setSplitRatios([26, 25, 25, 25])
      ).to.be.revertedWithCustomError(paymentRouter, "InvalidRatioSum");
    });
  });
});
