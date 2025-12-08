import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentAddresses {
  network: string;
  chainId: number;
  deployer: string;
  timestamp: string;
  contracts: {
    // Mock tokens
    mockUSDC: string;
    
    // Mock protocols
    mockUSDY: string;
    mockUSDYManager: string;
    mockUSDYOracle: string;
    mockMeth: string;
    mockMethStaking: string;
    mockLendlePool: string;
    mockAToken: string;
    
    // Multi-asset support
    mockDEXRouter: string;
    
    // Core contracts
    paymentRouter: string;
    billsVault: string;
    savingsVault: string;
    growthVault: string;
    spendableVault: string;
    sweepKeeper: string;
  };
}

async function main() {
  console.log("\n=== PalmBudget V2 Deployment (Production-Ready Vaults) ===\n");

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

  console.log("\n--- Step 1: Deploying Mock USDC ---\n");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy(
    "Mock USDC",
    "mUSDC",
    ethers.parseUnits("10000000", 6) // 10M USDC with 6 decimals
  );
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✓ MockERC20 (USDC) deployed to:", mockUSDCAddress);

  console.log("\n--- Step 2: Deploying Mock Ondo USDY Protocol ---\n");

  // Deploy MockUSDY token
  console.log("Deploying MockUSDY token...");
  const MockUSDY = await ethers.getContractFactory("MockUSDY");
  const mockUSDY = await MockUSDY.deploy();
  await mockUSDY.waitForDeployment();
  const mockUSDYAddress = await mockUSDY.getAddress();
  console.log("✓ MockUSDY deployed to:", mockUSDYAddress);

  // Deploy MockUSDYManager
  console.log("Deploying MockUSDYManager...");
  const MockUSDYManager = await ethers.getContractFactory("MockUSDYManager");
  const mockUSDYManager = await MockUSDYManager.deploy(mockUSDYAddress, mockUSDCAddress);
  await mockUSDYManager.waitForDeployment();
  const mockUSDYManagerAddress = await mockUSDYManager.getAddress();
  console.log("✓ MockUSDYManager deployed to:", mockUSDYManagerAddress);

  // Deploy MockRedemptionPriceOracle
  console.log("Deploying MockRedemptionPriceOracle...");
  const MockRedemptionPriceOracle = await ethers.getContractFactory("MockRedemptionPriceOracle");
  const mockUSDYOracle = await MockRedemptionPriceOracle.deploy(mockUSDYAddress);
  await mockUSDYOracle.waitForDeployment();
  const mockUSDYOracleAddress = await mockUSDYOracle.getAddress();
  console.log("✓ MockRedemptionPriceOracle deployed to:", mockUSDYOracleAddress);

  // Fund USDYManager with USDC for redemptions
  console.log("Funding USDYManager with USDC...");
  await mockUSDC.mint(mockUSDYManagerAddress, ethers.parseUnits("1000000", 6));
  console.log("✓ USDYManager funded with 1M USDC");

  console.log("\n--- Step 3: Deploying Mock mETH Protocol ---\n");

  // Deploy MockMeth token
  console.log("Deploying MockMeth token...");
  const MockMeth = await ethers.getContractFactory("MockMeth");
  const mockMeth = await MockMeth.deploy();
  await mockMeth.waitForDeployment();
  const mockMethAddress = await mockMeth.getAddress();
  console.log("✓ MockMeth deployed to:", mockMethAddress);

  // Deploy MockMethStaking
  console.log("Deploying MockMethStaking...");
  const MockMethStaking = await ethers.getContractFactory("MockMethStaking");
  const mockMethStaking = await MockMethStaking.deploy(mockMethAddress);
  await mockMethStaking.waitForDeployment();
  const mockMethStakingAddress = await mockMethStaking.getAddress();
  console.log("✓ MockMethStaking deployed to:", mockMethStakingAddress);

  // Fund mETH contract with ETH for unstaking (skip on testnet to save gas)
  // console.log("Funding MockMeth with ETH...");
  // await deployer.sendTransaction({
  //   to: mockMethAddress,
  //   value: ethers.parseEther("10")
  // });
  // console.log("✓ MockMeth funded with 10 ETH");

  console.log("\n--- Step 4: Deploying Mock Lendle Protocol ---\n");

  // Deploy MockLendlePool
  console.log("Deploying MockLendlePool...");
  const MockLendlePool = await ethers.getContractFactory("MockLendlePool");
  const mockLendlePool = await MockLendlePool.deploy();
  await mockLendlePool.waitForDeployment();
  const mockLendlePoolAddress = await mockLendlePool.getAddress();
  console.log("✓ MockLendlePool deployed to:", mockLendlePoolAddress);

  // Initialize reserve for USDC
  console.log("Initializing USDC reserve in Lendle...");
  await mockLendlePool.initReserve(mockUSDCAddress, "Aave USDC", "aUSDC");
  const aTokenAddress = await mockLendlePool.aTokens(mockUSDCAddress);
  console.log("✓ aUSDC token deployed to:", aTokenAddress);

  // Fund Lendle pool with USDC for withdrawals
  console.log("Funding LendlePool with USDC...");
  await mockUSDC.mint(mockLendlePoolAddress, ethers.parseUnits("1000000", 6));
  console.log("✓ LendlePool funded with 1M USDC");

  console.log("\n--- Step 5: Deploying Multi-Asset Support (DEX & SwapHelper) ---\n");

  // Deploy MockDEXRouter (using mockMeth as WETH for simplicity)
  console.log("Deploying MockDEXRouter...");
  const MockDEXRouter = await ethers.getContractFactory("MockDEXRouter");
  const mockDEXRouter = await MockDEXRouter.deploy(mockMethAddress);
  await mockDEXRouter.waitForDeployment();
  const mockDEXRouterAddress = await mockDEXRouter.getAddress();
  console.log("✓ MockDEXRouter deployed to:", mockDEXRouterAddress);

  // Fund DEX router with tokens for swaps
  console.log("Funding DEXRouter with USDC...");
  await mockUSDC.mint(mockDEXRouterAddress, ethers.parseUnits("1000000", 6));
  console.log("✓ DEXRouter funded with 1M USDC");

  // SwapHelper is abstract and integrated into vaults, no separate deployment needed
  console.log("✓ SwapHelper integrated into vault contracts");

  console.log("\n--- Step 6: Deploying PaymentRouter ---\n");

  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy();
  await paymentRouter.waitForDeployment();
  const paymentRouterAddress = await paymentRouter.getAddress();
  console.log("✓ PaymentRouter deployed to:", paymentRouterAddress);

  console.log("\n--- Step 7: Deploying Specialized Vaults ---\n");

  const maxDeposit = ethers.parseUnits("100000", 6); // 100K USDC max per vault

  // Deploy Bills Vault
  console.log("Deploying Bills Vault (Lendle integration)...");
  const BillsVault = await ethers.getContractFactory("BillsVault");
  const billsVault = await BillsVault.deploy(
    mockUSDCAddress,
    maxDeposit,
    mockLendlePoolAddress,
    aTokenAddress
  );
  await billsVault.waitForDeployment();
  const billsVaultAddress = await billsVault.getAddress();
  console.log("✓ Bills Vault deployed to:", billsVaultAddress);

  // Deploy Savings Vault
  console.log("Deploying Savings Vault (Ondo USDY integration)...");
  const SavingsVault = await ethers.getContractFactory("SavingsVault");
  const savingsVault = await SavingsVault.deploy(
    mockUSDCAddress,
    maxDeposit,
    mockUSDYAddress,
    mockUSDYManagerAddress,
    mockUSDYOracleAddress
  );
  await savingsVault.waitForDeployment();
  const savingsVaultAddress = await savingsVault.getAddress();
  console.log("✓ Savings Vault deployed to:", savingsVaultAddress);

  // Deploy Growth Vault
  console.log("Deploying Growth Vault (mETH integration)...");
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

  // Fund Growth Vault with ETH for staking (skip on testnet to save gas)
  // await deployer.sendTransaction({
  //   to: growthVaultAddress,
  //   value: ethers.parseEther("5")
  // });
  // console.log("✓ Growth Vault funded with 5 ETH");

  // Deploy Spendable Vault
  console.log("Deploying Spendable Vault (no yield)...");
  const SpendableVault = await ethers.getContractFactory("SpendableVault");
  const spendableVault = await SpendableVault.deploy(
    mockUSDCAddress,
    maxDeposit
  );
  await spendableVault.waitForDeployment();
  const spendableVaultAddress = await spendableVault.getAddress();
  console.log("✓ Spendable Vault deployed to:", spendableVaultAddress);

  console.log("\n--- Step 8: Deploying SweepKeeper ---\n");

  const SweepKeeper = await ethers.getContractFactory("SweepKeeper");
  const minimumBalance = ethers.parseUnits("100", 6); // 100 USDC
  const sweepKeeper = await SweepKeeper.deploy(minimumBalance);
  await sweepKeeper.waitForDeployment();
  const sweepKeeperAddress = await sweepKeeper.getAddress();
  console.log("✓ SweepKeeper deployed to:", sweepKeeperAddress);

  console.log("\n--- Step 9: Configuring Contracts ---\n");

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

  console.log("\n--- Step 10: Saving Deployment Addresses ---\n");

  const deploymentData: DeploymentAddresses = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      mockUSDC: mockUSDCAddress,
      mockUSDY: mockUSDYAddress,
      mockUSDYManager: mockUSDYManagerAddress,
      mockUSDYOracle: mockUSDYOracleAddress,
      mockMeth: mockMethAddress,
      mockMethStaking: mockMethStakingAddress,
      mockLendlePool: mockLendlePoolAddress,
      mockAToken: aTokenAddress,
      mockDEXRouter: mockDEXRouterAddress,
      paymentRouter: paymentRouterAddress,
      billsVault: billsVaultAddress,
      savingsVault: savingsVaultAddress,
      growthVault: growthVaultAddress,
      spendableVault: spendableVaultAddress,
      sweepKeeper: sweepKeeperAddress,
    },
  };

  const deploymentsPath = path.join(__dirname, "..", "..", "deploymentsV2.json");
  let allDeployments: { [key: string]: DeploymentAddresses } = {};

  if (fs.existsSync(deploymentsPath)) {
    const existingData = fs.readFileSync(deploymentsPath, "utf8");
    allDeployments = JSON.parse(existingData);
  }

  const networkKey = `${network.name}_${network.chainId}`;
  allDeployments[networkKey] = deploymentData;

  fs.writeFileSync(deploymentsPath, JSON.stringify(allDeployments, null, 2));
  console.log("✓ Deployment addresses saved to deploymentsV2.json");

  console.log("\n=== Deployment Summary ===\n");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Deployer:", deployer.address);
  console.log("\nMock Protocols:");
  console.log("-------------------");
  console.log("MockUSDC:", mockUSDCAddress);
  console.log("MockUSDY:", mockUSDYAddress);
  console.log("MockUSDYManager:", mockUSDYManagerAddress);
  console.log("MockUSDYOracle:", mockUSDYOracleAddress);
  console.log("MockMeth:", mockMethAddress);
  console.log("MockMethStaking:", mockMethStakingAddress);
  console.log("MockLendlePool:", mockLendlePoolAddress);
  console.log("MockAToken (aUSDC):", aTokenAddress);
  console.log("\nMulti-Asset Support:");
  console.log("-------------------");
  console.log("MockDEXRouter:", mockDEXRouterAddress);
  console.log("\nCore Contracts:");
  console.log("-------------------");
  console.log("PaymentRouter:", paymentRouterAddress);
  console.log("Bills Vault:", billsVaultAddress);
  console.log("Savings Vault:", savingsVaultAddress);
  console.log("Growth Vault:", growthVaultAddress);
  console.log("Spendable Vault:", spendableVaultAddress);
  console.log("SweepKeeper:", sweepKeeperAddress);

  console.log("\n=== Vault Features ===\n");
  console.log("Bills Vault:");
  console.log("  - Yield: 4-6% APY via Lendle");
  console.log("  - Withdrawal: 7-day delay + 2% fee");
  console.log("  - Security: Emergency withdrawal available");
  console.log("\nSavings Vault:");
  console.log("  - Yield: 8-12% APY via Ondo USDY");
  console.log("  - Withdrawal: Instant, no fees");
  console.log("  - Security: Emergency withdrawal available");
  console.log("\nGrowth Vault:");
  console.log("  - Yield: 4-6% APY via mETH staking");
  console.log("  - Withdrawal: Instant, no fees");
  console.log("  - Security: Emergency withdrawal available");
  console.log("\nSpendable Vault:");
  console.log("  - Yield: None (optimized for instant access)");
  console.log("  - Withdrawal: Instant, no fees");
  console.log("  - Features: Fast transfers, no delays");

  console.log("\n=== Next Steps ===\n");
  console.log("1. Verify contracts on Mantlescan:");
  console.log("   npm run hardhat:verify:sepolia");
  console.log("\n2. Update .env.local with contract addresses:");
  console.log("   npm run hardhat:update-env --network mantle_sepolia");
  console.log("\n3. Test vault interactions:");
  console.log("   npm run hardhat:test-deployment --network mantle_sepolia");
  console.log("\n✓ V2 Deployment completed successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
