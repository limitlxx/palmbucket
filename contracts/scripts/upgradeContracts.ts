import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n=== Upgrading Contracts ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString(), "\n");

  // Load existing deployment
  const deploymentsPath = path.join(__dirname, "../../deploymentsUpgradeable.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deploymentsUpgradeable.json not found. Deploy contracts first.");
  }

  const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const networkKey = `${network.name}_${network.chainId}`;
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    throw new Error(`No deployment found for network ${network.name}`);
  }

  console.log("Current deployment addresses:");
  console.log("BillsVault:", deployment.contracts.billsVault);
  console.log("SavingsVault:", deployment.contracts.savingsVault);
  console.log("GrowthVault:", deployment.contracts.growthVault);
  console.log("SpendableVault:", deployment.contracts.spendableVault);
  console.log("PaymentRouter:", deployment.contracts.paymentRouter);
  console.log("SweepKeeper:", deployment.contracts.sweepKeeper);
  console.log();

  // Upgrade BillsVault
  console.log("1. Upgrading BillsVault...");
  const BillsVaultV2 = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const billsVaultUpgraded = await upgrades.upgradeProxy(
    deployment.contracts.billsVault,
    BillsVaultV2
  );
  await billsVaultUpgraded.waitForDeployment();
  console.log("✓ BillsVault upgraded");

  // Upgrade SavingsVault
  console.log("2. Upgrading SavingsVault...");
  const SavingsVaultV2 = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const savingsVaultUpgraded = await upgrades.upgradeProxy(
    deployment.contracts.savingsVault,
    SavingsVaultV2
  );
  await savingsVaultUpgraded.waitForDeployment();
  console.log("✓ SavingsVault upgraded");

  // Upgrade GrowthVault
  console.log("3. Upgrading GrowthVault...");
  const GrowthVaultV2 = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const growthVaultUpgraded = await upgrades.upgradeProxy(
    deployment.contracts.growthVault,
    GrowthVaultV2
  );
  await growthVaultUpgraded.waitForDeployment();
  console.log("✓ GrowthVault upgraded");

  // Upgrade SpendableVault
  console.log("4. Upgrading SpendableVault...");
  const SpendableVaultV2 = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const spendableVaultUpgraded = await upgrades.upgradeProxy(
    deployment.contracts.spendableVault,
    SpendableVaultV2
  );
  await spendableVaultUpgraded.waitForDeployment();
  console.log("✓ SpendableVault upgraded");

  // Upgrade PaymentRouter
  console.log("5. Upgrading PaymentRouter...");
  const PaymentRouterV2 = await ethers.getContractFactory("PaymentRouterUpgradeable");
  const paymentRouterUpgraded = await upgrades.upgradeProxy(
    deployment.contracts.paymentRouter,
    PaymentRouterV2
  );
  await paymentRouterUpgraded.waitForDeployment();
  console.log("✓ PaymentRouter upgraded");

  // Upgrade SweepKeeper
  console.log("6. Upgrading SweepKeeper...");
  const SweepKeeperV2 = await ethers.getContractFactory("SweepKeeperUpgradeable");
  const sweepKeeperUpgraded = await upgrades.upgradeProxy(
    deployment.contracts.sweepKeeper,
    SweepKeeperV2
  );
  await sweepKeeperUpgraded.waitForDeployment();
  console.log("✓ SweepKeeper upgraded\n");

  // Update deployment info
  deployment.lastUpgrade = new Date().toISOString();
  deployment.upgradeCount = (deployment.upgradeCount || 0) + 1;
  
  allDeployments[networkKey] = deployment;
  fs.writeFileSync(deploymentsPath, JSON.stringify(allDeployments, null, 2));
  
  console.log("✓ Deployment info updated\n");

  console.log("=== Upgrade Complete ===");
  console.log("All contracts upgraded successfully!");
  console.log("Proxy addresses remain the same.");
  console.log("New implementation contracts deployed.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
