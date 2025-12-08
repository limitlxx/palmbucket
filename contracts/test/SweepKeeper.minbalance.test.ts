import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Minimum Balance Tests", function () {
  let sweepKeeper: SweepKeeper;
  let mockToken: MockERC20;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const GLOBAL_MIN = 10_000_000n; // 10 USDC

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy mock token for bucket
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock USDC", "mUSDC", 6);
    await mockToken.waitForDeployment();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(GLOBAL_MIN);
    await sweepKeeper.waitForDeployment();
  });

  describe("Global Minimum Balance", function () {
    it("Should initialize with correct global minimum", async function () {
      const globalMin = await sweepKeeper.globalMinimumBalance();
      expect(globalMin).to.equal(GLOBAL_MIN);
    });

    it("Should allow owner to set global minimum", async function () {
      const newMin = 20_000_000n; // 20 USDC
      
      await expect(sweepKeeper.setGlobalMinimumBalance(newMin))
        .to.emit(sweepKeeper, "GlobalMinimumBalanceUpdated")
        .withArgs(newMin);
      
      const globalMin = await sweepKeeper.globalMinimumBalance();
      expect(globalMin).to.equal(newMin);
    });

    it("Should revert if non-owner tries to set global minimum", async function () {
      const newMin = 20_000_000n;
      
      await expect(
        sweepKeeper.connect(user1).setGlobalMinimumBalance(newMin)
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });

    it("Should revert if global minimum is too large", async function () {
      const tooLarge = 2_000_000_000_000n; // 2 million USDC
      
      await expect(
        sweepKeeper.setGlobalMinimumBalance(tooLarge)
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidMinimumBalance");
    });
  });

  describe("User Minimum Balance", function () {
    it("Should allow user to set custom minimum", async function () {
      const customMin = 50_000_000n; // 50 USDC
      
      await expect(sweepKeeper.connect(user1).setUserMinimumBalance(customMin))
        .to.emit(sweepKeeper, "UserMinimumBalanceUpdated")
        .withArgs(user1.address, customMin);
      
      const userMin = await sweepKeeper.getUserMinimumBalance(user1.address);
      expect(userMin).to.equal(customMin);
    });

    it("Should return global minimum for users without custom minimum", async function () {
      const userMin = await sweepKeeper.getUserMinimumBalance(user1.address);
      expect(userMin).to.equal(GLOBAL_MIN);
    });

    it("Should allow user to update their custom minimum", async function () {
      const firstMin = 30_000_000n;
      const secondMin = 40_000_000n;
      
      await sweepKeeper.connect(user1).setUserMinimumBalance(firstMin);
      let userMin = await sweepKeeper.getUserMinimumBalance(user1.address);
      expect(userMin).to.equal(firstMin);
      
      await sweepKeeper.connect(user1).setUserMinimumBalance(secondMin);
      userMin = await sweepKeeper.getUserMinimumBalance(user1.address);
      expect(userMin).to.equal(secondMin);
    });

    it("Should revert if user minimum is too large", async function () {
      const tooLarge = 2_000_000_000_000n; // 2 million USDC
      
      await expect(
        sweepKeeper.connect(user1).setUserMinimumBalance(tooLarge)
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidMinimumBalance");
    });

    it("Should allow user to set zero as custom minimum", async function () {
      await sweepKeeper.connect(user1).setUserMinimumBalance(0);
      const userMin = await sweepKeeper.getUserMinimumBalance(user1.address);
      expect(userMin).to.equal(0);
    });
  });

  describe("Multiple Users", function () {
    it("Should maintain separate minimums for different users", async function () {
      const user1Min = 25_000_000n;
      const user2Min = 35_000_000n;
      
      await sweepKeeper.connect(user1).setUserMinimumBalance(user1Min);
      await sweepKeeper.connect(user2).setUserMinimumBalance(user2Min);
      
      const actualUser1Min = await sweepKeeper.getUserMinimumBalance(user1.address);
      const actualUser2Min = await sweepKeeper.getUserMinimumBalance(user2.address);
      
      expect(actualUser1Min).to.equal(user1Min);
      expect(actualUser2Min).to.equal(user2Min);
    });

    it("Should not affect other users when one sets custom minimum", async function () {
      await sweepKeeper.connect(user1).setUserMinimumBalance(50_000_000n);
      
      const user2Min = await sweepKeeper.getUserMinimumBalance(user2.address);
      expect(user2Min).to.equal(GLOBAL_MIN);
    });
  });

  describe("Backward Compatibility", function () {
    it("Should keep minimumSpendableBalance in sync with globalMinimumBalance", async function () {
      const newMin = 15_000_000n;
      
      await sweepKeeper.setGlobalMinimumBalance(newMin);
      
      const globalMin = await sweepKeeper.globalMinimumBalance();
      const legacyMin = await sweepKeeper.minimumSpendableBalance();
      
      expect(globalMin).to.equal(newMin);
      expect(legacyMin).to.equal(newMin);
    });
  });
});
