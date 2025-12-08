import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n=== Updating .env.local with V2 Contract Addresses ===\n");

  const deploymentsPath = path.join(__dirname, "..", "..", "deploymentsV2.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deploymentsV2.json not found");
  }

  const allDeployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const hre = require("hardhat");
  const networkKey = `${hre.network.name}_${hre.network.config.chainId}`;
  const deployment = allDeployments[networkKey];

  if (!deployment) {
    throw new Error(`No deployment found for network ${hre.network.name}`);
  }

  console.log("Network:", deployment.network);
  console.log("Chain ID:", deployment.chainId);

  const envPath = path.join(__dirname, "..", "..", ".env.local");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  const updates = {
    NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS: deployment.contracts.paymentRouter,
    NEXT_PUBLIC_BILLS_VAULT_ADDRESS: deployment.contracts.billsVault,
    NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS: deployment.contracts.savingsVault,
    NEXT_PUBLIC_GROWTH_VAULT_ADDRESS: deployment.contracts.growthVault,
    NEXT_PUBLIC_SPENDABLE_VAULT_ADDRESS: deployment.contracts.spendableVault,
    NEXT_PUBLIC_SWEEP_KEEPER_ADDRESS: deployment.contracts.sweepKeeper,
    NEXT_PUBLIC_MOCK_USDC_ADDRESS: deployment.contracts.mockUSDC,
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
      console.log(`✓ Updated ${key}`);
    } else {
      envContent += `\n${key}=${value}`;
      console.log(`✓ Added ${key}`);
    }
  }

  fs.writeFileSync(envPath, envContent);

  console.log("\n=== Contract Addresses Updated ===\n");
  console.log("Updated .env.local with V2 addresses:");
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
