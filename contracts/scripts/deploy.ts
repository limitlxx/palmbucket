import { ethers } from "hardhat";
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
  console.log("\n=== Starting PalmBudget Deployment ===\n");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer account has no balance. Please fund the account first.");
  }

  console.log("\n--- Step 1: Deploying Mock Tokens ---\n");

  // Deploy MockERC20 (USDC) for testing
  console.log("Deploying MockERC20 (USDC)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy(
    "Mock USDC",
    "mUSDC",
    ethers.parseUnits("1000000", 6) // 1M USDC with 6 decimals
  );
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✓ MockERC20 (USDC) deployed to:", mockUSDCAddress);

  console.log("\n--- Step 2: Deploying Mock Yield Protocol ---\n");

  // Deploy MockYieldProtocol for testing
  console.log("Deploying MockYieldProtocol...");
  const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
  const mockYieldProtocol = await MockYieldProtocol.deploy();
  await mockYieldProtocol.waitForDeployment();
  const mockYieldProtocolAddress = await mockYieldProtocol.getAddress();
  console.log("✓ MockYieldProtocol deployed to:", mockYieldProtocolAddress);

  console.log("\n--- Step 3: Deploying PaymentRouter ---\n");

  // Deploy PaymentRouter
  console.log("Deploying PaymentRouter...");
  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy();
  await paymentRouter.waitForDeployment();
  const paymentRouterAddress = await paymentRouter.getAddress();
  console.log("✓ PaymentRouter deployed to:", paymentRouterAddress);

  console.log("\n--- Step 4: Deploying BucketVaults (4 vaults) ---\n");

  // Deploy Bills Vault
  console.log("Deploying Bills Vault...");
  const BucketVault = await ethers.getContractFactory("BucketVault");
  const billsVault = await BucketVault.deploy(
    mockUSDCAddress,
    "PalmBudget Bills Vault",
    "pbBILLS"
  );
  await billsVault.waitForDeployment();
  const billsVaultAddress = await billsVault.getAddress();
  console.log("✓ Bills Vault deployed to:", billsVaultAddress);

  // Deploy Savings Vault
  console.log("Deploying Savings Vault...");
  const savingsVault = await BucketVault.deploy(
    mockUSDCAddress,
    "PalmBudget Savings Vault",
    "pbSAVE"
  );
  await savingsVault.waitForDeployment();
  const savingsVaultAddress = await savingsVault.getAddress();
  console.log("✓ Savings Vault deployed to:", savingsVaultAddress);

  // Deploy Growth Vault
  console.log("Deploying Growth Vault...");
  const growthVault = await BucketVault.deploy(
    mockUSDCAddress,
    "PalmBudget Growth Vault",
    "pbGROW"
  );
  await growthVault.waitForDeployment();
  const growthVaultAddress = await growthVault.getAddress();
  console.log("✓ Growth Vault deployed to:", growthVaultAddress);

  // Deploy Spendable Vault
  console.log("Deploying Spendable Vault...");
  const spendableVault = await BucketVault.deploy(
    mockUSDCAddress,
    "PalmBudget Spendable Vault",
    "pbSPEND"
  );
  await spendableVault.waitForDeployment();
  const spendableVaultAddress = await spendableVault.getAddress();
  console.log("✓ Spendable Vault deployed to:", spendableVaultAddress);

  console.log("\n--- Step 5: Deploying SweepKeeper ---\n");

  // Deploy SweepKeeper with minimum balance of 100 USDC
  console.log("Deploying SweepKeeper...");
  const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
  const minimumBalance = ethers.parseUnits("100", 6); // 100 USDC
  const sweepKeeper = await SweepKeeper.deploy(minimumBalance);
  await sweepKeeper.waitForDeployment();
  const sweepKeeperAddress = await sweepKeeper.getAddress();
  console.log("✓ SweepKeeper deployed to:", sweepKeeperAddress);

  console.log("\n--- Step 6: Configuring Contracts ---\n");

  // Configure SweepKeeper with bucket addresses
  console.log("Setting bucket addresses in SweepKeeper...");
  const setBucketsTx = await sweepKeeper.setBucketAddresses(
    billsVaultAddress,
    savingsVaultAddress,
    growthVaultAddress,
    spendableVaultAddress
  );
  await setBucketsTx.wait();
  console.log("✓ Bucket addresses configured in SweepKeeper");

  // Configure yield protocols for Savings and Growth vaults
  console.log("Setting yield protocol for Savings Vault...");
  const setSavingsYieldTx = await savingsVault.setYieldProtocol(mockYieldProtocolAddress);
  await setSavingsYieldTx.wait();
  console.log("✓ Yield protocol set for Savings Vault");

  console.log("Setting yield protocol for Growth Vault...");
  const setGrowthYieldTx = await growthVault.setYieldProtocol(mockYieldProtocolAddress);
  await setGrowthYieldTx.wait();
  console.log("✓ Yield protocol set for Growth Vault");

  console.log("\n--- Step 7: Saving Deployment Addresses ---\n");

  // Prepare deployment data
  const deploymentData: DeploymentAddresses = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      mockUSDC: mockUSDCAddress,
      mockYieldProtocol: mockYieldProtocolAddress,
      paymentRouter: paymentRouterAddress,
      billsVault: billsVaultAddress,
      savingsVault: savingsVaultAddress,
      growthVault: growthVaultAddress,
      spendableVault: spendableVaultAddress,
      sweepKeeper: sweepKeeperAddress,
    },
  };

  // Save to deployments.json
  const deploymentsPath = path.join(__dirname, "..", "..", "deployments.json");
  let allDeployments: { [key: string]: DeploymentAddresses } = {};

  // Read existing deployments if file exists
  if (fs.existsSync(deploymentsPath)) {
    const existingData = fs.readFileSync(deploymentsPath, "utf8");
    allDeployments = JSON.parse(existingData);
  }

  // Add or update deployment for this network
  const networkKey = `${network.name}_${network.chainId}`;
  allDeployments[networkKey] = deploymentData;

  // Write back to file
  fs.writeFileSync(deploymentsPath, JSON.stringify(allDeployments, null, 2));
  console.log("✓ Deployment addresses saved to deployments.json");

  console.log("\n=== Deployment Summary ===\n");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log("MockERC20 (USDC):", mockUSDCAddress);
  console.log("MockYieldProtocol:", mockYieldProtocolAddress);
  console.log("PaymentRouter:", paymentRouterAddress);
  console.log("Bills Vault:", billsVaultAddress);
  console.log("Savings Vault:", savingsVaultAddress);
  console.log("Growth Vault:", growthVaultAddress);
  console.log("Spendable Vault:", spendableVaultAddress);
  console.log("SweepKeeper:", sweepKeeperAddress);

  console.log("\n=== Next Steps ===\n");
  console.log("1. Verify contracts on Mantlescan:");
  console.log("   npx hardhat verify --network mantle_sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>");
  console.log("\n2. Test contract interactions:");
  console.log("   npx hardhat test-deployment --network mantle_sepolia");
  console.log("\n3. Update .env.local with contract addresses");
  console.log("\n✓ Deployment completed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });