/**
 * Script one-shot pour deployer VerivoVotingFactory sur le reseau cible.
 *
 * Prerequis :
 *   - Un noeud RPC accessible (ex: `cd blockchain && npx hardhat node`)
 *   - Les artifacts compiles dans blockchain/artifacts/
 *   - .env backend configure avec RPC_URL, CHAIN_ID, VERIVO_OPERATOR_PRIVATE_KEY
 *
 * Usage :
 *   node scripts/deployFactory.js
 *
 * Sortie : l'adresse du Factory. A recopier dans .env :
 *   VERIVO_FACTORY_ADDRESS=0x...
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatEther,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { hardhat, polygon, polygonAmoy, sepolia } = require("viem/chains");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);
const PRIVATE_KEY = process.env.VERIVO_OPERATOR_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("ERREUR : VERIVO_OPERATOR_PRIVATE_KEY manquant dans .env");
  process.exit(1);
}

function pickChain(id) {
  switch (id) {
    case 31337: return hardhat;
    case 137: return polygon;
    case 80002: return polygonAmoy;
    case 11155111: return sepolia;
    default:
      return defineChain({
        id,
        name: `chain-${id}`,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
      });
  }
}

const ARTIFACT_PATH = path.resolve(
  process.cwd(),
  "blockchain",
  "artifacts",
  "contracts",
  "VerivoVotingFactory.sol",
  "VerivoVotingFactory.json",
);

async function main() {
  console.log("RPC      :", RPC_URL);
  console.log("Chain ID :", CHAIN_ID);

  if (!fs.existsSync(ARTIFACT_PATH)) {
    console.error(`ERREUR : artifact introuvable a ${ARTIFACT_PATH}`);
    console.error("Compiler les contrats : cd blockchain && npx hardhat compile");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));

  const chain = pickChain(CHAIN_ID);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  console.log("Deployeur :", account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance   :", formatEther(balance), "ETH");
  if (balance === 0n) {
    console.error("ERREUR : deployeur sans gas. Funder le wallet.");
    process.exit(1);
  }

  console.log("Deploiement VerivoVotingFactory...");
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });
  console.log("Tx envoyee :", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    console.error("ERREUR : pas d'adresse dans le receipt");
    process.exit(1);
  }

  console.log();
  console.log("============================================================");
  console.log("VerivoVotingFactory deployee a :", receipt.contractAddress);
  console.log("============================================================");
  console.log();
  console.log("Copier dans backend/.env ou Verivo/.env :");
  console.log(`VERIVO_FACTORY_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error("Erreur deploiement :", err.message);
  process.exit(1);
});
