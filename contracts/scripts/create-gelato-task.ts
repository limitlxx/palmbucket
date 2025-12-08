import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Script to create Gelato Network tasks for SweepKeeper automation
 * 
 * This script helps set up automated month-end sweeps by creating Gelato tasks
 * that monitor user accounts and execute sweeps when conditions are met.
 * 
 * Prerequisites:
 * 1. SweepKeeper contract deployed and initialized
 * 2. Gelato account created at https://app.gelato.network
 * 3. Gelato 1Balance funded with MNT tokens
 * 4. Users have authorized auto-sweep
 * 
 * Usage:
 *   npx hardhat run contracts/scripts/create-gelato-task.ts --network mantle_sepolia
 *   npx hardhat run contracts/scripts/create-gelato-task.ts --network mantle_mainnet
 */

interface GelatoTaskConfig {
  name: string;
  contractAddress: string;
  userAddress: string;
  checkInterval: number; // in seconds
  network: string;
  chainId: number;
}

interface DeploymentInfo {
  network: string;
  chainId: number;
  timestamp: string;
  contracts: {
    sweepKeeper: string;
    [key: string]: string;
  };
}

/**
 * Load deployment information from deploymentsV2.json
 */
function loadDeploymentInfo(networkName: string, chainId: number): DeploymentInfo | null {
  const deploymentsPath = path.join(__dirname, "../../deploymentsV2.json");
  
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ deploymentsV2.json not found");
    console.log("Please deploy contracts first using:");
    console.log("  npm run hardhat:deploy:v2:sepolia");
    return null;
  }

  const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const networkKey = `${networkName}_${chainId}`;
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    console.error(`❌ No deployment found for network ${networkName} (chainId: ${chainId})`);
    return null;
  }

  if (!deployment.contracts.sweepKeeper) {
    console.error("❌ SweepKeeper contract not found in deployment");
    return null;
  }

  return deployment;
}

/**
 * Query authorized users from the SweepKeeper contract
 */
async function getAuthorizedUsers(sweepKeeperAddress: string): Promise<string[]> {
  console.log("\n📋 Querying authorized users...");
  
  const sweepKeeper = await ethers.getContractAt("SweepKeeper", sweepKeeperAddress);
  
  // Query AuthorizationChanged events
  const filter = sweepKeeper.filters.AuthorizationChanged();
  const events = await sweepKeeper.queryFilter(filter);
  
  // Build a map of current authorization states
  const authMap = new Map<string, boolean>();
  
  for (const event of events) {
    const user = event.args.user;
    const authorized = event.args.authorized;
    authMap.set(user, authorized);
  }
  
  // Filter for currently authorized users
  const authorizedUsers = Array.from(authMap.entries())
    .filter(([_, authorized]) => authorized)
    .map(([user, _]) => user);
  
  console.log(`✓ Found ${authorizedUsers.length} authorized user(s)`);
  
  if (authorizedUsers.length > 0) {
    console.log("\nAuthorized users:");
    authorizedUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user}`);
    });
  }
  
  return authorizedUsers;
}

/**
 * Verify SweepKeeper configuration
 */
async function verifySweepKeeperConfig(sweepKeeperAddress: string): Promise<boolean> {
  console.log("\n🔍 Verifying SweepKeeper configuration...");
  
  const sweepKeeper = await ethers.getContractAt("SweepKeeper", sweepKeeperAddress);
  
  try {
    // Check if buckets are initialized
    const billsBucket = await sweepKeeper.billsBucket();
    const savingsBucket = await sweepKeeper.savingsBucket();
    const growthBucket = await sweepKeeper.growthBucket();
    const spendableBucket = await sweepKeeper.spendableBucket();
    
    if (billsBucket === ethers.ZeroAddress || 
        savingsBucket === ethers.ZeroAddress ||
        growthBucket === ethers.ZeroAddress ||
        spendableBucket === ethers.ZeroAddress) {
      console.error("❌ Bucket addresses not initialized");
      console.log("Please initialize bucket addresses using setBucketAddresses()");
      return false;
    }
    
    console.log("✓ Bills Bucket:", billsBucket);
    console.log("✓ Savings Bucket:", savingsBucket);
    console.log("✓ Growth Bucket:", growthBucket);
    console.log("✓ Spendable Bucket:", spendableBucket);
    
    // Check pause state
    const isPaused = await sweepKeeper.isPaused();
    if (isPaused) {
      console.warn("⚠️  Contract is currently paused");
      console.log("Sweeps will not execute until unpaused");
    } else {
      console.log("✓ Contract is not paused");
    }
    
    // Check global minimum balance
    const globalMinimum = await sweepKeeper.globalMinimumBalance();
    console.log(`✓ Global minimum balance: ${ethers.formatUnits(globalMinimum, 6)} USDC`);
    
    return true;
  } catch (error) {
    console.error("❌ Error verifying configuration:", error);
    return false;
  }
}

/**
 * Test the checker function for a user
 */
async function testChecker(sweepKeeperAddress: string, userAddress: string): Promise<void> {
  console.log(`\n🧪 Testing checker for user ${userAddress}...`);
  
  const sweepKeeper = await ethers.getContractAt("SweepKeeper", sweepKeeperAddress);
  
  try {
    const [canExec, execPayload] = await sweepKeeper.checker(userAddress);
    
    console.log(`  Can Execute: ${canExec}`);
    
    if (canExec) {
      console.log(`  ✓ Sweep can be executed`);
      console.log(`  Payload length: ${execPayload.length} bytes`);
    } else {
      console.log(`  ℹ️  Sweep cannot be executed (conditions not met)`);
      
      // Provide diagnostic information
      const isAuthorized = await sweepKeeper.isAuthorized(userAddress);
      const isMonthEnd = await sweepKeeper.isMonthEnd();
      const sweepableAmount = await sweepKeeper.getSweepableAmount(userAddress);
      const isPaused = await sweepKeeper.isPaused();
      
      console.log(`\n  Diagnostics:`);
      console.log(`    - User authorized: ${isAuthorized}`);
      console.log(`    - Is month-end: ${isMonthEnd}`);
      console.log(`    - Sweepable amount: ${ethers.formatUnits(sweepableAmount, 6)} USDC`);
      console.log(`    - Contract paused: ${isPaused}`);
    }
  } catch (error) {
    console.error("❌ Error testing checker:", error);
  }
}

/**
 * Generate Gelato task configuration
 */
function generateTaskConfig(
  sweepKeeperAddress: string,
  userAddress: string,
  networkName: string,
  chainId: number
): GelatoTaskConfig {
  return {
    name: `SweepKeeper-${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
    contractAddress: sweepKeeperAddress,
    userAddress: userAddress,
    checkInterval: 6 * 60 * 60, // 6 hours in seconds
    network: networkName,
    chainId: chainId,
  };
}

/**
 * Display task creation instructions
 */
function displayTaskInstructions(config: GelatoTaskConfig): void {
  console.log("\n" + "=".repeat(80));
  console.log("📝 GELATO TASK CREATION INSTRUCTIONS");
  console.log("=".repeat(80));
  
  console.log("\n1. Visit Gelato Network:");
  console.log("   https://app.gelato.network/new-task");
  
  console.log("\n2. Connect your wallet and select network:");
  console.log(`   Network: ${config.network}`);
  console.log(`   Chain ID: ${config.chainId}`);
  
  console.log("\n3. Task Configuration:");
  console.log(`   Task Name: ${config.name}`);
  console.log(`   Task Type: Resolver`);
  
  console.log("\n4. Contract Details:");
  console.log(`   Contract Address: ${config.contractAddress}`);
  console.log(`   Resolver Function: checker(address)`);
  console.log(`   User Parameter: ${config.userAddress}`);
  
  console.log("\n5. Execution Settings:");
  console.log(`   Check Interval: Every ${config.checkInterval / 3600} hours`);
  console.log(`   Execution Function: executeSweep(address)`);
  
  console.log("\n6. Payment Settings:");
  console.log(`   Payment Method: 1Balance (Recommended)`);
  console.log(`   Ensure your Gelato 1Balance has sufficient MNT tokens`);
  
  console.log("\n7. Advanced Settings:");
  console.log(`   Dedicated msg.sender: Yes (Recommended)`);
  console.log(`   Single Execution: No (Allow multiple executions)`);
  
  console.log("\n" + "=".repeat(80));
}

/**
 * Save task configuration to file
 */
function saveTaskConfig(configs: GelatoTaskConfig[]): void {
  const outputPath = path.join(__dirname, "../../gelato-tasks.json");
  
  const output = {
    timestamp: new Date().toISOString(),
    tasks: configs,
    instructions: "Use these configurations to create Gelato tasks at https://app.gelato.network",
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Task configurations saved to: ${outputPath}`);
}

/**
 * Display programmatic task creation code
 */
function displayProgrammaticCode(config: GelatoTaskConfig): void {
  console.log("\n" + "=".repeat(80));
  console.log("💻 PROGRAMMATIC TASK CREATION (Advanced)");
  console.log("=".repeat(80));
  
  console.log("\nIf you want to create tasks programmatically using Gelato SDK:");
  console.log("\n```typescript");
  console.log("import { GelatoOpsSDK } from '@gelatonetwork/ops-sdk';");
  console.log("");
  console.log("const gelatoOps = new GelatoOpsSDK(chainId, signer);");
  console.log("");
  console.log("const taskArgs = {");
  console.log(`  name: "${config.name}",`);
  console.log(`  execAddress: "${config.contractAddress}",`);
  console.log("  execSelector: '0x...', // executeSweep(address) selector");
  console.log("  resolverAddress: '${config.contractAddress}',");
  console.log("  resolverData: {");
  console.log("    function: 'checker',");
  console.log(`    args: ["${config.userAddress}"]`);
  console.log("  },");
  console.log("  dedicatedMsgSender: true,");
  console.log("  useTreasury: false, // Use 1Balance");
  console.log("  singleExec: false,");
  console.log("};");
  console.log("");
  console.log("const { taskId } = await gelatoOps.createTask(taskArgs);");
  console.log("console.log('Task created:', taskId);");
  console.log("```");
  console.log("\n" + "=".repeat(80));
}

/**
 * Main execution function
 */
async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🤖 GELATO TASK CREATION SCRIPT FOR SWEEPKEEPER");
  console.log("=".repeat(80));
  
  // Get network information
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "hardhat" : network.name;
  const chainId = Number(network.chainId);
  
  console.log(`\nNetwork: ${networkName}`);
  console.log(`Chain ID: ${chainId}`);
  
  // Load deployment information
  const deployment = loadDeploymentInfo(networkName, chainId);
  if (!deployment) {
    process.exit(1);
  }
  
  const sweepKeeperAddress = deployment.contracts.sweepKeeper;
  console.log(`\nSweepKeeper Address: ${sweepKeeperAddress}`);
  
  // Verify SweepKeeper configuration
  const isConfigValid = await verifySweepKeeperConfig(sweepKeeperAddress);
  if (!isConfigValid) {
    console.error("\n❌ SweepKeeper configuration is invalid");
    console.log("Please fix the configuration before creating Gelato tasks");
    process.exit(1);
  }
  
  // Get authorized users
  const authorizedUsers = await getAuthorizedUsers(sweepKeeperAddress);
  
  if (authorizedUsers.length === 0) {
    console.log("\n⚠️  No authorized users found");
    console.log("Users must call authorizeAutoSweep() before tasks can be created");
    console.log("\nYou can still create task configurations for future use.");
    
    // Prompt for manual user address entry
    console.log("\nTo create a task configuration for a specific user,");
    console.log("edit this script and add the user address manually.");
    process.exit(0);
  }
  
  // Test checker for each user
  console.log("\n" + "=".repeat(80));
  console.log("TESTING CHECKER FUNCTION");
  console.log("=".repeat(80));
  
  for (const user of authorizedUsers) {
    await testChecker(sweepKeeperAddress, user);
  }
  
  // Generate task configurations
  console.log("\n" + "=".repeat(80));
  console.log("GENERATING TASK CONFIGURATIONS");
  console.log("=".repeat(80));
  
  const taskConfigs = authorizedUsers.map(user =>
    generateTaskConfig(sweepKeeperAddress, user, networkName, chainId)
  );
  
  // Save configurations to file
  saveTaskConfig(taskConfigs);
  
  // Display instructions for each task
  for (const config of taskConfigs) {
    displayTaskInstructions(config);
  }
  
  // Display programmatic creation code (for first user as example)
  if (taskConfigs.length > 0) {
    displayProgrammaticCode(taskConfigs[0]);
  }
  
  // Final summary
  console.log("\n" + "=".repeat(80));
  console.log("✅ TASK CREATION SCRIPT COMPLETE");
  console.log("=".repeat(80));
  
  console.log(`\n📊 Summary:`);
  console.log(`  - Network: ${networkName} (Chain ID: ${chainId})`);
  console.log(`  - SweepKeeper: ${sweepKeeperAddress}`);
  console.log(`  - Authorized Users: ${authorizedUsers.length}`);
  console.log(`  - Tasks to Create: ${taskConfigs.length}`);
  
  console.log(`\n📚 Next Steps:`);
  console.log(`  1. Review the task configurations in gelato-tasks.json`);
  console.log(`  2. Visit https://app.gelato.network/new-task`);
  console.log(`  3. Create tasks using the configurations above`);
  console.log(`  4. Fund your Gelato 1Balance with MNT tokens`);
  console.log(`  5. Monitor task execution at https://app.gelato.network/tasks`);
  
  console.log(`\n📖 Documentation:`);
  console.log(`  - Gelato Setup Guide: contracts/GELATO_SETUP.md`);
  console.log(`  - Gelato Network Docs: https://docs.gelato.network`);
  
  console.log("\n" + "=".repeat(80) + "\n");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
