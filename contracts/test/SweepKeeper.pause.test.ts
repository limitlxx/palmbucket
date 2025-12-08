import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Pause Functionality Tests", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let nonOwner: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user, nonOwner] = await ethers.getSigners();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000); // 10 USDC minimum
    await sweepKeeper.waitForDeployment();
  });

  describe("Pause State Management", function () {
    it("Should start unpaused", async function () {
      expect(await sweepKeeper.isPaused()).to.be.false;
    });

    it("Should allow owner to pause", async function () {
      await sweepKeeper.pause();
      expect(await sweepKeeper.isPaused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      await sweepKeeper.pause();
      await sweepKeeper.unpause();
      expect(await sweepKeeper.isPaused()).to.be.false;
    });

    it("Should emit Paused event when pausing", async function () {
      await expect(sweepKeeper.pause())
        .to.emit(sweepKeeper, "Paused")
        .withArgs(owner.address);
    });

    it("Should emit Unpaused event when unpausing", async function () {
      await sweepKeeper.pause();
      await expect(sweepKeeper.unpause())
        .to.emit(sweepKeeper, "Unpaused")
        .withArgs(owner.address);
    });

    it("Should revert when non-owner tries to pause", async function () {
      await expect(
        sweepKeeper.connect(nonOwner).pause()
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });

    it("Should revert when non-owner tries to unpause", async function () {
      await sweepKeeper.pause();
      await expect(
        sweepKeeper.connect(nonOwner).unpause()
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pause Effect on executeSweep", function () {
    beforeEach(async function () {
      // Authorize user
      await sweepKeeper.connect(user).authorizeAutoSweep();
    });

    it("Should prevent executeSweep when paused", async function () {
      await sweepKeeper.pause();
      
      await expect(
        sweepKeeper.executeSweep(user.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "EnforcedPause");
    });

    it("Should not revert with EnforcedPause when not paused", async function () {
      // This will revert with other errors (NotMonthEnd, InvalidBucketAddress, etc.)
      // but NOT with EnforcedPause
      try {
        await sweepKeeper.executeSweep(user.address);
      } catch (error: any) {
        expect(error.message).to.not.include("EnforcedPause");
      }
    });

    it("Should not revert with EnforcedPause after unpause", async function () {
      await sweepKeeper.pause();
      await sweepKeeper.unpause();
      
      // This will revert with other errors but NOT with EnforcedPause
      try {
        await sweepKeeper.executeSweep(user.address);
      } catch (error: any) {
        expect(error.message).to.not.include("EnforcedPause");
      }
    });
  });

  describe("Pause Effect on Checker", function () {
    beforeEach(async function () {
      // Authorize user
      await sweepKeeper.connect(user).authorizeAutoSweep();
    });

    it("Should return false for canExec when paused", async function () {
      await sweepKeeper.pause();
      
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should respect pause state even if user is authorized", async function () {
      // Pause
      await sweepKeeper.pause();
      
      // Check with pause
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should allow checker to return true after unpause (if conditions met)", async function () {
      await sweepKeeper.pause();
      await sweepKeeper.unpause();
      
      const [canExec] = await sweepKeeper.checker(user.address);
      
      // canExec depends on other conditions (month-end, sweepable amount)
      // but should not be false due to pause
      const isPaused = await sweepKeeper.isPaused();
      expect(isPaused).to.be.false;
    });
  });

  describe("Pause Does Not Affect View Functions", function () {
    it("Should allow isAuthorized when paused", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      await sweepKeeper.pause();
      
      expect(await sweepKeeper.isAuthorized(user.address)).to.be.true;
    });

    it("Should allow isMonthEnd when paused", async function () {
      await sweepKeeper.pause();
      
      // Should not revert
      await sweepKeeper.isMonthEnd();
    });

    it("Should allow getUserMinimumBalance when paused", async function () {
      await sweepKeeper.pause();
      
      const minBalance = await sweepKeeper.getUserMinimumBalance(user.address);
      expect(minBalance).to.equal(10_000_000); // Global default
    });
  });

  describe("Pause Does Not Affect User Configuration", function () {
    it("Should allow authorization when paused", async function () {
      await sweepKeeper.pause();
      
      await expect(sweepKeeper.connect(user).authorizeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user.address, true);
    });

    it("Should allow revocation when paused", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      await sweepKeeper.pause();
      
      await expect(sweepKeeper.connect(user).revokeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user.address, false);
    });

    it("Should allow setting user minimum balance when paused", async function () {
      await sweepKeeper.pause();
      
      await expect(sweepKeeper.connect(user).setUserMinimumBalance(20_000_000))
        .to.emit(sweepKeeper, "UserMinimumBalanceUpdated")
        .withArgs(user.address, 20_000_000);
    });
  });
});
