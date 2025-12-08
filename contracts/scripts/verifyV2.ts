import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n=== Verifying V2 Contracts on Mantlescan ===\n");

  const deploymentsPath = path.join(__dirname, "..", "..", "deploymentsV2.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deploymentsV2.json not found");
  }

  const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const hre = require("hardhat");
  const networkKey = `${hre.network.name}_${hre.network.config.chainId}`;
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    throw new Error(`No deployment found for network ${hre.network.name}`);
  }

  console.log("Network:", deployment.network);
  console.log("Chain ID:", deployment.chainId);

  async function verifyContract(name: string, address: string, constructorArgs: any[]) {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs,
      });
      console.log(`✓ ${name} verified\n`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✓ ${name} already verified\n`);
      } else {
        console.error(`✗ Failed to verify ${name}:`, error.message.split('\n')[0], "\n");
      }
    }
  }

  // Verify Mock USDC
  await verifyContract("MockERC20 (USDC)", deployment.contracts.mockUSDC, [
    "Mock USDC",
    "mUSDC",
    "10000000000000" // 10M USDC with 6 decimals
  ]);

  // Verify MockUSDY
  await verifyContract("MockUSDY", deployment.contracts.mockUSDY, []);

  // Verify MockUSDYManager
  await verifyContract("MockUSDYManager", deployment.contracts.mockUSDYManager, [
    deployment.contracts.mockUSDY,
    deployment.contracts.mockUSDC
  ]);

  // Verify MockRedemptionPriceOracle
  await verifyContract("MockRedemptionPriceOracle", deployment.contracts.mockUSDYOracle, [
    deployment.contracts.mockUSDY
  ]);

  // Verify MockMeth
  await verifyContract("MockMeth", deployment.contracts.mockMeth, []);

  // Verify MockMethStaking
  await verifyContract("MockMethStaking", deployment.contracts.mockMethStaking, [
    deployment.contracts.mockMeth
  ]);

  // Verify MockLendlePool
  await verifyContract("MockLendlePool", deployment.contracts.mockLendlePool, []);

  // Verify MockDEXRouter
  await verifyContract("MockDEXRouter", deployment.contracts.mockDEXRouter, []);

  // Verify SwapHelper
  await verifyContract("SwapHelper", deployment.contracts.swapHelper, [
    deployment.contracts.mockDEXRouter
  ]);

  // Verify PaymentRouter
  await verifyContract("PaymentRouter", deployment.contracts.paymentRouter, []);

  // Verify Bills Vault
  await verifyContract("Bills Vault", deployment.contracts.billsVault, [
    deployment.contracts.mockUSDC,
    "100000000000", // 100K USDC max deposit
    deployment.contracts.mockLendlePool,
    deployment.contracts.mockAToken
  ]);

  // Verify Savings Vault
  await verifyContract("Savings Vault", deployment.contracts.savingsVault, [
    deployment.contracts.mockUSDC,
    "100000000000", // 100K USDC max deposit
    deployment.contracts.mockUSDY,
    deployment.contracts.mockUSDYManager,
    deployment.contracts.mockUSDYOracle
  ]);

  // Verify Growth Vault
  await verifyContract("Growth Vault", deployment.contracts.growthVault, [
    deployment.contracts.mockUSDC,
    "100000000000", // 100K USDC max deposit
    deployment.contracts.mockMeth,
    deployment.contracts.mockMethStaking
  ]);

  // Verify Spendable Vault
  await verifyContract("Spendable Vault", deployment.contracts.spendableVault, [
    deployment.contracts.mockUSDC,
    "100000000000" // 100K USDC max deposit
  ]);

  // Verify SweepKeeper
  await verifyContract("SweepKeeper", deployment.contracts.sweepKeeper, [
    "100000000" // 100 USDC minimum balance
  ]);

  console.log("=== Verification Complete ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Verification failed:");
    console.error(error);
    process.exit(1);
  });
