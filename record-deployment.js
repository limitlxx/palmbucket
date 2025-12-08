const fs = require('fs');

// Addresses from the successful deployment
const deployment = {
  "mantle_sepolia_5003": {
    "network": "mantle_sepolia",
    "chainId": 5003,
    "deployer": "0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a",
    "timestamp": new Date().toISOString(),
    "contracts": {
      "mockUSDC": "0xbFbb8ec57DD359060fBF24E61D7a2770bffC4971",
      "mockYieldProtocol": "0xcdA667De276B71F0fC32721d6480fC9Ff48C755B",
      "paymentRouter": "0x51C2bca840073ADc36dE3426580b6691F765aFB3",
      "billsVault": "0x7838393b1f1EB7F1583799797fFB34912c445E9D",
      "savingsVault": "0x2Fe9f813d4D4699AA19EC3e1453c4b390Ec5dF44",
      "growthVault": "0x056e553036Cb857521359FaE5B51361087E9b68f",
      "spendableVault": "0xF9B5cDa289211700EF7708707E969Fda018670E2",
      "sweepKeeper": "0xe9424bB6B6a2D03A0cd88c414cd6F98ca49bCCfA"
    }
  }
};

// Read existing deployments
let allDeployments = {};
if (fs.existsSync('deployments.json')) {
  allDeployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
}

// Merge
Object.assign(allDeployments, deployment);

// Write back
fs.writeFileSync('deployments.json', JSON.stringify(allDeployments, null, 2));

console.log('✓ Deployment addresses recorded to deployments.json');
console.log('\nContract Addresses:');
console.log('-------------------');
for (const [key, value] of Object.entries(deployment.mantle_sepolia_5003.contracts)) {
  console.log(`${key}: ${value}`);
}
