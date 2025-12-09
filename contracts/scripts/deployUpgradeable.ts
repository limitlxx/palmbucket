import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n=== Deploying Upgradeable Contracts ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString(), "\n");

  // Use existing MockERC20 (USDC) from previous deployment
  console.log("1. Using existing MockERC20 (USDC)...");
  const mockUSDCAddress = "0x186B110dD3A58f6160B1E2C24D02Cc34715ABF60";
  console.log("✓ MockERC20 address:", mockUSDCAddress, "\n");

  // Use placeholder addresses for mock protocols (not needed for upgradeable vaults)
  console.log("2. Using placeholder addresses for mock protocols...");
  const mockLendleAddress = ethers.ZeroAddress;
  const mockUSDYAddress = ethers.ZeroAddress;
  const mockMethAddress = ethers.ZeroAddress;
  const mockDEXRouterAddress = ethers.ZeroAddress;
  console.log("✓ Mock protocols will be configured later\n");

  // Deploy Upgradeable Vaults
  const maxDeposit = ethers.parseUnits("10000000", 6); // 10M USDC max

  console.log("3. Deploying Upgradeable BillsVault...");
  const BillsVault = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const billsVault = await upgrades.deployProxy(
    BillsVault,
    [
      mockUSDCAddress,
      "PalmBudget Bills Vault",
      "pbBILLS",
      0, // VaultType.BILLS
      maxDeposit,
      deployer.address
    ],
    { initializer: "initialize", kind: "uups" }
  );
  await billsVault.waitForDeployment();
  const billsVaultAddress = await billsVault.getAddress();
  console.log("✓ BillsVault proxy deployed to:", billsVaultAddress);

  console.log("4. Deploying Upgradeable SavingsVault...");
  const SavingsVault = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const savingsVault = await upgrades.deployProxy(
    SavingsVault,
    [
      mockUSDCAddress,
      "PalmBudget Savings Vault",
      "pbSAVE",
      1, // VaultType.SAVINGS
      maxDeposit,
      deployer.address
    ],
    { initializer: "initialize", kind: "uups" }
  );
  await savingsVault.waitForDeployment();
  const savingsVaultAddress = await savingsVault.getAddress();
  console.log("✓ SavingsVault proxy deployed to:", savingsVaultAddress);

  console.log("5. Deploying Upgradeable GrowthVault...");
  const GrowthVault = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const growthVault = await upgrades.deployProxy(
    GrowthVault,
    [
      mockUSDCAddress,
      "PalmBudget Growth Vault",
      "pbGROW",
      2, // VaultType.GROWTH
      maxDeposit,
      deployer.address
    ],
    { initializer: "initialize", kind: "uups" }
  );
  await growthVault.waitForDeployment();
  const growthVaultAddress = await growthVault.getAddress();
  console.log("✓ GrowthVault proxy deployed to:", growthVaultAddress);

  console.log("6. Deploying Upgradeable SpendableVault...");
  const SpendableVault = await ethers.getContractFactory("BucketVaultV3Upgradeable");
  const spendableVault = await upgrades.deployProxy(
    SpendableVault,
    [
      mockUSDCAddress,
      "PalmBudget Spendable Vault",
      "pbSPEND",
      3, // VaultType.SPENDABLE
      maxDeposit,
      deployer.address
    ],
    { initializer: "initialize", kind: "uups" }
  );
  await spendableVault.waitForDeployment();
  const spendableVaultAddress = await spendableVault.getAddress();
  console.log("✓ SpendableVault proxy deployed to:", spendableVaultAddress, "\n");

  // Deploy PaymentRouter (Upgradeable)
  console.log("7. Deploying Upgradeable PaymentRouter...");
  const PaymentRouter = await ethers.getContractFactory("PaymentRouterUpgradeable");
  const paymentRouter = await upgrades.deployProxy(
    PaymentRouter,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await paymentRouter.waitForDeployment();
  const paymentRouterAddress = await paymentRouter.getAddress();
  console.log("✓ PaymentRouter proxy deployed to:", paymentRouterAddress, "\n");

  // Deploy SweepKeeper (Upgradeable)
  console.log("8. Deploying Upgradeable SweepKeeper...");
  const minSpendableBalance = ethers.parseUnits("10", 6); // 10 USDC
  const SweepKeeper = await ethers.getContractFactory("SweepKeeperUpgradeable");
  const sweepKeeper = await upgrades.deployProxy(
    SweepKeeper,
    [minSpendableBalance, deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await sweepKeeper.waitForDeployment();
  const sweepKeeperAddress = await sweepKeeper.getAddress();
  console.log("✓ SweepKeeper proxy deployed to:", sweepKeeperAddress, "\n");

  // Configure SweepKeeper
  console.log("9. Configuring SweepKeeper...");
  await sweepKeeper.setBucketAddresses(
    billsVaultAddress,
    savingsVaultAddress,
    growthVaultAddress,
    spendableVaultAddress
  );
  console.log("✓ Bucket addresses set\n");

  // Skip DEX Router configuration for now (can be set later)
  console.log("10. Skipping DEX Router configuration (can be set later)\n");

  // Save deployment info
  const deployment = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      mockUSDC: mockUSDCAddress,
      mockLendle: mockLendleAddress,
      mockUSDY: mockUSDYAddress,
      mockMeth: mockMethAddress,
      mockDEXRouter: mockDEXRouterAddress,
      billsVault: billsVaultAddress,
      savingsVault: savingsVaultAddress,
      growthVault: growthVaultAddress,
      spendableVault: spendableVaultAddress,
      paymentRouter: paymentRouterAddress,
      sweepKeeper: sweepKeeperAddress,
    },
    upgradeable: true,
  };

  const deploymentsPath = path.join(__dirname, "../../deploymentsUpgradeable.json");
  const networkKey = `${network.name}_${network.chainId}`;
  
  let allDeployments: any = {};
  if (fs.existsSync(deploymentsPath)) {
    allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  }
  
  allDeployments[networkKey] = deployment;
  fs.writeFileSync(deploymentsPath, JSON.stringify(allDeployments, null, 2));
  
  console.log("✓ Deployment info saved to deploymentsUpgradeable.json\n");

  console.log("=== Deployment Summary ===");
  console.log("MockERC20 (USDC):", mockUSDCAddress);
  console.log("BillsVault:", billsVaultAddress);
  console.log("SavingsVault:", savingsVaultAddress);
  console.log("GrowthVault:", growthVaultAddress);
  console.log("SpendableVault:", spendableVaultAddress);
  console.log("PaymentRouter:", paymentRouterAddress);
  console.log("SweepKeeper:", sweepKeeperAddress);
  console.log("\n✓ All contracts deployed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
