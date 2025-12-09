import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n=== Updating .env.local with Upgradeable Contract Addresses ===\n");

  // Load deployment info
  const deploymentsPath = path.join(__dirname, "../../deploymentsUpgradeable.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deploymentsUpgradeable.json not found. Deploy contracts first.");
  }

  const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const networkKey = "mantle_sepolia_5003";
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    throw new Error("No deployment found for Mantle Sepolia");
  }

  console.log("Found deployment for:", deployment.network);
  console.log("Chain ID:", deployment.chainId);
  console.log();

  // Read current .env.local
  const envPath = path.join(__dirname, "../../.env.local");
  let envContent = fs.readFileSync(envPath, "utf8");

  // Update contract addresses
  const updates = {
    NEXT_PUBLIC_MOCK_USDC_ADDRESS: deployment.contracts.mockUSDC,
    NEXT_PUBLIC_BILLS_VAULT_ADDRESS: deployment.contracts.billsVault,
    NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS: deployment.contracts.savingsVault,
    NEXT_PUBLIC_GROWTH_VAULT_ADDRESS: deployment.contracts.growthVault,
    NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS: deployment.contracts.spendableVault,
    NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS: deployment.contracts.paymentRouter,
    NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS: deployment.contracts.sweepKeeper,
  };

  console.log("Updating addresses:");
  for (const [key, value] of Object.entries(updates)) {
    console.log(`  ${key}=${value}`);
    
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  // Write updated .env.local
  fs.writeFileSync(envPath, envContent);
  console.log("\n✓ .env.local updated successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
