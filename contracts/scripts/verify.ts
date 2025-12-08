import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentAddresses {
  network: string;
  chainId: number;
  deployer: string;
  timestamp: string;
  contracts: {
    mockUSDC: string;
    mockYieldProtocol: string;
    paymentRouter: string;
    billsVault: string;
    savingsVault: string;
    growthVault: string;
    spendableVault: string;
    sweepKeeper: string;
  };
}

async function main() {
  console.log("\n=== Verifying Deployed Contracts on Mantlescan ===\n");

  // Load deployment addresses
  const deploymentsPath = path.join(__dirname, "..", "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments.json not found. Please deploy contracts first.");
  }

  const allDeployments: { [key: string]: DeploymentAddresses } = JSON.parse(
    fs.readFileSync(deploymentsPath, "utf8")
  );

  // Get the network name from hardhat runtime
  const hre = require("hardhat");
  const networkKey = `${hre.network.name}_${hre.network.config.chainId}`;
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    throw new Error(`No deployment found for network ${hre.network.name}`);
  }

  console.log("Network:", deployment.network);
  console.log("Chain ID:", deployment.chainId);
  console.log("Verifying contracts...\n");

  // Helper function to verify with retry
  async function verifyContract(
    name: string,
    address: string,
    constructorArgs: any[]
  ) {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs,
      });
      console.log(`✓ ${name} verified successfully\n`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✓ ${name} already verified\n`);
      } else {
        console.error(`✗ Failed to verify ${name}:`, error.message, "\n");
      }
    }
  }

  // Verify MockERC20 (USDC)
  await verifyContract("MockERC20 (USDC)", deployment.contracts.mockUSDC, [
    "Mock USDC",
    "mUSDC",
    "1000000000000", // 1M USDC with 6 decimals
  ]);

  // Verify MockYieldProtocol
  await verifyContract(
    "MockYieldProtocol",
    deployment.contracts.mockYieldProtocol,
    []
  );

  // Verify PaymentRouter
  await verifyContract("PaymentRouter", deployment.contracts.paymentRouter, []);

  // Verify Bills Vault
  await verifyContract("Bills Vault", deployment.contracts.billsVault, [
    deployment.contracts.mockUSDC,
    "PalmBudget Bills Vault",
    "pbBILLS",
  ]);

  // Verify Savings Vault
  await verifyContract("Savings Vault", deployment.contracts.savingsVault, [
    deployment.contracts.mockUSDC,
    "PalmBudget Savings Vault",
    "pbSAVE",
  ]);

  // Verify Growth Vault
  await verifyContract("Growth Vault", deployment.contracts.growthVault, [
    deployment.contracts.mockUSDC,
    "PalmBudget Growth Vault",
    "pbGROW",
  ]);

  // Verify Spendable Vault
  await verifyContract("Spendable Vault", deployment.contracts.spendableVault, [
    deployment.contracts.mockUSDC,
    "PalmBudget Spendable Vault",
    "pbSPEND",
  ]);

  // Verify SweepKeeper
  await verifyContract("SweepKeeper", deployment.contracts.sweepKeeper, [
    "100000000", // 100 USDC with 6 decimals
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
