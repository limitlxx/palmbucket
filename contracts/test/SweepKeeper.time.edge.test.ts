import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SweepKeeper Time Calculation Edge Cases", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000);
    await sweepKeeper.waitForDeployment();
  });

  describe("All 12 Months", function () {
    const monthTests = [
      { month: 1, name: "January", days: 31, monthEndDays: [29, 30, 31] },
      { month: 2, name: "February (non-leap)", days: 28, monthEndDays: [26, 27, 28] },
      { month: 3, name: "March", days: 31, monthEndDays: [29, 30, 31] },
      { month: 4, name: "April", days: 30, monthEndDays: [28, 29, 30] },
      { month: 5, name: "May", days: 31, monthEndDays: [29, 30, 31] },
      { month: 6, name: "June", days: 30, monthEndDays: [28, 29, 30] },
      { month: 7, name: "July", days: 31, monthEndDays: [29, 30, 31] },
      { month: 8, name: "August", days: 31, monthEndDays: [29, 30, 31] },
      { month: 9, name: "September", days: 30, monthEndDays: [28, 29, 30] },
      { month: 10, name: "October", days: 31, monthEndDays: [29, 30, 31] },
      { month: 11, name: "November", days: 30, monthEndDays: [28, 29, 30] },
      { month: 12, name: "December", days: 31, monthEndDays: [29, 30, 31] }
    ];

    monthTests.forEach(({ month, name, days, monthEndDays }) => {
      it(`Should correctly identify month-end for ${name}`, async function () {
        // Use 2026 for non-leap year February (future date)
        const year = 2026;
        
        // Test a non-month-end day (day 15)
        const midMonthTimestamp = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(midMonthTimestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.false;
        expect(await sweepKeeper.getDaysInMonth()).to.equal(days);
        
        // Test month-end days
        for (const day of monthEndDays) {
          const monthEndTimestamp = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getTime() / 1000;
          await time.increaseTo(monthEndTimestamp);
          await ethers.provider.send("evm_mine", []);
          
          expect(await sweepKeeper.isMonthEnd()).to.be.true;
          expect(await sweepKeeper.getDayOfMonth()).to.equal(day);
        }
      });
    });
  });

  describe("Leap Year February (29 days)", function () {
    it("Should correctly handle leap year February with 29 days", async function () {
      // 2024 is a leap year
      const year = 2024;
      const month = 2; // February
      
      // Test mid-month (not month-end)
      const midMonthTimestamp = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)).getTime() / 1000;
      await time.increaseTo(midMonthTimestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
      expect(await sweepKeeper.getDaysInMonth()).to.equal(29);
      
      // Test last 3 days: 27, 28, 29
      const monthEndDays = [27, 28, 29];
      for (const day of monthEndDays) {
        const timestamp = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(timestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.true;
        expect(await sweepKeeper.getDayOfMonth()).to.equal(day);
      }
      
      // Verify day 26 is NOT month-end
      const day26Timestamp = new Date(Date.UTC(year, month - 1, 26, 12, 0, 0)).getTime() / 1000;
      await time.increaseTo(day26Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
    });
  });

  describe("Non-Leap Year February (28 days)", function () {
    it("Should correctly handle non-leap year February with 28 days", async function () {
      // 2026 is not a leap year
      const year = 2026;
      const month = 2; // February
      
      // Test mid-month (not month-end)
      const midMonthTimestamp = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)).getTime() / 1000;
      await time.increaseTo(midMonthTimestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
      expect(await sweepKeeper.getDaysInMonth()).to.equal(28);
      
      // Test last 3 days: 26, 27, 28
      const monthEndDays = [26, 27, 28];
      for (const day of monthEndDays) {
        const timestamp = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(timestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.true;
        expect(await sweepKeeper.getDayOfMonth()).to.equal(day);
      }
      
      // Verify day 25 is NOT month-end
      const day25Timestamp = new Date(Date.UTC(year, month - 1, 25, 12, 0, 0)).getTime() / 1000;
      await time.increaseTo(day25Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
    });
  });

  describe("30-Day Months", function () {
    const thirtyDayMonths = [
      { month: 4, name: "April" },
      { month: 6, name: "June" },
      { month: 9, name: "September" },
      { month: 11, name: "November" }
    ];

    thirtyDayMonths.forEach(({ month, name }) => {
      it(`Should correctly handle ${name} with 30 days`, async function () {
        const year = 2026;
        
        // Test mid-month
        const midMonthTimestamp = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(midMonthTimestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.false;
        expect(await sweepKeeper.getDaysInMonth()).to.equal(30);
        
        // Test last 3 days: 28, 29, 30
        const monthEndDays = [28, 29, 30];
        for (const day of monthEndDays) {
          const timestamp = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getTime() / 1000;
          await time.increaseTo(timestamp);
          await ethers.provider.send("evm_mine", []);
          
          expect(await sweepKeeper.isMonthEnd()).to.be.true;
          expect(await sweepKeeper.getDayOfMonth()).to.equal(day);
        }
        
        // Verify day 27 is NOT month-end
        const day27Timestamp = new Date(Date.UTC(year, month - 1, 27, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(day27Timestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.false;
      });
    });
  });

  describe("31-Day Months", function () {
    const thirtyOneDayMonths = [
      { month: 1, name: "January" },
      { month: 3, name: "March" },
      { month: 5, name: "May" },
      { month: 7, name: "July" },
      { month: 8, name: "August" },
      { month: 10, name: "October" },
      { month: 12, name: "December" }
    ];

    thirtyOneDayMonths.forEach(({ month, name }) => {
      it(`Should correctly handle ${name} with 31 days`, async function () {
        const year = 2026;
        
        // Test mid-month
        const midMonthTimestamp = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(midMonthTimestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.false;
        expect(await sweepKeeper.getDaysInMonth()).to.equal(31);
        
        // Test last 3 days: 29, 30, 31
        const monthEndDays = [29, 30, 31];
        for (const day of monthEndDays) {
          const timestamp = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getTime() / 1000;
          await time.increaseTo(timestamp);
          await ethers.provider.send("evm_mine", []);
          
          expect(await sweepKeeper.isMonthEnd()).to.be.true;
          expect(await sweepKeeper.getDayOfMonth()).to.equal(day);
        }
        
        // Verify day 28 is NOT month-end
        const day28Timestamp = new Date(Date.UTC(year, month - 1, 28, 12, 0, 0)).getTime() / 1000;
        await time.increaseTo(day28Timestamp);
        await ethers.provider.send("evm_mine", []);
        
        expect(await sweepKeeper.isMonthEnd()).to.be.false;
      });
    });
  });

  describe("Month Boundaries", function () {
    it("Should correctly transition from month-end to next month start", async function () {
      const year = 2026;
      
      // January 31 (month-end)
      const jan31Timestamp = new Date(Date.UTC(year, 0, 31, 23, 59, 59)).getTime() / 1000;
      await time.increaseTo(jan31Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.true;
      expect(await sweepKeeper.getDayOfMonth()).to.equal(31);
      expect(await sweepKeeper.getMonth()).to.equal(1);
      
      // February 1 (not month-end)
      const feb1Timestamp = new Date(Date.UTC(year, 1, 1, 0, 0, 1)).getTime() / 1000;
      await time.increaseTo(feb1Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
      expect(await sweepKeeper.getDayOfMonth()).to.equal(1);
      expect(await sweepKeeper.getMonth()).to.equal(2);
    });

    it("Should correctly handle year boundary (Dec 31 to Jan 1)", async function () {
      // December 31, 2025 (month-end)
      const dec31Timestamp = new Date(Date.UTC(2025, 11, 31, 23, 59, 59)).getTime() / 1000;
      await time.increaseTo(dec31Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.true;
      expect(await sweepKeeper.getDayOfMonth()).to.equal(31);
      expect(await sweepKeeper.getMonth()).to.equal(12);
      expect(await sweepKeeper.getYear()).to.equal(2025);
      
      // January 1, 2026 (not month-end)
      const jan1Timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, 1)).getTime() / 1000;
      await time.increaseTo(jan1Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
      expect(await sweepKeeper.getDayOfMonth()).to.equal(1);
      expect(await sweepKeeper.getMonth()).to.equal(1);
      expect(await sweepKeeper.getYear()).to.equal(2026);
    });

    it("Should correctly handle February to March boundary in leap year", async function () {
      // February 29, 2024 (leap year, month-end)
      const feb29Timestamp = new Date(Date.UTC(2024, 1, 29, 23, 59, 59)).getTime() / 1000;
      await time.increaseTo(feb29Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.true;
      expect(await sweepKeeper.getDayOfMonth()).to.equal(29);
      expect(await sweepKeeper.getMonth()).to.equal(2);
      expect(await sweepKeeper.getDaysInMonth()).to.equal(29);
      
      // March 1, 2024 (not month-end)
      const mar1Timestamp = new Date(Date.UTC(2024, 2, 1, 0, 0, 1)).getTime() / 1000;
      await time.increaseTo(mar1Timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.false;
      expect(await sweepKeeper.getDayOfMonth()).to.equal(1);
      expect(await sweepKeeper.getMonth()).to.equal(3);
      expect(await sweepKeeper.getDaysInMonth()).to.equal(31);
    });
  });

  describe("Time Until Next Sweep Calculation", function () {
    it("Should return 0 when in month-end window", async function () {
      const year = 2026;
      const month = 1; // January (31 days)
      
      // Test on day 29 (month-end)
      const timestamp = new Date(Date.UTC(year, month - 1, 29, 12, 0, 0)).getTime() / 1000;
      await time.increaseTo(timestamp);
      await ethers.provider.send("evm_mine", []);
      
      expect(await sweepKeeper.isMonthEnd()).to.be.true;
      expect(await sweepKeeper.getTimeUntilNextSweep()).to.equal(0);
    });

    it("Should calculate correct time for mid-month", async function () {
      const year = 2026;
      const month = 1; // January (31 days)
      
      // Test on day 15
      const timestamp = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)).getTime() / 1000;
      await time.increaseTo(timestamp);
      await ethers.provider.send("evm_mine", []);
      
      // Month-end starts on day 29 (31 - 2)
      // Days until: 29 - 15 = 14 days
      const expectedSeconds = 14n * 86400n;
      
      expect(await sweepKeeper.getTimeUntilNextSweep()).to.equal(expectedSeconds);
    });
  });
});
