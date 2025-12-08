import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper - Sweep History Tracking", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const MIN_BALANCE = ethers.parseUnits("10", 6); // 10 USDC

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(MIN_BALANCE);
    await sweepKeeper.waitForDeployment();
  });

  describe("Last Sweep Timestamp", function () {
    it("should return 0 for users who have never been swept", async function () {
      const timestamp = await sweepKeeper.getLastSweepTimestamp(user1.address);
      expect(timestamp).to.equal(0);
    });

    it("should return 0 for different users independently", async function () {
      const timestamp1 = await sweepKeeper.getLastSweepTimestamp(user1.address);
      const timestamp2 = await sweepKeeper.getLastSweepTimestamp(user2.address);
      
      expect(timestamp1).to.equal(0);
      expect(timestamp2).to.equal(0);
    });

    it("should have getLastSweepTimestamp function available", async function () {
      // Verify the function exists and is callable
      expect(sweepKeeper.getLastSweepTimestamp).to.be.a("function");
      
      // Call it with a random address
      const randomAddress = ethers.Wallet.createRandom().address;
      const timestamp = await sweepKeeper.getLastSweepTimestamp(randomAddress);
      expect(timestamp).to.equal(0);
    });
  });
});
