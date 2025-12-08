import { expect } from "chai";
import { ethers } from "hardhat";

describe("Setup Verification", function () {
  it("Should connect to Hardhat network", async function () {
    const [owner] = await ethers.getSigners();
    expect(owner.address).to.be.properAddress;
  });

  it("Should have correct network configuration", async function () {
    const network = await ethers.provider.getNetwork();
    expect(network.chainId).to.equal(BigInt(31337)); // Hardhat local network
  });
});