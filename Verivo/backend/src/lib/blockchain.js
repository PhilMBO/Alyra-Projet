const fs = require("fs");
const path = require("path");
const { createPublicClient, createWalletClient, http, defineChain } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { hardhat, mainnet, polygon, polygonAmoy, sepolia } = require("viem/chains");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);
const OPERATOR_PK = process.env.VERIVO_OPERATOR_PRIVATE_KEY;

if (!OPERATOR_PK) {
  throw new Error("VERIVO_OPERATOR_PRIVATE_KEY manquant dans .env");
}
if (!OPERATOR_PK.startsWith("0x")) {
  throw new Error("VERIVO_OPERATOR_PRIVATE_KEY doit commencer par 0x");
}

// Selection de la chain viem selon l'id
function pickChain(chainId) {
  switch (chainId) {
    case 31337: return hardhat;
    case 1: return mainnet;
    case 137: return polygon;
    case 80002: return polygonAmoy;
    case 11155111: return sepolia;
    default:
      // Chain custom (ex : tenderly, fork) : on en definit une minimale
      return defineChain({
        id: chainId,
        name: `chain-${chainId}`,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
      });
  }
}

const chain = pickChain(CHAIN_ID);

// Client de lecture (view calls, waitForTransactionReceipt, etc.)
const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

// Compte operateur (Verivo) pour signer les transactions
const operatorAccount = privateKeyToAccount(OPERATOR_PK);

// Client d'ecriture (deploy contract, call tx)
const walletClient = createWalletClient({
  account: operatorAccount,
  chain,
  transport: http(RPC_URL),
});

// Chemins des artifacts Hardhat (mont  a /app/blockchain/artifacts dans le container)
const ARTIFACTS_BASE = process.env.VERIVO_ARTIFACTS_PATH
  ? path.resolve(process.env.VERIVO_ARTIFACTS_PATH)
  : path.resolve(process.cwd(), "blockchain", "artifacts", "contracts");

function loadArtifact(contractName) {
  const p = path.join(ARTIFACTS_BASE, `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact introuvable : ${p}. Compiler : cd blockchain && npx hardhat compile`);
  }
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

const factoryArtifact = loadArtifact("VerivoVotingFactory");
const votingArtifact = loadArtifact("VerivoVoting");
const votingNftArtifact = loadArtifact("VerivoVotingNFT");

const BLOCK_EXPLORER_URL = process.env.BLOCK_EXPLORER_URL || "";

function explorerTx(hash) {
  if (!hash || !BLOCK_EXPLORER_URL) return null;
  return `${BLOCK_EXPLORER_URL}/tx/${hash}`;
}

function explorerAddress(address) {
  if (!address || !BLOCK_EXPLORER_URL) return null;
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}

module.exports = {
  publicClient,
  walletClient,
  operatorAccount,
  chain,
  factoryArtifact,
  votingArtifact,
  votingNftArtifact,
  explorerTx,
  explorerAddress,
};
