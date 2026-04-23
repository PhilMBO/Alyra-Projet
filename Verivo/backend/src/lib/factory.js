const { publicClient, walletClient, factoryArtifact } = require("./blockchain");

let factoryAddress = process.env.VERIVO_FACTORY_ADDRESS || null;

async function waitForRpc(maxAttempts = 30, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await publicClient.getChainId();
      return;
    } catch (err) {
      if (i === maxAttempts) throw err;
      console.log(`[factory] RPC pas pret (tentative ${i}/${maxAttempts}), retry dans ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function isDeployed(address) {
  if (!address) return false;
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") return false;
  try {
    await publicClient.readContract({
      address,
      abi: factoryArtifact.abi,
      functionName: "getVotings",
    });
    return true;
  } catch {
    return false;
  }
}

async function deployFactory() {
  console.log("[factory] Deploiement VerivoVotingFactory...");
  const hash = await walletClient.deployContract({
    abi: factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode,
    args: [],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("deployContract n'a pas renvoye d'adresse");
  }
  return receipt.contractAddress;
}

async function ensureFactoryDeployed() {
  await waitForRpc();

  if (await isDeployed(factoryAddress)) {
    console.log(`[factory] Deja deployee a ${factoryAddress}`);
    return factoryAddress;
  }

  if (factoryAddress) {
    console.log(`[factory] Adresse ${factoryAddress} vide on-chain, redeploiement...`);
  }

  factoryAddress = await deployFactory();
  console.log(`[factory] Deployee a ${factoryAddress}`);
  return factoryAddress;
}

function getFactoryAddress() {
  return factoryAddress;
}

module.exports = { ensureFactoryDeployed, getFactoryAddress };
