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
  console.log("\n=== Updating .env.local with Contract Addresses ===\n");

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

  // Read current .env.local
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Update or add contract addresses
  const updates = {
    NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS: deployment.contracts.paymentRouter,
    NEXT_PUBLIC_BILLS_VAULT_ADDRESS: deployment.contracts.billsVault,
    NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS: deployment.contracts.savingsVault,
    NEXT_PUBLIC_GROWTH_VAULT_ADDRESS: deployment.contracts.growthVault,
    NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS: deployment.contracts.spendableVault,
    NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS: deployment.contracts.sweepKeeper,
  };

  // Update each variable
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      // Update existing variable
      envContent = envContent.replace(regex, `${key}=${value}`);
      console.log(`✓ Updated ${key}`);
    } else {
      // Add new variable
      envContent += `\n${key}=${value}`;
      console.log(`✓ Added ${key}`);
    }
  }

  // Write back to .env.local
  fs.writeFileSync(envPath, envContent);

  console.log("\n=== Contract Addresses Updated ===\n");
  console.log("Updated .env.local with the following addresses:");
  console.log("-------------------");
  for (const [key, value] of Object.entries(updates)) {
    console.log(`${key}=${value}`);
  }
  console.log("\n✓ .env.local updated successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Update failed:");
    console.error(error);
    process.exit(1);
  });
