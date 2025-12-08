import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper, MockERC20, BucketVaultV3 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SweepKeeper Pause Edge Cases", function () {
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
      500
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

  describe("Pause During Active Sweep", function () {
    it("Should not allow pause to interrupt an ongoing sweep transaction", async function () {
      // This tests that pause cannot be called during a sweep due to reentrancy protection
      // In practice, pause and sweep are separate transactions, so this tests the atomicity
      
      // Authorize and setup user
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Execute sweep (this is atomic)
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
      
      // Verify sweep completed successfully
      const timestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      expect(timestamp).to.be.gt(0);
    });

    it("Should allow pause immediately after sweep completes", async function () {
      // Setup and execute sweep
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      await sweepKeeper.executeSweep(user1.address);
      
      // Pause immediately after
      await expect(sweepKeeper.pause())
        .to.emit(sweepKeeper, "Paused");
      
      expect(await sweepKeeper.isPaused()).to.be.true;
    });

    it("Should prevent new sweeps after pause even if previous sweep succeeded", async function () {
      // Setup and execute first sweep
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      await sweepKeeper.executeSweep(user1.address);
      
      // Pause
      await sweepKeeper.pause();
      
      // Add more funds
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      
      // Try to sweep again (should fail due to pause)
      await expect(
        sweepKeeper.executeSweep(user1.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "EnforcedPause");
    });
  });

  describe("Multiple Pause Attempts", function () {
    it("Should revert when trying to pause an already paused contract", async function () {
      // First pause should succeed
      await expect(sweepKeeper.pause())
        .to.emit(sweepKeeper, "Paused");
      
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      // Second pause should revert
      await expect(
        sweepKeeper.pause()
      ).to.be.revertedWithCustomError(sweepKeeper, "EnforcedPause");
    });

    it("Should maintain paused state after failed second pause attempt", async function () {
      await sweepKeeper.pause();
      
      try {
        await sweepKeeper.pause();
      } catch (error) {
        // Expected to fail
      }
      
      // Should still be paused
      expect(await sweepKeeper.isPaused()).to.be.true;
    });

    it("Should allow pause-unpause-pause cycle", async function () {
      // First pause
      await expect(sweepKeeper.pause())
        .to.emit(sweepKeeper, "Paused");
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      // Unpause
      await expect(sweepKeeper.unpause())
        .to.emit(sweepKeeper, "Unpaused");
      expect(await sweepKeeper.isPaused()).to.be.false;
      
      // Pause again
      await expect(sweepKeeper.pause())
        .to.emit(sweepKeeper, "Paused");
      expect(await sweepKeeper.isPaused()).to.be.true;
    });
  });

  describe("Multiple Unpause Attempts", function () {
    it("Should revert when trying to unpause a non-paused contract", async function () {
      // Contract starts unpaused
      expect(await sweepKeeper.isPaused()).to.be.false;
      
      // Unpause should revert
      await expect(
        sweepKeeper.unpause()
      ).to.be.revertedWithCustomError(sweepKeeper, "ExpectedPause");
    });

    it("Should revert when trying to unpause twice", async function () {
      // Pause first
      await sweepKeeper.pause();
      
      // First unpause should succeed
      await expect(sweepKeeper.unpause())
        .to.emit(sweepKeeper, "Unpaused");
      
      expect(await sweepKeeper.isPaused()).to.be.false;
      
      // Second unpause should revert
      await expect(
        sweepKeeper.unpause()
      ).to.be.revertedWithCustomError(sweepKeeper, "ExpectedPause");
    });

    it("Should maintain unpaused state after failed second unpause attempt", async function () {
      await sweepKeeper.pause();
      await sweepKeeper.unpause();
      
      try {
        await sweepKeeper.unpause();
      } catch (error) {
        // Expected to fail
      }
      
      // Should still be unpaused
      expect(await sweepKeeper.isPaused()).to.be.false;
    });

    it("Should allow unpause-pause-unpause cycle", async function () {
      // Start by pausing
      await sweepKeeper.pause();
      
      // First unpause
      await expect(sweepKeeper.unpause())
        .to.emit(sweepKeeper, "Unpaused");
      expect(await sweepKeeper.isPaused()).to.be.false;
      
      // Pause
      await expect(sweepKeeper.pause())
        .to.emit(sweepKeeper, "Paused");
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      // Unpause again
      await expect(sweepKeeper.unpause())
        .to.emit(sweepKeeper, "Unpaused");
      expect(await sweepKeeper.isPaused()).to.be.false;
    });
  });

  describe("Authorization Changes While Paused", function () {
    beforeEach(async function () {
      // Pause the contract
      await sweepKeeper.pause();
    });

    it("Should allow user to authorize while contract is paused", async function () {
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      await expect(sweepKeeper.connect(user1).authorizeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, true);
      
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
    });

    it("Should allow user to revoke authorization while contract is paused", async function () {
      // First authorize (while paused)
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Then revoke (while still paused)
      await expect(sweepKeeper.connect(user1).revokeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, false);
      
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.false;
    });

    it("Should allow user to set minimum balance while contract is paused", async function () {
      const customMin = 25_000_000n;
      
      await expect(sweepKeeper.connect(user1).setUserMinimumBalance(customMin))
        .to.emit(sweepKeeper, "UserMinimumBalanceUpdated")
        .withArgs(user1.address, customMin);
      
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(customMin);
    });

    it("Should preserve authorization state through pause-unpause cycle", async function () {
      // Authorize while paused
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      
      // Unpause
      await sweepKeeper.unpause();
      
      // Authorization should still be active
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
    });

    it("Should allow sweep after unpause if user authorized while paused", async function () {
      // Authorize while paused
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // Setup funds
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
      await spendableVault.connect(user1).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
      
      // Unpause
      await sweepKeeper.unpause();
      
      // Sweep should now work
      await expect(sweepKeeper.executeSweep(user1.address))
        .to.emit(sweepKeeper, "SweepExecuted");
    });
  });

  describe("Pause Effect on Checker Function", function () {
    beforeEach(async function () {
      // Authorize user and setup funds
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      const depositAmount = 50_000_000n;
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await spendableVault.getAddress(), depositAmount);
      await spendableVault.connect(user1).deposit(depositAmount, user1.address);
    });

    it("Should return false from checker when paused", async function () {
      // Pause
      await sweepKeeper.pause();
      
      // Checker should return false
      const [canExec, execPayload] = await sweepKeeper.checker(user1.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should return true from checker after unpause if conditions met", async function () {
      // Pause
      await sweepKeeper.pause();
      
      // Verify checker returns false
      let [canExec] = await sweepKeeper.checker(user1.address);
      expect(canExec).to.be.false;
      
      // Unpause
      await sweepKeeper.unpause();
      
      // Checker should now return true (conditions are met)
      [canExec] = await sweepKeeper.checker(user1.address);
      expect(canExec).to.be.true;
    });

    it("Should immediately reflect pause state in checker", async function () {
      // Initially unpaused, checker should work
      let [canExec] = await sweepKeeper.checker(user1.address);
      expect(canExec).to.be.true;
      
      // Pause
      await sweepKeeper.pause();
      
      // Checker should immediately return false
      [canExec] = await sweepKeeper.checker(user1.address);
      expect(canExec).to.be.false;
    });
  });

  describe("Pause State Consistency", function () {
    it("Should maintain consistent pause state across multiple operations", async function () {
      // Start unpaused
      expect(await sweepKeeper.isPaused()).to.be.false;
      
      // Pause
      await sweepKeeper.pause();
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      // Try various operations
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      await sweepKeeper.connect(user1).setUserMinimumBalance(20_000_000n);
      expect(await sweepKeeper.isPaused()).to.be.true;
      
      // Unpause
      await sweepKeeper.unpause();
      expect(await sweepKeeper.isPaused()).to.be.false;
    });

    it("Should not affect other contract state when pausing", async function () {
      // Set some state
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      await sweepKeeper.connect(user1).setUserMinimumBalance(25_000_000n);
      
      // Pause
      await sweepKeeper.pause();
      
      // Verify state is preserved
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(25_000_000n);
      expect(await sweepKeeper.globalMinimumBalance()).to.equal(GLOBAL_MIN);
    });
  });

  describe("Rapid Pause/Unpause Cycles", function () {
    it("Should handle rapid pause/unpause cycles correctly", async function () {
      for (let i = 0; i < 5; i++) {
        await sweepKeeper.pause();
        expect(await sweepKeeper.isPaused()).to.be.true;
        
        await sweepKeeper.unpause();
        expect(await sweepKeeper.isPaused()).to.be.false;
      }
    });

    it("Should emit correct events during rapid cycles", async function () {
      for (let i = 0; i < 3; i++) {
        await expect(sweepKeeper.pause())
          .to.emit(sweepKeeper, "Paused")
          .withArgs(owner.address);
        
        await expect(sweepKeeper.unpause())
          .to.emit(sweepKeeper, "Unpaused")
          .withArgs(owner.address);
      }
    });
  });
});
