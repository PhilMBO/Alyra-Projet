import hre from "hardhat";
import { formatEther } from "viem";

async function main() {
  console.log("=== Deploiement Verivo sur Sepolia ===\n");

  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });

  console.log("Deployeur    :", deployer.account.address);
  console.log("Balance      :", formatEther(balance), "ETH");
  console.log("Chain        :", await publicClient.getChainId());
  console.log();

  if (balance === 0n) {
    throw new Error(
      "Balance a 0 — abonde le wallet sur le faucet Sepolia avant de deployer."
    );
  }

  // ================================
  // Deploy VerivoVotingFactory
  // ================================
  console.log("Deploiement VerivoVotingFactory...");
  const factory = await viem.deployContract("VerivoVotingFactory");
  console.log("Factory      :", factory.address);
  console.log();

  // ================================
  // Instructions post-deploiement
  // ================================
  console.log("=== A copier dans backend/.env (Railway) ===\n");
  console.log(`VERIVO_FACTORY_ADDRESS=${factory.address}`);
  console.log(`RPC_URL=${process.env.SEPOLIA_RPC_URL}`);
  console.log(`CHAIN_ID=11155111`);
  console.log(`BLOCK_EXPLORER_URL=https://sepolia.etherscan.io`);
  console.log();
  console.log("=== Verifier sur Etherscan ===\n");
  console.log(
    `npx hardhat verify --network sepolia ${factory.address}`
  );
  console.log();
  console.log(
    `https://sepolia.etherscan.io/address/${factory.address}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
