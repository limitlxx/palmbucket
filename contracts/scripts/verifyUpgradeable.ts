import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n=== Verifying Upgradeable Contracts on Mantlescan ===\n");

  // Load deployment info
  const deploymentsPath = path.join(__dirname, "../../deploymentsUpgradeable.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deploymentsUpgradeable.json not found");
  }

  const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const networkKey = "mantle_sepolia_5003";
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    throw new Error("No deployment found for Mantle Sepolia");
  }

  console.log("Network:", deployment.network);
  console.log("Chain ID:", deployment.chainId);
  console.log();

  const contracts = [
    { name: "MockERC20 (USDC)", address: deployment.contracts.mockUSDC },
    { name: "BillsVault Proxy", address: deployment.contracts.billsVault },
    { name: "SavingsVault Proxy", address: deployment.contracts.savingsVault },
    { name: "GrowthVault Proxy", address: deployment.contracts.growthVault },
    { name: "SpendableVault Proxy", address: deployment.contracts.spendableVault },
    { name: "PaymentRouter Proxy", address: deployment.contracts.paymentRouter },
    { name: "SweepKeeper Proxy", address: deployment.contracts.sweepKeeper },
  ];

  for (const contract of contracts) {
    console.log(`Verifying ${contract.name}...`);
    console.log(`Address: ${contract.address}`);
    
    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: [],
      });
      console.log(`✓ ${contract.name} verified\n`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✓ ${contract.name} already verified\n`);
      } else {
        console.log(`✗ ${contract.name} verification failed:`);
        console.log(error.message);
        console.log();
      }
    }
  }

  console.log("=== Verification Complete ===\n");
  console.log("Note: Proxy contracts may show as 'Already Verified' if OpenZeppelin");
  console.log("automatically verified them during deployment.\n");
  console.log("Implementation contracts are automatically verified by the upgrades plugin.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
