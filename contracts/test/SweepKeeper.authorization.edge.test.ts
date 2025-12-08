import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Authorization Edge Cases", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000); // 10 USDC minimum
    await sweepKeeper.waitForDeployment();
  });

  describe("Double Authorization Attempt", function () {
    it("Should revert when user tries to authorize twice", async function () {
      // First authorization should succeed
      await expect(sweepKeeper.connect(user1).authorizeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, true);
      
      // Verify user is authorized
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      
      // Second authorization should revert
      await expect(
        sweepKeeper.connect(user1).authorizeAutoSweep()
      ).to.be.revertedWithCustomError(sweepKeeper, "AlreadyAuthorized");
    });

    it("Should maintain authorization state after failed double authorization", async function () {
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      try {
        await sweepKeeper.connect(user1).authorizeAutoSweep();
      } catch (error) {
        // Expected to fail
      }
      
      // User should still be authorized
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
    });
  });

  describe("Revoking When Not Authorized", function () {
    it("Should revert when user tries to revoke without being authorized", async function () {
      // Verify user is not authorized
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.false;
      
      // Attempt to revoke should fail
      await expect(
        sweepKeeper.connect(user1).revokeAutoSweep()
      ).to.be.revertedWithCustomError(sweepKeeper, "NotAuthorizedYet");
    });

    it("Should maintain non-authorized state after failed revocation", async function () {
      try {
        await sweepKeeper.connect(user1).revokeAutoSweep();
      } catch (error) {
        // Expected to fail
      }
      
      // User should still not be authorized
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.false;
    });
  });

  describe("Authorization After Revocation", function () {
    it("Should allow user to re-authorize after revocation", async function () {
      // Initial authorization
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      
      // Revoke authorization
      await expect(sweepKeeper.connect(user1).revokeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, false);
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.false;
      
      // Re-authorize
      await expect(sweepKeeper.connect(user1).authorizeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, true);
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
    });

    it("Should allow multiple authorization cycles", async function () {
      // Cycle 1
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      
      await sweepKeeper.connect(user1).revokeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.false;
      
      // Cycle 2
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      
      await sweepKeeper.connect(user1).revokeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.false;
      
      // Cycle 3
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
    });

    it("Should emit correct events during authorization cycles", async function () {
      // Authorize
      await expect(sweepKeeper.connect(user1).authorizeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, true);
      
      // Revoke
      await expect(sweepKeeper.connect(user1).revokeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, false);
      
      // Re-authorize
      await expect(sweepKeeper.connect(user1).authorizeAutoSweep())
        .to.emit(sweepKeeper, "AuthorizationChanged")
        .withArgs(user1.address, true);
    });
  });

  describe("Authorization State Consistency", function () {
    it("Should maintain consistent state across multiple users", async function () {
      const [, user1, user2, user3] = await ethers.getSigners();
      
      // User1 authorizes
      await sweepKeeper.connect(user1).authorizeAutoSweep();
      
      // User2 tries to revoke (should fail)
      await expect(
        sweepKeeper.connect(user2).revokeAutoSweep()
      ).to.be.revertedWithCustomError(sweepKeeper, "NotAuthorizedYet");
      
      // User3 authorizes
      await sweepKeeper.connect(user3).authorizeAutoSweep();
      
      // Verify states
      expect(await sweepKeeper.isAuthorized(user1.address)).to.be.true;
      expect(await sweepKeeper.isAuthorized(user2.address)).to.be.false;
      expect(await sweepKeeper.isAuthorized(user3.address)).to.be.true;
    });
  });
});
