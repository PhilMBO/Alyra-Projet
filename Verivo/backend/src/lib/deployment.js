const { decodeEventLog } = require("viem");
const {
  publicClient,
  walletClient,
  factoryArtifact,
  votingNftArtifact,
} = require("./blockchain");

const FACTORY_ADDRESS = process.env.VERIVO_FACTORY_ADDRESS;
if (!FACTORY_ADDRESS) {
  console.warn(
    "WARN : VERIVO_FACTORY_ADDRESS manquant. Deployer la factory : npm run deploy:factory",
  );
}

/**
 * Deploie VerivoVotingNFT depuis le wallet operateur Verivo.
 * Le minter est adminWallet (l'admin de l'organisation).
 */
async function deployVotingNft(adminWallet, maximumVoters) {
  const hash = await walletClient.deployContract({
    abi: votingNftArtifact.abi,
    bytecode: votingNftArtifact.bytecode,
    args: [adminWallet, BigInt(maximumVoters)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("deployContract n'a pas renvoye d'adresse");
  }
  return {
    address: receipt.contractAddress,
    deployTxHash: hash,
  };
}

/**
 * Appelle VerivoVotingFactory.createVoting() pour deployer un VerivoVoting.
 * Parse l'event VotingCreated pour recuperer l'adresse du nouveau contrat.
 */
async function createVotingViaFactory({
  nftAddress,
  adminWallet,
  title,
  choices,
  votingDurationSeconds,
}) {
  if (!FACTORY_ADDRESS) {
    throw new Error("VERIVO_FACTORY_ADDRESS manquant");
  }

  const hash = await walletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: factoryArtifact.abi,
    functionName: "createVoting",
    args: [
      nftAddress,
      adminWallet,
      title,
      choices,
      BigInt(votingDurationSeconds),
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parser l'event VotingCreated(address indexed votingAddress, string title)
  let votingAddress = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: factoryArtifact.abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "VotingCreated") {
        votingAddress = decoded.args.votingAddress;
        break;
      }
    } catch {
      // log d'un autre contrat, ignorer
    }
  }

  if (!votingAddress) {
    throw new Error("Event VotingCreated non trouve dans le receipt");
  }

  return {
    address: votingAddress,
    createTxHash: hash,
  };
}

/**
 * Calcule la duree du scrutin en secondes.
 */
function computeDurationSeconds(startDate, endDate) {
  if (startDate && endDate) {
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 1000;
    return Math.max(Math.floor(diff), 60);
  }
  return 7 * 24 * 60 * 60;
}

module.exports = {
  deployVotingNft,
  createVotingViaFactory,
  computeDurationSeconds,
};
