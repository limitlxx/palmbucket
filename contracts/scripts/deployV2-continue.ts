import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Continue V2 deployment - deploys remaining contracts
 * Run this after partial deployment to complete the setup
 */
async function main() {
  console.log("\n=== Continuing PalmBudget V2 Deployment ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Addresses from partial deployment
  const mockUSDCAddress = "0x186B110dD3A58f6160B1E2C24D02Cc34715ABF60";
  const mockMethAddress = "0xc5d8834c902C3bd82EF265F1400480EAC3BCd7E1";
  const mockMethStakingAddress = "0x5d54ec7b3E622735E8bd7BADd67358862Af292fF";
  const billsVaultAddress = "0x43B86Fa95149aa3344F0e3cd932fB9FC019E027D";
  const savingsVaultAddress = "0x1817D029CCF16ffe6cE26506508264909F3BfB1E";

  const maxDeposit = ethers.parseUnits("100000", 6);

  console.log("\n--- Deploying Growth Vault ---\n");
  const GrowthVault = await ethers.getContractFactory("GrowthVault");
  const growthVault = await GrowthVault.deploy(
    mockUSDCAddress,
    maxDeposit,
    mockMethAddress,
    mockMethStakingAddress
  );
  await growthVault.waitForDeployment();
  const growthVaultAddress = await growthVault.getAddress();
  console.log("✓ Growth Vault deployed to:", growthVaultAddress);

  console.log("\n--- Deploying Spendable Vault ---\n");
  const SpendableVault = await ethers.getContractFactory("SpendableVault");
  const spendableVault = await SpendableVault.deploy(
    mockUSDCAddress,
    maxDeposit
  );
  await spendableVault.waitForDeployment();
  const spendableVaultAddress = await spendableVault.getAddress();
  console.log("✓ Spendable Vault deployed to:", spendableVaultAddress);

  console.log("\n--- Deploying SweepKeeper ---\n");
  const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
  const minimumBalance = ethers.parseUnits("100", 6);
  const sweepKeeper = await SweepKeeper.deploy(minimumBalance);
  await sweepKeeper.waitForDeployment();
  const sweepKeeperAddress = await sweepKeeper.getAddress();
  console.log("✓ SweepKeeper deployed to:", sweepKeeperAddress);

  console.log("\n--- Configuring SweepKeeper ---\n");
  const setBucketsTx = await sweepKeeper.setBucketAddresses(
    billsVaultAddress,
    savingsVaultAddress,
    growthVaultAddress,
    spendableVaultAddress
  );
  await setBucketsTx.wait();
  console.log("✓ Bucket addresses configured");

  console.log("\n=== Deployment Complete ===\n");
  console.log("Growth Vault:", growthVaultAddress);
  console.log("Spendable Vault:", spendableVaultAddress);
  console.log("SweepKeeper:", sweepKeeperAddress);
  console.log("\nUpdate deploymentsV2.json with these addresses!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
