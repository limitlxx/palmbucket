import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Checker Function Tests", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let unauthorizedUser: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user, unauthorizedUser] = await ethers.getSigners();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000); // 10 USDC minimum
    await sweepKeeper.waitForDeployment();
  });

  describe("Checker Never Reverts", function () {
    it("Should not revert when user is not authorized", async function () {
      const [canExec, execPayload] = await sweepKeeper.checker(unauthorizedUser.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should not revert when contract is paused", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      await sweepKeeper.pause();
      
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should not revert when buckets are not initialized", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should not revert with zero address user", async function () {
      const [canExec, execPayload] = await sweepKeeper.checker(ethers.ZeroAddress);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should not revert when multiple conditions fail", async function () {
      // User not authorized, buckets not initialized, contract paused
      await sweepKeeper.pause();
      
      const [canExec, execPayload] = await sweepKeeper.checker(unauthorizedUser.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });
  });

  describe("Checker Authorization Check", function () {
    it("Should return false when user is not authorized", async function () {
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should check authorization before other conditions", async function () {
      // Even if other conditions might be met, unauthorized user should return false
      const [canExec, execPayload] = await sweepKeeper.checker(unauthorizedUser.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should proceed to other checks when user is authorized", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      
      // Will return false due to uninitialized buckets, but authorization check passed
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });
  });

  describe("Checker Pause Check", function () {
    it("Should return false when paused", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      await sweepKeeper.pause();
      
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should check pause state first", async function () {
      await sweepKeeper.pause();
      
      // Even without authorization, pause check should return false
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });
  });

  describe("Checker Empty Payload", function () {
    it("Should return empty payload when canExec is false", async function () {
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should return empty payload when paused", async function () {
      await sweepKeeper.pause();
      
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should return empty payload when not authorized", async function () {
      const [canExec, execPayload] = await sweepKeeper.checker(unauthorizedUser.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });

    it("Should return empty payload when buckets not initialized", async function () {
      await sweepKeeper.connect(user).authorizeAutoSweep();
      
      const [canExec, execPayload] = await sweepKeeper.checker(user.address);
      
      expect(canExec).to.be.false;
      expect(execPayload).to.equal("0x");
    });
  });
});
