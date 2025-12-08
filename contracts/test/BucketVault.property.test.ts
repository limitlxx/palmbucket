import { expect } from "chai";
import { ethers } from "hardhat";
import { BucketVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as fc from "fast-check";

/**
 * Feature: palmbudget, Property 3: Yield activation on allocation
 * Validates: Requirements 1.3
 * 
 * For any funds allocated to Savings or Growth buckets, the system should immediately
 * deposit them into the corresponding yield protocol and mint vault shares for the user.
 */

describe("BucketVault - Property-Based Tests", function () {
  let bucketVault: BucketVault;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let mockToken: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy a mock ERC20 token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Mock USDC", "USDC", ethers.parseEther("10000000"));
    await mockToken.waitForDeployment();

    // Deploy BucketVault
    const BucketVaultFactory = await ethers.getContractFactory("BucketVault");
    bucketVault = await BucketVaultFactory.deploy(
      await mockToken.getAddress(),
      "Savings Vault",
      "svUSDC"
    );
    await bucketVault.waitForDeployment();

    // Transfer tokens to user (large amount for property testing)
    await mockToken.transfer(user.address, ethers.parseEther("1000000"));
  });

  describe("Property 3: Yield activation on allocation", function () {
    it("should mint vault shares for any deposit amount", async function () {
      this.timeout(60000);

      await fc.assert(
        fc.asyncProperty(
          // Generate deposit amounts (in ether units, reasonable range)
          fc.integer({ min: 1, max: 1000 }).map(n => ethers.parseEther(n.toString())),
          async (depositAmount) => {
            // Setup: Approve vault to spend tokens
            await mockToken.connect(user).approve(await bucketVault.getAddress(), depositAmount);

            // Get initial state
            const initialShares = await bucketVault.balanceOf(user.address);
            const initialAssets = await bucketVault.totalAssets();

            // Execute deposit
            const tx = await bucketVault.connect(user).deposit(depositAmount, user.address);
            await tx.wait();

            // Get final state
            const finalShares = await bucketVault.balanceOf(user.address);
            const finalAssets = await bucketVault.totalAssets();

            // Property 1: Shares should be minted for the user
            expect(finalShares).to.be.gt(initialShares, "Shares should increase after deposit");

            // Property 2: Total assets should increase by deposit amount
            expect(finalAssets - initialAssets).to.equal(
              depositAmount,
              "Total assets should increase by deposit amount"
            );

            // Property 3: User should receive proportional shares
            // For first deposit, shares should equal assets (1:1 ratio)
            if (initialShares === 0n && initialAssets === 0n) {
              expect(finalShares).to.equal(depositAmount, "First deposit should mint 1:1 shares");
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should emit YieldDeposited event when yield is enabled", async function () {
      // Deploy a mock yield protocol
      const MockYieldProtocolFactory = await ethers.getContractFactory("MockYieldProtocol");
      const mockYieldProtocol = await MockYieldProtocolFactory.deploy();
      await mockYieldProtocol.waitForDeployment();

      // Enable yield
      await bucketVault.setYieldProtocol(await mockYieldProtocol.getAddress());

      const depositAmount = ethers.parseEther("100");
      await mockToken.connect(user).approve(await bucketVault.getAddress(), depositAmount);

      // Deposit should emit YieldDeposited event
      await expect(bucketVault.connect(user).deposit(depositAmount, user.address))
        .to.emit(bucketVault, "YieldDeposited");
    });

    it("should handle multiple deposits correctly", async function () {
      const firstDeposit = ethers.parseEther("100");
      const secondDeposit = ethers.parseEther("50");

      // First deposit
      await mockToken.connect(user).approve(await bucketVault.getAddress(), firstDeposit);
      await bucketVault.connect(user).deposit(firstDeposit, user.address);

      const sharesAfterFirst = await bucketVault.balanceOf(user.address);

      // Second deposit
      await mockToken.connect(user).approve(await bucketVault.getAddress(), secondDeposit);
      await bucketVault.connect(user).deposit(secondDeposit, user.address);

      const sharesAfterSecond = await bucketVault.balanceOf(user.address);

      // Shares should increase
      expect(sharesAfterSecond).to.be.gt(sharesAfterFirst);

      // Total assets should equal sum of deposits
      const totalAssets = await bucketVault.totalAssets();
      expect(totalAssets).to.be.gte(firstDeposit + secondDeposit);
    });

    it("should handle edge case: minimum deposit", async function () {
      const minDeposit = 1n; // 1 wei

      await mockToken.connect(user).approve(await bucketVault.getAddress(), minDeposit);
      await bucketVault.connect(user).deposit(minDeposit, user.address);

      const shares = await bucketVault.balanceOf(user.address);
      expect(shares).to.be.gt(0n, "Should mint shares even for minimum deposit");
    });

    it("should handle edge case: large deposit", async function () {
      const largeDeposit = ethers.parseEther("1000");

      await mockToken.connect(user).approve(await bucketVault.getAddress(), largeDeposit);
      await bucketVault.connect(user).deposit(largeDeposit, user.address);

      const shares = await bucketVault.balanceOf(user.address);
      expect(shares).to.equal(largeDeposit, "Should mint correct shares for large deposit");
    });
  });

  describe("Yield Protocol Integration", function () {
    it("should track yield correctly over time", async function () {
      // Deploy and set yield protocol first
      const MockYieldProtocolFactory = await ethers.getContractFactory("MockYieldProtocol");
      const mockYieldProtocol = await MockYieldProtocolFactory.deploy();
      await mockYieldProtocol.waitForDeployment();
      await bucketVault.setYieldProtocol(await mockYieldProtocol.getAddress());

      const depositAmount = ethers.parseEther("1000");

      await mockToken.connect(user).approve(await bucketVault.getAddress(), depositAmount);
      await bucketVault.connect(user).deposit(depositAmount, user.address);

      const initialAssets = await bucketVault.totalAssets();

      // Fast forward time by 30 days
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Compound yield
      await bucketVault.compoundYield();

      const finalAssets = await bucketVault.totalAssets();

      // Assets should have increased due to yield
      expect(finalAssets).to.be.gt(initialAssets, "Assets should increase with yield");
    });

    it("should return correct yield rate", async function () {
      const yieldRate = await bucketVault.getYieldRate();
      expect(yieldRate).to.equal(0); // No yield when protocol not set

      // Deploy and set yield protocol
      const MockYieldProtocolFactory = await ethers.getContractFactory("MockYieldProtocol");
      const mockYieldProtocol = await MockYieldProtocolFactory.deploy();
      await mockYieldProtocol.waitForDeployment();

      await bucketVault.setYieldProtocol(await mockYieldProtocol.getAddress());

      const newYieldRate = await bucketVault.getYieldRate();
      expect(newYieldRate).to.be.gt(0, "Yield rate should be positive when protocol is set");
    });
  });
});
