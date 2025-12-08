import { expect } from "chai";
import { ethers } from "hardhat";
import { SweepKeeper, MockERC20, BucketVaultV2 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SweepKeeper Error Handling Tests", function () {
  let sweepKeeper: SweepKeeper;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let mockToken: MockERC20;
  let spendableVault: BucketVaultV2;
  let billsVault: BucketVaultV2;
  let savingsVault: BucketVaultV2;
  let growthVault: BucketVaultV2;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Deploy SweepKeeper
    const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
    sweepKeeper = await SweepKeeper.deploy(10_000_000); // 10 USDC minimum
    await sweepKeeper.waitForDeployment();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await mockToken.waitForDeployment();

    // Deploy vaults
    const BucketVaultV2 = await ethers.getContractFactory("BucketVaultV2");
    const maxDeposit = ethers.parseUnits("1000000", 6); // 1M USDC
    
    spendableVault = await BucketVaultV2.deploy(
      await mockToken.getAddress(),
      "Spendable Vault",
      "spUSDC",
      3, // VaultType.SPENDABLE
      maxDeposit
    );
    await spendableVault.waitForDeployment();

    billsVault = await BucketVaultV2.deploy(
      await mockToken.getAddress(),
      "Bills Vault",
      "bUSDC",
      0, // VaultType.BILLS
      maxDeposit
    );
    await billsVault.waitForDeployment();

    savingsVault = await BucketVaultV2.deploy(
      await mockToken.getAddress(),
      "Savings Vault",
      "sUSDC",
      1, // VaultType.SAVINGS
      maxDeposit
    );
    await savingsVault.waitForDeployment();

    growthVault = await BucketVaultV2.deploy(
      await mockToken.getAddress(),
      "Growth Vault",
      "gUSDC",
      2, // VaultType.GROWTH
      maxDeposit
    );
    await growthVault.waitForDeployment();
  });

  describe("Bucket Initialization Validation", function () {
    it("Should revert with InvalidBucketAddress when buckets not initialized", async function () {
      // Authorize user
      await sweepKeeper.connect(user).authorizeAutoSweep();

      // Try to execute sweep without setting bucket addresses
      await expect(
        sweepKeeper.connect(owner).executeSweep(user.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidBucketAddress");
    });

    it("Should revert with InvalidBucketAddress in setBucketAddresses with zero address", async function () {
      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          ethers.ZeroAddress,
          await savingsVault.getAddress(),
          await growthVault.getAddress(),
          await spendableVault.getAddress()
        )
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidBucketAddress");

      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          await billsVault.getAddress(),
          ethers.ZeroAddress,
          await growthVault.getAddress(),
          await spendableVault.getAddress()
        )
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidBucketAddress");

      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          await billsVault.getAddress(),
          await savingsVault.getAddress(),
          ethers.ZeroAddress,
          await spendableVault.getAddress()
        )
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidBucketAddress");

      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          await billsVault.getAddress(),
          await savingsVault.getAddress(),
          await growthVault.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(sweepKeeper, "InvalidBucketAddress");
    });

    it("Should succeed when all buckets are properly initialized", async function () {
      await expect(
        sweepKeeper.connect(owner).setBucketAddresses(
          await billsVault.getAddress(),
          await savingsVault.getAddress(),
          await growthVault.getAddress(),
          await spendableVault.getAddress()
        )
      ).to.emit(sweepKeeper, "BucketAddressesUpdated");
    });
  });

  describe("Timing Validation", function () {
    beforeEach(async function () {
      // Set bucket addresses
      await sweepKeeper.connect(owner).setBucketAddresses(
        await billsVault.getAddress(),
        await savingsVault.getAddress(),
        await growthVault.getAddress(),
        await spendableVault.getAddress()
      );

      // Authorize user
      await sweepKeeper.connect(user).authorizeAutoSweep();

      // Mint tokens and deposit to spendable vault
      await mockToken.mint(user.address, 100_000_000); // 100 USDC
      await mockToken.connect(user).approve(await spendableVault.getAddress(), 100_000_000);
      await spendableVault.connect(user).deposit(100_000_000, user.address);

      // Approve SweepKeeper to spend user's vault shares
      await spendableVault.connect(user).approve(await sweepKeeper.getAddress(), ethers.MaxUint256);
    });

    it("Should revert with NotMonthEnd when not in month-end window", async function () {
      // Set time to middle of month (day 15)
      const now = await time.latest();
      const currentMonth = new Date(now * 1000).getMonth();
      const currentYear = new Date(now * 1000).getFullYear();
      const midMonth = new Date(currentYear, currentMonth, 15, 12, 0, 0);
      await time.setNextBlockTimestamp(Math.floor(midMonth.getTime() / 1000));
      await ethers.provider.send("evm_mine", []);

      // Verify we're not in month-end
      const isMonthEnd = await sweepKeeper.isMonthEnd();
      expect(isMonthEnd).to.be.false;

      // Try to execute sweep
      await expect(
        sweepKeeper.connect(owner).executeSweep(user.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "NotMonthEnd");
    });
  });

  describe("Authorization Validation", function () {
    beforeEach(async function () {
      // Set bucket addresses
      await sweepKeeper.connect(owner).setBucketAddresses(
        await billsVault.getAddress(),
        await savingsVault.getAddress(),
        await growthVault.getAddress(),
        await spendableVault.getAddress()
      );
    });

    it("Should revert with NotAuthorized when user has not authorized", async function () {
      // Try to execute sweep without authorization
      await expect(
        sweepKeeper.connect(owner).executeSweep(user.address)
      ).to.be.revertedWithCustomError(sweepKeeper, "NotAuthorized");
    });
  });
});
