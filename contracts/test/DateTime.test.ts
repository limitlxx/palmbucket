import { expect } from "chai";
import { ethers } from "hardhat";

describe("DateTime Library Installation Test", function () {
  let dateTimeTest: any;

  before(async function () {
    const DateTimeTest = await ethers.getContractFactory("DateTimeTest");
    dateTimeTest = await DateTimeTest.deploy();
    await dateTimeTest.waitForDeployment();
  });

  it("Should correctly get day of month", async function () {
    // January 15, 2024 00:00:00 UTC
    const timestamp = 1705276800;
    const day = await dateTimeTest.testGetDay(timestamp);
    expect(day).to.equal(15);
  });

  it("Should correctly get month", async function () {
    // January 15, 2024 00:00:00 UTC
    const timestamp = 1705276800;
    const month = await dateTimeTest.testGetMonth(timestamp);
    expect(month).to.equal(1);
  });

  it("Should correctly get year", async function () {
    // January 15, 2024 00:00:00 UTC
    const timestamp = 1705276800;
    const year = await dateTimeTest.testGetYear(timestamp);
    expect(year).to.equal(2024);
  });

  it("Should correctly get days in month for January", async function () {
    // January 15, 2024 00:00:00 UTC
    const timestamp = 1705276800;
    const daysInMonth = await dateTimeTest.testGetDaysInMonth(timestamp);
    expect(daysInMonth).to.equal(31);
  });

  it("Should correctly get days in month for February (leap year)", async function () {
    // February 15, 2024 00:00:00 UTC (2024 is a leap year)
    const timestamp = 1707955200;
    const daysInMonth = await dateTimeTest.testGetDaysInMonth(timestamp);
    expect(daysInMonth).to.equal(29);
  });

  it("Should correctly identify leap year", async function () {
    // February 15, 2024 00:00:00 UTC (2024 is a leap year)
    const timestamp = 1707955200;
    const isLeap = await dateTimeTest.testIsLeapYear(timestamp);
    expect(isLeap).to.be.true;
  });

  it("Should correctly identify non-leap year", async function () {
    // February 15, 2023 00:00:00 UTC (2023 is not a leap year)
    const timestamp = 1676419200;
    const isLeap = await dateTimeTest.testIsLeapYear(timestamp);
    expect(isLeap).to.be.false;
  });
});
