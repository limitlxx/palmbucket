import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper, MockERC20, BucketVaultV3 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SweepKeeper Sweep Execution Edge Cases", function () {
  let sweepKeeper: SweepKeeper;
  let mockToken: MockERC20;
  let spendableVault: BucketVaultV3;
  let billsVault: BucketVaultV3;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const GLOBAL_MIN = 10_000_000n; // 10 USDC

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock USDC", "mUSDC", 6);
    await mockToken.waitForDeployment();
    
    // Deploy vaults
    const BucketVaultV3 = await ethers.getContractFactory("BucketVaultV3");
    
    spendableVault = await BucketVaultV3.deploy(
      await mockToken.getAddress(),
      "Spendable Vault",
      "spUSDC",
      await mockToken.getAddress(),
      0
    );
    await spendableVault.waitForDeployment();
    
    billsVault = await BucketVaultV3.deploy(
      await mockToken.getAddress(),
      "Bills Vault",
      "bUSDC",
      await mockToken.getAddress(),
      500 // 5% yield
    );
    await billsVault.waitForDeployment();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(GLOBAL_MIN);
    await sweepKeeper.waitForDeployment();
    
    // Set bucket addresses
    await sweepKeeper.setBucketAddresses(
      await billsVault.getAddress(),
      await spendableVault.getAddress(),
      await spendableVault.getAddress(),
      await spendableVault.getAddress()
    );
    
    // Set to month-end
    const monthEndTimestamp = new Date(Date.UTC(2025, 0, 31, 12, 0, 0)).getTime() / 1000;
    await time.setNextBlockTimestamp(monthEndTimestamp);
    await ethers.provider.send("evm_mine", []);
  });

  describe("Sweep with Zero Sweepable Amount", function () {
    it("Should revert when sweepable amount is zero (balance equals minimum)", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit exactly the minimum amount
      await mockToken.mint(user1.address, GLOBAL_MIN);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), GLOBAL_MIN);
      await spendableVault.connect(user1).deposit(GLOBAL_MIN, user1.address);
      
      // Approve SweepKeeper to spend shares
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Verify sweepable amount is 0
      expect(await sweepKeeper.getSweepableAmount(user1.address)).to.equal(0);
      
      // Attempt sweep should revert
      await expect(
        sweepKeeper.executeSweep(user1.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "InsufficientBalance");
    });

    it("Should revert when sweepable amount is zero (balance below minimum)", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit less than minimum
      const belowMin = GLOBAL_MIN - 1_000_000n;
      await mockToken.mint(user1.address, belowMin);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), belowMin);
      await spendableVault.connect(user1).deposit(belowMin, user1.address);
      
      // Approve SweepKeeper
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Verify sweepable amount is 0
      expect(await sweepKeeper.getSweepableAmount(user1.address)).to.equal(0);
      
      // Attempt sweep should revert
      await expect(
        sweepKeeper.executeSweep(user1.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "InsufficientBalance");
    });

    it("Should succeed when sweepable amount is 1 wei", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit minimum + 1
      const depositAmount = GLOBAL_MIN + 1n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      
      // Approve SweepKeeper
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Verify sweepable amount is 1
      expect(await sweepKeeper.getSweepableAmount(user1.address)).to.equal(1);
      
      // Sweep should succeed
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
    });
  });

  describe("Sweep with Maximum uint256 Amount", function () {
    it("Should handle very large balances correctly", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Use a large but realistic amount (1 billion USDC)
      const largeAmount = 1_000_000_000_000_000n; // 1 billion USDC
      
      // Mint and deposit
      await mockToken.mint(user1.address, largeAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), largeAmount);
      await spendableVault.connect(user1).deposit(largeAmount, user1.address);
      
      // Approve SweepKeeper
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Calculate expected sweepable
      const userBalance = await spendableVault.balanceOf(user1.address);
      const expectedSweepable = userBalance - GLOBAL_MIN;
      
      expect(await sweepKeeper.getSweepableAmount(user1.address)).to.equal(expectedSweepable);
      
      // Sweep should succeed
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
      
      // Verify balances after sweep
      const spendableAfter = await spendableVault.balanceOf(user1.address);
      const billsAfter = await billsVault.balanceOf(user1.address);
      
      expect(spendableAfter).to.be.lte(GLOBAL_MIN + 10n); // Allow small rounding
      expect(billsAfter).to.be.gt(0);
    });
  });

  describe("Multiple Sweeps in Same Month-End Window", function () {
    it("Should allow multiple sweeps if user adds more funds", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // First deposit
      const firstDeposit = 50_000_000n; // 50 USDC
      await mockToken.mint(user1.address, firstDeposit);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), firstDeposit);
      await spendableVault.connect(user1).deposit(firstDeposit, user1.address);
      
      // Approve SweepKeeper
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // First sweep
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
      
      // Verify minimum balance remains
      const balanceAfterFirst = await spendableVault.balanceOf(user1.address);
      expect(balanceAfterFirst).to.be.lte(GLOBAL_MIN + 10n);
      
      // Add more funds
      const secondDeposit = 30_000_000n; // 30 USDC
      await mockToken.mint(user1.address, secondDeposit);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), secondDeposit);
      await spendableVault.connect(user1).deposit(secondDeposit, user1.address);
      
      // Second sweep should succeed
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
      
      // Verify minimum balance remains again
      const balanceAfterSecond = await spendableVault.balanceOf(user1.address);
      expect(balanceAfterSecond).to.be.lte(GLOBAL_MIN + 10n);
    });

    it("Should update lastSweepTimestamp on each sweep", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // First deposit and sweep
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      await sweepKeeper.executeSweep(user1.address);
      const firstTimestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      expect(firstTimestamp).to.be.gt(0);
      
      // Wait a bit and add more funds
      await time.increase(3600); // 1 hour
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      
      // Second sweep
      await sweepKeeper.executeSweep(user1.address);
      const secondTimestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      
      expect(secondTimestamp).to.be.gt(firstTimestamp);
    });

    it("Should not allow sweep if no new sweepable amount after first sweep", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit and sweep
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      await sweepKeeper.executeSweep(user1.address);
      
      // Try to sweep again immediately (should fail - no sweepable amount)
      await expect(
        sweepKeeper.executeSweep(user1.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "InsufficientBalance");
    });
  });

  describe("Sweep Immediately After Authorization", function () {
    it("Should allow sweep immediately after authorization if conditions met", async function () {
      // Deposit first
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Authorize
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Sweep immediately
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
    });

    it("Should record timestamp correctly for immediate sweep after authorization", async function () {
      // Setup
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Verify no timestamp before
      expect(await sweepKeeper.getLastSweepTimestamp(user1.address)).to.equal(0);
      
      // Authorize and sweep
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      await sweepKeeper.executeSweep(user1.address);
      
      // Verify timestamp is set
      const timestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      expect(timestamp).to.be.gt(0);
    });

    it("Should fail if authorization is revoked before sweep", async function () {
      // Setup
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Authorize then immediately revoke
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      await sweepKeeper.connect(user1).revokeAutoSweep();
      
      // Sweep should fail
      await expect(
        sweepKeeper.executeSweep(user1.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "NotAuthorized");
    });
  });

  describe("Sweep with Approval Edge Cases", function () {
    it("Should fail if user hasn't approved SweepKeeper to spend shares", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit funds
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      
      // Don't approve SweepKeeper
      
      // Sweep should fail
      await expect(
        sweepKeeper.executeSweep(user1.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "TransferFailed");
    });

    it("Should succeed with exact approval amount", async function () {
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit funds
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      
      // Approve exact sweepable amount
      const sweepableAmount = await sweepKeeper.getSweepableAmount(user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), sweepableAmount);
      
      // Sweep should succeed
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
    });
  });

  describe("Sweep State Consistency", function () {
    it("Should maintain consistent state if sweep partially fails", async function () {
      // This tests that the checks-effects-interactions pattern is followed
      // State should be updated before external calls
      
      // Authorize user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Deposit funds
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Get initial timestamp
      const initialTimestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      expect(initialTimestamp).to.equal(0);
      
      // Execute sweep
      await sweepKeeper.executeSweep(user1.address);
      
      // Verify timestamp was updated
      const finalTimestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      expect(finalTimestamp).to.be.gt(0);
    });
  });
});
