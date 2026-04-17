const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { explorerAddress, explorerTx } = require("../lib/blockchain");

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================
// GET /api/me/elections
// ============================================================
// Liste tous les scrutins ou l'utilisateur connecte est inscrit comme votant,
// toutes organisations confondues.

router.get("/elections", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        memberships: { include: { organization: true } },
      },
    });
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const allElections = [];

    // Une requete par tenant : on ne peut pas joindre cross-schema
    for (const membership of user.memberships) {
      const org = membership.organization;
      const s = `"${org.schemaName}"`;

      const rows = await prisma.$queryRawUnsafe(
        `SELECT
           e.id,
           e.title,
           e.description,
           e.voting_system    AS "votingSystem",
           e.choice_type      AS "choiceType",
           e.status,
           e.start_date       AS "startDate",
           e.end_date         AS "endDate",
           e.contract_address AS "contractAddress",
           vr.eligible,
           vn.token_id          AS "tokenId",
           vn.contract_address  AS "nftContractAddress",
           vn.nft_status        AS "nftStatus",
           vn.mint_tx_hash      AS "mintTxHash",
           pl.has_voted         AS "hasVoted",
           pl.voted_at          AS "votedAt",
           pl.tx_hash           AS "voteTxHash"
         FROM ${s}.voter_registry vr
         JOIN ${s}.elections e ON e.id = vr.election_id
         LEFT JOIN ${s}.voter_nfts vn
           ON vn.election_id = vr.election_id
          AND vn.user_id = vr.user_id
          AND vn.nft_type = 'voting_right'
         LEFT JOIN ${s}.participation_log pl
           ON pl.election_id = vr.election_id
          AND pl.user_id = vr.user_id
         WHERE vr.user_id = $1::uuid
         ORDER BY e.created_at DESC`,
        user.id,
      );

      for (const row of rows) {
        allElections.push({
          id: row.id,
          title: row.title,
          description: row.description,
          votingSystem: row.votingSystem,
          choiceType: row.choiceType,
          status: row.status,
          startDate: row.startDate,
          endDate: row.endDate,
          contractAddress: row.contractAddress,
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          participation: {
            eligible: row.eligible,
            hasVoted: row.hasVoted || false,
            votedAt: row.votedAt,
            voteTxHash: row.voteTxHash,
            voteExplorerUrl: explorerTx(row.voteTxHash),
            nft: row.nftStatus === "minted" || row.nftStatus === "pending"
              ? {
                  tokenId: row.tokenId != null ? String(row.tokenId) : null,
                  contractAddress: row.nftContractAddress,
                  status: row.nftStatus,
                  mintTxHash: row.mintTxHash,
                  mintExplorerUrl: explorerTx(row.mintTxHash),
                  contractExplorerUrl: explorerAddress(row.nftContractAddress),
                }
              : null,
          },
        });
      }
    }

    res.json({ elections: allElections });
  } catch (error) {
    console.error("Erreur /me/elections :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
