import { HardhatUserConfig, task } from "hardhat/config.js";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Hardhat tasks for common operations
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const balance = await hre.ethers.provider.getBalance(taskArgs.account);
    console.log(hre.ethers.formatEther(balance), "ETH");
  });

task("deploy-info", "Prints deployment information", async (taskArgs, hre) => {
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);
  const accounts = await hre.ethers.getSigners();
  if (accounts.length > 0) {
    console.log("Deployer:", accounts[0].address);
    const balance = await hre.ethers.provider.getBalance(accounts[0].address);
    console.log("Deployer Balance:", hre.ethers.formatEther(balance), "ETH");
  }
});

task("verify-contract", "Verifies a contract on Mantlescan")
  .addParam("address", "The contract address")
  .addOptionalParam("args", "Constructor arguments (JSON array)")
  .setAction(async (taskArgs, hre) => {
    const constructorArgs = taskArgs.args ? JSON.parse(taskArgs.args) : [];
    await hre.run("verify:verify", {
      address: taskArgs.address,
      constructorArguments: constructorArgs,
    });
  });

task("test-deployment", "Tests deployed contract interactions")
  .setAction(async (taskArgs, hre) => {
    const fs = await import("fs");
    const path = await import("path");
    
    console.log("\n=== Testing Deployed Contracts ===\n");
    
    // Load deployment addresses
    const deploymentsPath = path.join(__dirname, "deployments.json");
    if (!fs.existsSync(deploymentsPath)) {
      throw new Error("deployments.json not found. Please deploy contracts first.");
    }
    
    const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    const networkKey = `${hre.network.name}_${hre.network.config.chainId}`;
    const deployment = allDeployments[networkKey];
    
    if (!deployment) {
      throw new Error(`No deployment found for network ${hre.network.name}`);
    }
    
    console.log("Network:", deployment.network);
    console.log("Chain ID:", deployment.chainId);
    
    const [signer] = await hre.ethers.getSigners();
    console.log("Testing with account:", signer.address);
    
    // Get contract instances
    const mockUSDC = await hre.ethers.getContractAt("MockERC20", deployment.contracts.mockUSDC);
    const paymentRouter = await hre.ethers.getContractAt("PaymentRouter", deployment.contracts.paymentRouter);
    const billsVault = await hre.ethers.getContractAt("BucketVault", deployment.contracts.billsVault);
    const savingsVault = await hre.ethers.getContractAt("BucketVault", deployment.contracts.savingsVault);
    const sweepKeeper = await hre.ethers.getContractAt("SweepKeeper", deployment.contracts.sweepKeeper);
    
    console.log("\n--- Test 1: Check MockERC20 Balance ---");
    const balance = await mockUSDC.balanceOf(signer.address);
    console.log("✓ Deployer USDC balance:", hre.ethers.formatUnits(balance, 6), "USDC");
    
    console.log("\n--- Test 2: Check PaymentRouter Configuration ---");
    const isInitialized = await paymentRouter.isUserInitialized(signer.address);
    console.log("✓ User initialized:", isInitialized);
    
    console.log("\n--- Test 3: Check Vault Names ---");
    const billsName = await billsVault.name();
    const savingsName = await savingsVault.name();
    console.log("✓ Bills Vault name:", billsName);
    console.log("✓ Savings Vault name:", savingsName);
    
    console.log("\n--- Test 4: Check SweepKeeper Configuration ---");
    const minBalance = await sweepKeeper.minimumSpendableBalance();
    const billsBucket = await sweepKeeper.billsBucket();
    console.log("✓ Minimum spendable balance:", hre.ethers.formatUnits(minBalance, 6), "USDC");
    console.log("✓ Bills bucket address:", billsBucket);
    
    console.log("\n--- Test 5: Check Yield Rates ---");
    const savingsYield = await savingsVault.getYieldRate();
    console.log("✓ Savings vault yield rate:", savingsYield.toString(), "basis points");
    
    console.log("\n✓ All contract interaction tests passed!\n");
  });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  // Add remappings for external libraries
  paths: {
    sources: "./contracts/src",
    tests: "./contracts/test",
    cache: "./contracts/cache",
    artifacts: "./contracts/artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: process.env.FORK_MANTLE_SEPOLIA === "true" ? {
        url: process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
        enabled: true,
      } : undefined,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    mantle_sepolia: {
      url: process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 ? [process.env.PRIVATE_KEY] : [],
      chainId: 5003,
      gasPrice: 20000000000, // 20 gwei
      timeout: 300000, // 5 minutes
    },
    mantle_mainnet: {
      url: process.env.MANTLE_MAINNET_RPC_URL || "https://rpc.mantle.xyz",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66 ? [process.env.PRIVATE_KEY] : [],
      chainId: 5000,
      gasPrice: 20000000000, // 20 gwei
      timeout: 60000,
    },
  },
  etherscan: {
    apiKey: process.env.MANTLESCAN_API_KEY || "api-key",
    customChains: [
      {
        network: "mantle_sepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://api-sepolia.mantlescan.xyz/api",
          browserURL: "https://sepolia.mantlescan.xyz",
        },
      },
      {
        network: "mantle_mainnet",
        chainId: 5000,
        urls: {
          apiURL: "https://api.mantlescan.xyz/api",
          browserURL: "https://mantlescan.xyz",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: process.env.GAS_REPORT_FILE || undefined,
    noColors: process.env.GAS_REPORT_FILE ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || undefined,
  },
  typechain: {
    outDir: "./contracts/typechain-types",
    target: "ethers-v6",
  },
  mocha: {
    timeout: 60000,
  },
};

export default config;