import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Access Control Tests", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let nonOwner: HardhatEthersSigner;
  let mockBucket: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, nonOwner, mockBucket] = await ethers.getSigners();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000); // 10 USDC minimum
    await sweepKeeper.waitForDeployment();
  });

  describe("setBucketAddresses Access Control", function () {
    it("Should allow owner to set bucket addresses", async function () {
      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          mockBucket.address,
          mockBucket.address,
          mockBucket.address,
          mockBucket.address
        )
      ).to.emit(sweepKeeper, "BucketAddressesUpdated");
    });

    it("Should revert when non-owner tries to set bucket addresses", async function () {
      await expect(
        sweepKeeper.connect(nonOwner).setBucketAddresses(
          mockBucket.address,
          mockBucket.address,
          mockBucket.address,
          mockBucket.address
        )
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });
  });

  describe("setGlobalMinimumBalance Access Control", function () {
    it("Should allow owner to set global minimum balance", async function () {
      await expect(
        sweepKeeper.connect(owner).setGlobalMinimumBalance(20_000_000)
      ).to.emit(sweepKeeper, "GlobalMinimumBalanceUpdated")
        .withArgs(20_000_000);
    });

    it("Should revert when non-owner tries to set global minimum balance", async function () {
      await expect(
        sweepKeeper.connect(nonOwner).setGlobalMinimumBalance(20_000_000)
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });
  });

  describe("pause Access Control", function () {
    it("Should allow owner to pause", async function () {
      await expect(sweepKeeper.connect(owner).pause())
        .to.emit(sweepKeeper, "Paused")
        .withArgs(owner.address);
    });

    it("Should revert when non-owner tries to pause", async function () {
      await expect(
        sweepKeeper.connect(nonOwner).pause()
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });
  });

  describe("unpause Access Control", function () {
    beforeEach(async function () {
      // Pause first
      await sweepKeeper.connect(owner).pause();
    });

    it("Should allow owner to unpause", async function () {
      await expect(sweepKeeper.connect(owner).unpause())
        .to.emit(sweepKeeper, "Unpaused")
        .withArgs(owner.address);
    });

    it("Should revert when non-owner tries to unpause", async function () {
      await expect(
        sweepKeeper.connect(nonOwner).unpause()
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });
  });

  describe("Comprehensive Admin Function Access Control", function () {
    it("Should verify all admin functions have onlyOwner modifier", async function () {
      // Test setBucketAddresses
      await expect(
        sweepKeeper.connect(nonOwner).setBucketAddresses(
          mockBucket.address,
          mockBucket.address,
          mockBucket.address,
          mockBucket.address
        )
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");

      // Test setGlobalMinimumBalance
      await expect(
        sweepKeeper.connect(nonOwner).setGlobalMinimumBalance(20_000_000)
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");

      // Test pause
      await expect(
        sweepKeeper.connect(nonOwner).pause()
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");

      // Pause as owner for unpause test
      await sweepKeeper.connect(owner).pause();

      // Test unpause
      await expect(
        sweepKeeper.connect(nonOwner).unpause()
      ).to.be.revertedWithCustomError(sweepKeeper, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to execute all admin functions", async function () {
      // setBucketAddresses
      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          mockBucket.address,
          mockBucket.address,
          mockBucket.address,
          mockBucket.address
        )
      ).to.not.be.reverted;

      // setGlobalMinimumBalance
      await expect(
        sweepKeeper.connect(owner).setGlobalMinimumBalance(20_000_000)
      ).to.not.be.reverted;

      // pause
      await expect(
        sweepKeeper.connect(owner).pause()
      ).to.not.be.reverted;

      // unpause
      await expect(
        sweepKeeper.connect(owner).unpause()
      ).to.not.be.reverted;
    });
  });
});
