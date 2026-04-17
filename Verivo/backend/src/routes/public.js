const express = require("express");
const rateLimit = require("express-rate-limit");
const { PrismaClient } = require("@prisma/client");
const {
  publicClient,
  votingArtifact,
  explorerAddress,
} = require("../lib/blockchain");

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiter : 60 requetes / 15 min / IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requetes, reessayez plus tard" },
});

router.use(limiter);

// ============================================================
// GET /api/public/organizations/:orgSlug/elections/:id/results
// ============================================================
// Resultats publics, sans authentification.
// Accessible uniquement aux scrutins depouilles.

router.get("/organizations/:orgSlug/elections/:id/results", async (req, res) => {
  try {
    // 1. Resoudre l'organisation
    const organization = await prisma.organization.findUnique({
      where: { slug: req.params.orgSlug },
    });
    if (!organization) {
      return res.status(404).json({ error: "Organisation introuvable" });
    }
    const s = `"${organization.schemaName}"`;

    // 2. Charger l'election + choix + inscrits
    const [electionRows, choicesRows, voterCountRow] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT id, title, description, voting_system AS "votingSystem",
           status, start_date AS "startDate", end_date AS "endDate",
           contract_address AS "contractAddress", quorum
         FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      ),
      prisma.$queryRawUnsafe(
        `SELECT id, label, description, position
         FROM ${s}.choices WHERE election_id = $1::uuid ORDER BY position`,
        req.params.id,
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM ${s}.voter_registry WHERE election_id = $1::uuid`,
        req.params.id,
      ),
    ]);

    if (electionRows.length === 0) {
      return res.status(404).json({ error: "Scrutin introuvable" });
    }
    const election = electionRows[0];
    const totalRegistered = voterCountRow[0].n;

    if (election.status !== "tallied") {
      return res.status(409).json({
        error: `Resultats non disponibles (statut : ${election.status})`,
      });
    }

    // 3. Lire on-chain pour coherence
    const [onChainResults, winningChoiceIndexRaw] = await Promise.all([
      publicClient.readContract({
        address: election.contractAddress,
        abi: votingArtifact.abi,
        functionName: "getResults",
      }),
      publicClient.readContract({
        address: election.contractAddress,
        abi: votingArtifact.abi,
        functionName: "winningChoiceIndex",
      }),
    ]);
    const voteCounts = onChainResults.map((v) => Number(v));
    const winningChoiceIndex = Number(winningChoiceIndexRaw);
    const totalVotes = voteCounts.reduce((sum, n) => sum + n, 0);

    // 4. Percentages + ranks
    const withPercentage = voteCounts.map((count, index) => ({
      index,
      voteCount: count,
      percentage: totalVotes > 0
        ? Math.round((count / totalVotes) * 10000) / 100
        : 0,
    }));
    const sorted = [...withPercentage].sort((a, b) => b.voteCount - a.voteCount);
    let rank = 0;
    let lastCount = -1;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].voteCount !== lastCount) {
        rank = i + 1;
        lastCount = sorted[i].voteCount;
      }
      sorted[i].rank = rank;
    }
    const scored = sorted.sort((a, b) => a.index - b.index);

    const participationRate = totalRegistered > 0
      ? Math.round((totalVotes / totalRegistered) * 10000) / 100
      : 0;

    res.json({
      election,
      organization: {
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
      },
      results: choicesRows.map((choice, i) => ({
        choiceId: choice.id,
        label: choice.label,
        description: choice.description,
        position: choice.position,
        voteCount: scored[i]?.voteCount || 0,
        percentage: scored[i]?.percentage || 0,
        rank: scored[i]?.rank || 0,
        isWinner: i === winningChoiceIndex,
      })),
      summary: {
        totalVotes,
        totalRegistered,
        participationRate,
        quorum: election.quorum || 0,
        quorumReached: totalVotes >= (election.quorum || 0),
        winningChoiceIndex,
        winningChoiceLabel: choicesRows[winningChoiceIndex]?.label || null,
      },
      explorerUrl: explorerAddress(election.contractAddress),
    });
  } catch (error) {
    console.error("Erreur /public/results :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
