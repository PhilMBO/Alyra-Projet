const { decodeEventLog, keccak256, toBytes } = require("viem");
const {
  publicClient,
  walletClient,
  operatorAccount,
  factoryArtifact,
  votingNftArtifact,
} = require("./blockchain");
const { getFactoryAddress } = require("./factory");

// MINTER_ROLE = keccak256("MINTER_ROLE") comme dans VerivoVotingNFT.sol
const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));

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
 * Mint en batch les NFTs de vote pour tous les votants.
 * Verivo s'auto-grant MINTER_ROLE (il a DEFAULT_ADMIN_ROLE), mint, puis revoke.
 * Resultat : admin org garde MINTER_ROLE, Verivo n'en a plus.
 */
async function batchMintVotingNfts(nftAddress, voters) {
  // 1. Grant MINTER_ROLE a Verivo operator
  const grantHash = await walletClient.writeContract({
    address: nftAddress,
    abi: votingNftArtifact.abi,
    functionName: "grantRole",
    args: [MINTER_ROLE, operatorAccount.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: grantHash });

  // 2. Construire le tableau VoterConfig { recipient, weight }
  const voterConfigs = voters.map((v) => ({
    recipient: v.walletAddress,
    weight: 1n,
  }));

  // 3. safeMintBatch
  const mintHash = await walletClient.writeContract({
    address: nftAddress,
    abi: votingNftArtifact.abi,
    functionName: "safeMintBatch",
    args: [voterConfigs],
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });

  // 4. Revoke MINTER_ROLE de Verivo
  const revokeHash = await walletClient.writeContract({
    address: nftAddress,
    abi: votingNftArtifact.abi,
    functionName: "revokeRole",
    args: [MINTER_ROLE, operatorAccount.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: revokeHash });

  return {
    mintTxHash: mintHash,
    mintBlockNumber: mintReceipt.blockNumber,
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
  const factoryAddress = getFactoryAddress();
  if (!factoryAddress) {
    throw new Error("Factory non deployee : verifier les logs de demarrage du backend");
  }

  const hash = await walletClient.writeContract({
    address: factoryAddress,
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
  batchMintVotingNfts,
  createVotingViaFactory,
  computeDurationSeconds,
};
