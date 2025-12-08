import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SweepKeeper Time Calculation Tests", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000); // 10 USDC minimum
    await sweepKeeper.waitForDeployment();
  });

  describe("DateTime Library Integration", function () {
    it("Should get current day of month", async function () {
      const day = await sweepKeeper.getDayOfMonth();
      expect(day).to.be.gte(1);
      expect(day).to.be.lte(31);
    });

    it("Should get current month", async function () {
      const month = await sweepKeeper.getMonth();
      expect(month).to.be.gte(1);
      expect(month).to.be.lte(12);
    });

    it("Should get current year", async function () {
      const year = await sweepKeeper.getYear();
      expect(year).to.be.gte(2024);
    });

    it("Should get days in current month", async function () {
      const daysInMonth = await sweepKeeper.getDaysInMonth();
      expect(daysInMonth).to.be.gte(28);
      expect(daysInMonth).to.be.lte(31);
    });
  });

  describe("Month-End Detection", function () {
    it("Should correctly identify month-end status", async function () {
      const isMonthEnd = await sweepKeeper.isMonthEnd();
      const dayOfMonth = await sweepKeeper.getDayOfMonth();
      const daysInMonth = await sweepKeeper.getDaysInMonth();
      
      // Month-end is last 3 days: day >= (daysInMonth - 2)
      const expectedMonthEnd = dayOfMonth >= (daysInMonth - 2n);
      expect(isMonthEnd).to.equal(expectedMonthEnd);
    });
  });

  describe("Time Until Next Sweep", function () {
    it("Should return 0 if currently in month-end window", async function () {
      const isMonthEnd = await sweepKeeper.isMonthEnd();
      const timeUntilNextSweep = await sweepKeeper.getTimeUntilNextSweep();
      
      if (isMonthEnd) {
        expect(timeUntilNextSweep).to.equal(0);
      }
    });

    it("Should return positive value if not in month-end window", async function () {
      const isMonthEnd = await sweepKeeper.isMonthEnd();
      const timeUntilNextSweep = await sweepKeeper.getTimeUntilNextSweep();
      
      if (!isMonthEnd) {
        expect(timeUntilNextSweep).to.be.gt(0);
      }
    });

    it("Should calculate correct days until month-end", async function () {
      const isMonthEnd = await sweepKeeper.isMonthEnd();
      
      if (!isMonthEnd) {
        const dayOfMonth = await sweepKeeper.getDayOfMonth();
        const daysInMonth = await sweepKeeper.getDaysInMonth();
        const timeUntilNextSweep = await sweepKeeper.getTimeUntilNextSweep();
        
        // Month-end starts at day (daysInMonth - 2)
        const monthEndStartDay = daysInMonth - 2n;
        const expectedDays = monthEndStartDay - dayOfMonth;
        const expectedSeconds = expectedDays * 86400n;
        
        expect(timeUntilNextSweep).to.equal(expectedSeconds);
      }
    });
  });
});
