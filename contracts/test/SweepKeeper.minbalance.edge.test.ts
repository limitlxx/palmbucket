import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Minimum Balance Edge Cases", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const GLOBAL_MIN = 10_000_000n; // 10 USDC

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(GLOBAL_MIN);
    await sweepKeeper.waitForDeployment();
  });

  describe("Zero Minimum Balance", function () {
    it("Should allow user to set zero as custom minimum", async function () {
      await expect(sweepKeeper.connect(user1).setUserMinimumBalance(0))
        .to.emit(sweepKeeper, "UserMinimumBalanceUpdated")
        .withArgs(user1.address, 0);
      
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(0);
    });



    it("Should allow owner to set zero as global minimum", async function () {
      await expect(sweepKeeper.setGlobalMinimumBalance(0))
        .to.emit(sweepKeeper, "GlobalMinimumBalanceUpdated")
        .withArgs(0);
      
      expect(await sweepKeeper.globalMinimumBalance()).to.equal(0);
    });
  });

  describe("Very Large Minimum Balance", function () {
    it("Should revert when user sets minimum above 1 million USDC", async function () {
      const tooLarge = 1_000_001_000_000n; // Just over 1 million USDC
      
      await expect(
        sweepKeeper.connect(user1).setUserMinimumBalance(tooLarge)
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidMinimumBalance");
    });

    it("Should revert when owner sets global minimum above 1 million USDC", async function () {
      const tooLarge = 1_000_001_000_000n; // Just over 1 million USDC
      
      await expect(
        sweepKeeper.setGlobalMinimumBalance(tooLarge)
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidMinimumBalance");
    });

    it("Should accept exactly 1 million USDC as maximum", async function () {
      const maxAllowed = 1_000_000_000_000n; // Exactly 1 million USDC
      
      await expect(sweepKeeper.connect(user1).setUserMinimumBalance(maxAllowed))
        .to.emit(sweepKeeper, "UserMinimumBalanceUpdated")
        .withArgs(user1.address, maxAllowed);
      
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(maxAllowed);
    });

    it("Should accept large but valid minimum values", async function () {
      const largeValid = 500_000_000_000n; // 500,000 USDC
      
      await expect(sweepKeeper.connect(user1).setUserMinimumBalance(largeValid))
        .to.emit(sweepKeeper, "UserMinimumBalanceUpdated")
        .withArgs(user1.address, largeValid);
      
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(largeValid);
    });
  });



  describe("Switching Between Custom and Global Minimum", function () {
    it("Should use custom minimum after setting it", async function () {
      const customMin = 25_000_000n; // 25 USDC
      
      // Initially uses global minimum
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(GLOBAL_MIN);
      
      // Set custom minimum
      await sweepKeeper.connect(user1).setUserMinimumBalance(customMin);
      
      // Now uses custom minimum
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(customMin);
    });



    it("Should allow updating custom minimum multiple times", async function () {
      const min1 = 20_000_000n; // 20 USDC
      const min2 = 30_000_000n; // 30 USDC
      const min3 = 15_000_000n; // 15 USDC
      
      // Set first custom minimum
      await sweepKeeper.connect(user1).setUserMinimumBalance(min1);
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(min1);
      
      // Update to second minimum
      await sweepKeeper.connect(user1).setUserMinimumBalance(min2);
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(min2);
      
      // Update to third minimum
      await sweepKeeper.connect(user1).setUserMinimumBalance(min3);
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(min3);
    });

    it("Should not affect other users when one user sets custom minimum", async function () {
      const [, user1, user2, user3] = await ethers.getSigners();
      const customMin = 25_000_000n;
      
      // User1 sets custom minimum
      await sweepKeeper.connect(user1).setUserMinimumBalance(customMin);
      
      // Verify user1 has custom minimum
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(customMin);
      
      // Verify other users still use global minimum
      expect(await sweepKeeper.getUserMinimumBalance(user2.address)).to.equal(GLOBAL_MIN);
      expect(await sweepKeeper.getUserMinimumBalance(user3.address)).to.equal(GLOBAL_MIN);
    });

    it("Should reflect global minimum changes for users without custom minimum", async function () {
      const [, user1, user2] = await ethers.getSigners();
      const newGlobalMin = 15_000_000n;
      const customMin = 25_000_000n;
      
      // User1 sets custom minimum
      await sweepKeeper.connect(user1).setUserMinimumBalance(customMin);
      
      // Owner changes global minimum
      await sweepKeeper.setGlobalMinimumBalance(newGlobalMin);
      
      // User1 still uses custom minimum
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(customMin);
      
      // User2 uses new global minimum
      expect(await sweepKeeper.getUserMinimumBalance(user2.address)).to.equal(newGlobalMin);
    });

    it("Should allow setting custom minimum to same value as global", async function () {
      // Set custom minimum equal to global
      await sweepKeeper.connect(user1).setUserMinimumBalance(GLOBAL_MIN);
      
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(GLOBAL_MIN);
      
      // Change global minimum
      const newGlobalMin = 20_000_000n;
      await sweepKeeper.setGlobalMinimumBalance(newGlobalMin);
      
      // User1 should still use their custom minimum (old global value)
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(GLOBAL_MIN);
      expect(await sweepKeeper.globalMinimumBalance()).to.equal(newGlobalMin);
    });
  });

  describe("Minimum Balance Boundary Conditions", function () {
    it("Should handle minimum of 1 wei", async function () {
      await sweepKeeper.connect(user1).setUserMinimumBalance(1);
      expect(await sweepKeeper.getUserMinimumBalance(user1.address)).to.equal(1);
    });
  });
});
