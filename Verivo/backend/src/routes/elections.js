const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { requireOrgRole } = require("../middleware/orgRole");
const { parseCsv, validateRow, findOrCreateUser } = require("../lib/csvImport");
const {
  deployVotingNft,
  batchMintVotingNfts,
  createVotingViaFactory,
  computeDurationSeconds,
} = require("../lib/deployment");
const {
  explorerAddress,
  explorerTx,
  publicClient,
  votingArtifact,
  votingNftArtifact,
} = require("../lib/blockchain");

// Mapping enum on-chain → label DB
const STATUS_ON_CHAIN = ["draft", "open", "closed", "tallied"];

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

// Upload en memoire, max 10 Mo
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const VOTING_SYSTEMS = [
  "uninominal_1tour",
  "uninominal_2tours",
  "jugement_majoritaire",
  "approbation",
];
const CHOICE_TYPES = ["candidate", "proposal"];

// ============================================================
// POST /api/organizations/:orgSlug/elections
// ============================================================

const validateCreate = [
  body("title").trim().isLength({ min: 1, max: 255 }),
  body("description").optional().trim(),
  body("votingSystem").isIn(VOTING_SYSTEMS),
  body("choiceType").optional().isIn(CHOICE_TYPES),
  body("startDate").optional({ checkFalsy: true }).isISO8601(),
  body("endDate").optional({ checkFalsy: true }).isISO8601(),
  body("quorum").optional().isInt({ min: 0 }),
  body("choices").isArray({ min: 2 }).withMessage("Minimum 2 choix"),
  body("choices.*.label").trim().isLength({ min: 1, max: 255 }),
  body("choices.*.description").optional().trim(),
];

router.post(
  "/",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  validateCreate,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.body.startDate && req.body.endDate) {
      if (new Date(req.body.endDate) <= new Date(req.body.startDate)) {
        return res.status(400).json({ error: "endDate doit etre apres startDate" });
      }
    }

    const s = `"${req.schemaName}"`;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe(
          `INSERT INTO ${s}.elections
            (title, description, voting_system, choice_type, status, start_date, end_date, quorum, created_by)
          VALUES ($1, $2, $3::${s}.voting_system, $4::${s}.choice_type, 'draft', $5::timestamptz, $6::timestamptz, $7, $8::uuid)
          RETURNING *`,
          req.body.title,
          req.body.description || null,
          req.body.votingSystem,
          req.body.choiceType || "candidate",
          req.body.startDate || null,
          req.body.endDate || null,
          req.body.quorum || 0,
          req.userId,
        );
        const election = rows[0];

        const choices = [];
        for (let i = 0; i < req.body.choices.length; i++) {
          const c = req.body.choices[i];
          const cr = await tx.$queryRawUnsafe(
            `INSERT INTO ${s}.choices (election_id, label, description, position)
             VALUES ($1::uuid, $2, $3, $4)
             RETURNING *`,
            election.id,
            c.label,
            c.description || null,
            i,
          );
          choices.push(cr[0]);
        }

        return { election, choices };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Erreur POST /elections :", error);
      res.status(500).json({ error: "Erreur lors de la creation du scrutin" });
    }
  },
);

// ============================================================
// GET /api/organizations/:orgSlug/elections
// ============================================================

router.get(
  "/",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER", "MEMBER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;
    try {
      const elections = await prisma.$queryRawUnsafe(
        `SELECT
          e.id, e.title, e.description, e.voting_system AS "votingSystem",
          e.choice_type AS "choiceType", e.status, e.start_date AS "startDate",
          e.end_date AS "endDate", e.contract_address AS "contractAddress",
          e.quorum, e.created_at AS "createdAt",
          (SELECT COUNT(*)::int FROM ${s}.voter_registry vr WHERE vr.election_id = e.id) AS "voterCount",
          (SELECT COUNT(*)::int FROM ${s}.choices c WHERE c.election_id = e.id) AS "choiceCount"
        FROM ${s}.elections e
        ORDER BY e.created_at DESC`,
      );
      res.json(elections);
    } catch (error) {
      console.error("Erreur GET /elections :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// ============================================================
// GET /api/organizations/:orgSlug/elections/:id
// ============================================================

router.get(
  "/:id",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER", "MEMBER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;
    try {
      // Alias explicites pour le camelCase attendu par le frontend
      const elections = await prisma.$queryRawUnsafe(
        `SELECT
           id, title, description,
           voting_system    AS "votingSystem",
           choice_type      AS "choiceType",
           status,
           start_date       AS "startDate",
           end_date         AS "endDate",
           contract_address AS "contractAddress",
           quorum,
           created_by       AS "createdBy",
           created_at       AS "createdAt",
           updated_at       AS "updatedAt"
         FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );
      if (elections.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      const choices = await prisma.$queryRawUnsafe(
        `SELECT
           id, election_id AS "electionId", label, description, position,
           created_at AS "createdAt"
         FROM ${s}.choices WHERE election_id = $1::uuid ORDER BY position`,
        req.params.id,
      );

      res.json({ election: elections[0], choices });
    } catch (error) {
      console.error("Erreur GET /elections/:id :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// ============================================================
// DELETE /api/organizations/:orgSlug/elections/:id
// ============================================================

router.delete(
  "/:id",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;
    try {
      const current = await prisma.$queryRawUnsafe(
        `SELECT status FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );
      if (current.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      if (current[0].status !== "draft") {
        return res.status(409).json({
          error: "Seuls les scrutins en draft peuvent etre supprimes",
        });
      }

      // CASCADE supprime les choices, voter_registry, voter_nfts, participation_log
      await prisma.$queryRawUnsafe(
        `DELETE FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );

      res.json({ deleted: true });
    } catch (error) {
      console.error("Erreur DELETE /elections/:id :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// ============================================================
// GET /api/organizations/:orgSlug/elections/:id/voters
// ============================================================

router.get(
  "/:id/voters",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;
    try {
      const voters = await prisma.$queryRawUnsafe(
        `SELECT
           u.id AS "userId",
           u.wallet_address AS "walletAddress",
           u.display_name   AS "displayName",
           vr.eligible,
           vr.registered_at AS "registeredAt",
           vn.nft_status    AS "nftStatus",
           vn.token_id      AS "tokenId",
           vn.contract_address AS "nftContractAddress"
         FROM ${s}.voter_registry vr
         JOIN shared.users u ON u.id = vr.user_id
         LEFT JOIN ${s}.voter_nfts vn
           ON vn.election_id = vr.election_id
          AND vn.user_id = vr.user_id
          AND vn.nft_type = 'voting_right'
         WHERE vr.election_id = $1::uuid
         ORDER BY u.display_name`,
        req.params.id,
      );
      // Extraire l'adresse commune du contrat NFT (ou null si pas encore deploye)
      const nftContractAddress = voters.find((v) => v.nftContractAddress)?.nftContractAddress || null;
      res.json({ voters, count: voters.length, nftContractAddress });
    } catch (error) {
      console.error("Erreur GET /elections/:id/voters :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// ============================================================
// PUT /api/organizations/:orgSlug/elections/:id/choices
// ============================================================
// Remplace la totalite des choix (uniquement en draft).

router.put(
  "/:id/choices",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  [
    body("choices").isArray({ min: 2 }),
    body("choices.*.label").trim().isLength({ min: 1, max: 255 }),
    body("choices.*.description").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const s = `"${req.schemaName}"`;

    try {
      const current = await prisma.$queryRawUnsafe(
        `SELECT status FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );
      if (current.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      if (current[0].status !== "draft") {
        return res.status(409).json({ error: "Modification impossible : scrutin deja deploye" });
      }

      const choices = await prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(
          `DELETE FROM ${s}.choices WHERE election_id = $1::uuid`,
          req.params.id,
        );
        const inserted = [];
        for (let i = 0; i < req.body.choices.length; i++) {
          const c = req.body.choices[i];
          const r = await tx.$queryRawUnsafe(
            `INSERT INTO ${s}.choices (election_id, label, description, position)
             VALUES ($1::uuid, $2, $3, $4)
             RETURNING *`,
            req.params.id,
            c.label,
            c.description || null,
            i,
          );
          inserted.push(r[0]);
        }
        return inserted;
      });

      res.json({ choices });
    } catch (error) {
      console.error("Erreur PUT /choices :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// ============================================================
// PATCH /api/organizations/:orgSlug/elections/:id
// ============================================================

router.patch(
  "/:id",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;

    try {
      const current = await prisma.$queryRawUnsafe(
        `SELECT status FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );
      if (current.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      if (current[0].status !== "draft") {
        return res.status(409).json({
          error: "Seuls les scrutins en draft peuvent etre modifies",
        });
      }

      const updates = [];
      const values = [];
      let i = 1;
      const fieldMap = [
        ["title", "title", null],
        ["description", "description", null],
        ["startDate", "start_date", "timestamptz"],
        ["endDate", "end_date", "timestamptz"],
        ["quorum", "quorum", null],
      ];
      for (const [key, column, cast] of fieldMap) {
        if (req.body[key] !== undefined) {
          const placeholder = cast ? `$${i}::${cast}` : `$${i}`;
          updates.push(`${column} = ${placeholder}`);
          values.push(req.body[key]);
          i++;
        }
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: "Aucun champ a mettre a jour" });
      }
      values.push(req.params.id);

      const rows = await prisma.$queryRawUnsafe(
        `UPDATE ${s}.elections
         SET ${updates.join(", ")}, updated_at = now()
         WHERE id = $${i}::uuid
         RETURNING *`,
        ...values,
      );

      res.json(rows[0]);
    } catch (error) {
      console.error("Erreur PATCH /elections/:id :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

// ============================================================
// POST /api/organizations/:orgSlug/elections/:id/voters/import
// ============================================================

router.post(
  "/:id/voters/import",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Fichier manquant (champ 'file')" });
    }

    const s = `"${req.schemaName}"`;

    const el = await prisma.$queryRawUnsafe(
      `SELECT id, status FROM ${s}.elections WHERE id = $1::uuid`,
      req.params.id,
    );
    if (el.length === 0) {
      return res.status(404).json({ error: "Scrutin introuvable" });
    }
    if (el[0].status !== "draft") {
      return res.status(409).json({ error: "Import impossible : scrutin deja deploye" });
    }

    let rows;
    try {
      rows = parseCsv(req.file.buffer);
    } catch (error) {
      return res.status(400).json({ error: "CSV mal forme : " + error.message });
    }
    if (rows.length === 0) {
      return res.status(400).json({ error: "CSV vide ou sans header" });
    }

    const result = {
      imported: 0,
      created: 0,
      skipped: 0,
      rejected: 0,
      errors: [],
      voters: [],
    };

    try {
      await prisma.$transaction(async (tx) => {
        for (let lineNum = 2; lineNum <= rows.length + 1; lineNum++) {
          const row = rows[lineNum - 2];
          const validation = validateRow(row, lineNum);
          if (!validation.valid) {
            result.errors.push(...validation.errors);
            result.rejected++;
            continue;
          }

          const { user, created } = await findOrCreateUser(tx, validation.normalized);
          if (created) result.created++;

          await tx.organizationMember.upsert({
            where: {
              organizationId_userId: {
                organizationId: req.organization.id,
                userId: user.id,
              },
            },
            create: {
              organizationId: req.organization.id,
              userId: user.id,
              role: "MEMBER",
            },
            update: {},
          });

          const existing = await tx.$queryRawUnsafe(
            `SELECT 1 FROM ${s}.voter_registry
             WHERE election_id = $1::uuid AND user_id = $2::uuid`,
            req.params.id,
            user.id,
          );
          if (existing.length > 0) {
            result.skipped++;
            continue;
          }

          await tx.$queryRawUnsafe(
            `INSERT INTO ${s}.voter_registry (election_id, user_id, eligible)
             VALUES ($1::uuid, $2::uuid, true)`,
            req.params.id,
            user.id,
          );

          await tx.$queryRawUnsafe(
            `INSERT INTO ${s}.voter_nfts (election_id, user_id, nft_type, nft_status)
             VALUES ($1::uuid, $2::uuid, 'voting_right', 'pending')
             ON CONFLICT (election_id, user_id, nft_type) DO NOTHING`,
            req.params.id,
            user.id,
          );

          result.imported++;
          result.voters.push({
            userId: user.id,
            walletAddress: user.walletAddress,
            displayName: user.displayName,
            created,
          });
        }
      }, { timeout: 30000 });

      res.json(result);
    } catch (error) {
      console.error("Erreur import CSV :", error);
      res.status(500).json({ error: "Erreur lors de l'import", detail: error.message });
    }
  },
);

// ============================================================
// POST /api/organizations/:orgSlug/elections/:id/deploy
// ============================================================
// Deploiement on-chain :
//   1. Deploie VerivoVotingNFT (minter = adminWallet de l'org)
//   2. Appelle Factory.createVoting pour deployer VerivoVoting
//   3. Enregistre contract_address + nft_contract_address en DB
//   4. Laisse status = 'draft' (l'admin ouvrira via openVoting depuis son wallet)
//
// Cote Verivo : paie le gas du deploiement.
// Cote admin : recoit le MINTER_ROLE et appellera safeMintBatch depuis son wallet.

router.post(
  "/:id/deploy",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;

    try {
      // 1. Charger election + choix + votants
      const [electionRows, choicesRows, votersRows] = await Promise.all([
        prisma.$queryRawUnsafe(`SELECT * FROM ${s}.elections WHERE id = $1::uuid`, req.params.id),
        prisma.$queryRawUnsafe(
          `SELECT label FROM ${s}.choices WHERE election_id = $1::uuid ORDER BY position`,
          req.params.id,
        ),
        prisma.$queryRawUnsafe(
          `SELECT vr.user_id, u.wallet_address
           FROM ${s}.voter_registry vr
           JOIN shared.users u ON u.id = vr.user_id
           WHERE vr.election_id = $1::uuid AND vr.eligible = true`,
          req.params.id,
        ),
      ]);

      if (electionRows.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      const election = electionRows[0];

      // 2. Verifier les prerequis
      if (election.status !== "draft") {
        return res.status(409).json({ error: "Scrutin deja deploye ou non-draft" });
      }
      if (election.contract_address) {
        return res.status(409).json({ error: "Contrat deja deploye" });
      }
      if (choicesRows.length < 2) {
        return res.status(400).json({ error: "Minimum 2 choix requis" });
      }
      if (votersRows.length === 0) {
        return res.status(400).json({ error: "Aucun votant inscrit" });
      }

      // 3. Determiner le wallet admin de l'organisation
      const adminMember = await prisma.organizationMember.findFirst({
        where: { organizationId: req.organization.id, role: "ADMIN" },
        include: { user: true },
      });
      if (!adminMember) {
        return res.status(500).json({ error: "Pas d'admin pour cette organisation" });
      }
      const adminWallet = adminMember.user.walletAddress;

      // 4. Calculer la duree
      const durationSeconds = computeDurationSeconds(election.start_date, election.end_date);

      // 5. Deployer le contrat NFT
      console.log(`[deploy] Deploiement VerivoVotingNFT pour ${election.title}...`);
      const nftDeploy = await deployVotingNft(adminWallet, votersRows.length);
      console.log(`[deploy] NFT deployee : ${nftDeploy.address}`);

      // 6. Batch mint des NFTs (Verivo s'auto-grant MINTER_ROLE temporairement)
      console.log(`[deploy] Mint de ${votersRows.length} NFTs de vote...`);
      const mintResult = await batchMintVotingNfts(
        nftDeploy.address,
        votersRows.map((v) => ({ walletAddress: v.wallet_address })),
      );
      console.log(`[deploy] Mint termine : ${mintResult.mintTxHash}`);

      // 7. Deployer le contrat Voting via Factory
      console.log(`[deploy] Creation VerivoVoting via Factory...`);
      const votingDeploy = await createVotingViaFactory({
        nftAddress: nftDeploy.address,
        adminWallet,
        title: election.title,
        choices: choicesRows.map((c) => c.label),
        votingDurationSeconds: durationSeconds,
      });
      console.log(`[deploy] Voting deployee : ${votingDeploy.address}`);

      // 8. Mettre a jour la DB
      await prisma.$transaction(async (tx) => {
        // Sauvegarder l'adresse du contrat Voting sur l'election
        await tx.$queryRawUnsafe(
          `UPDATE ${s}.elections
           SET contract_address = $1, updated_at = now()
           WHERE id = $2::uuid`,
          votingDeploy.address,
          election.id,
        );

        // Marquer tous les voter_nfts comme mintes
        await tx.$queryRawUnsafe(
          `UPDATE ${s}.voter_nfts
           SET contract_address = $1,
               nft_status = 'minted',
               mint_tx_hash = $2,
               minted_at = now()
           WHERE election_id = $3::uuid
             AND nft_type = 'voting_right'
             AND nft_status = 'pending'`,
          nftDeploy.address,
          mintResult.mintTxHash,
          election.id,
        );
      }, { timeout: 30000 });

      // 9. Reponse
      res.json({
        contractAddress: votingDeploy.address,
        nftContractAddress: nftDeploy.address,
        deployTxHash: votingDeploy.createTxHash,
        nftDeployTxHash: nftDeploy.deployTxHash,
        mintTxHash: mintResult.mintTxHash,
        totalVoters: votersRows.length,
        mintedCount: votersRows.length,
        durationSeconds,
        adminWallet,
        explorerUrl: explorerAddress(votingDeploy.address),
        nftExplorerUrl: explorerAddress(nftDeploy.address),
        nextStep: "admin_open",
      });
    } catch (error) {
      console.error("Erreur /deploy :", error);
      if (error.code === "INSUFFICIENT_FUNDS") {
        return res.status(500).json({
          error: "Wallet operateur Verivo sans gas. Funder l'adresse.",
          code: "INSUFFICIENT_FUNDS",
        });
      }
      if (error.code === "NETWORK_ERROR" || error.code === "ECONNREFUSED") {
        return res.status(503).json({
          error: "RPC injoignable. Verifier RPC_URL.",
          code: "RPC_DOWN",
        });
      }
      res.status(500).json({ error: "Echec deploiement", detail: error.message });
    }
  },
);

// ============================================================
// POST /api/organizations/:orgSlug/elections/:id/sync
// ============================================================
// Synchronise l'etat DB avec la blockchain apres une action on-chain
// (mint de NFTs ou openVoting/closeVoting/tally par l'admin).
//
// Lit :
//   - VerivoVoting.status() → met a jour elections.status
//   - VerivoVotingNFT.balanceOf(wallet) pour chaque voter_registry
//     → met a jour voter_nfts.nft_status = 'minted' si balance > 0

router.post(
  "/:id/sync",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER", "MEMBER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;

    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, contract_address, status FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      const election = rows[0];
      if (!election.contract_address) {
        return res.status(409).json({ error: "Scrutin non deploye" });
      }

      // 1. Lire le status on-chain
      const statusRaw = Number(
        await publicClient.readContract({
          address: election.contract_address,
          abi: votingArtifact.abi,
          functionName: "status",
        })
      );
      const newStatus = STATUS_ON_CHAIN[statusRaw] || "draft";

      // 2. Trouver l'adresse du contrat NFT (via voting.votingNFT())
      const nftAddress = await publicClient.readContract({
        address: election.contract_address,
        abi: votingArtifact.abi,
        functionName: "votingNFT",
      });

      // 3. Lire les votants inscrits et verifier leur balanceOf
      const voters = await prisma.$queryRawUnsafe(
        `SELECT vr.user_id, u.wallet_address
         FROM ${s}.voter_registry vr
         JOIN shared.users u ON u.id = vr.user_id
         WHERE vr.election_id = $1::uuid`,
        req.params.id,
      );

      // Lecture en parallele des balanceOf et hasVoted (multicall manuelle)
      const [balances, votedFlags] = await Promise.all([
        Promise.all(
          voters.map((voter) =>
            publicClient.readContract({
              address: nftAddress,
              abi: votingNftArtifact.abi,
              functionName: "balanceOf",
              args: [voter.wallet_address],
            })
          )
        ),
        Promise.all(
          voters.map((voter) =>
            publicClient.readContract({
              address: election.contract_address,
              abi: votingArtifact.abi,
              functionName: "hasVoted",
              args: [voter.wallet_address],
            })
          )
        ),
      ]);
      let mintedCount = 0;
      for (const b of balances) {
        if (Number(b) > 0) mintedCount++;
      }
      const votedCount = votedFlags.filter((v) => v === true).length;

      // 4. Mettre a jour la DB en transaction
      await prisma.$transaction(async (tx) => {
        if (newStatus !== election.status) {
          await tx.$queryRawUnsafe(
            `UPDATE ${s}.elections
             SET status = $1::${s}.election_status, updated_at = now()
             WHERE id = $2::uuid`,
            newStatus,
            election.id,
          );
        }

        for (let i = 0; i < voters.length; i++) {
          const voter = voters[i];
          const n = Number(balances[i]);
          if (n > 0) {
            await tx.$queryRawUnsafe(
              `UPDATE ${s}.voter_nfts
               SET nft_status = 'minted',
                   contract_address = $1,
                   minted_at = COALESCE(minted_at, now())
               WHERE election_id = $2::uuid
                 AND user_id = $3::uuid
                 AND nft_type = 'voting_right'`,
              nftAddress,
              election.id,
              voter.user_id,
            );
          }

          // Upsert participation_log pour les votants ayant vote on-chain
          if (votedFlags[i] === true) {
            await tx.$queryRawUnsafe(
              `INSERT INTO ${s}.participation_log (election_id, user_id, has_voted, voted_at)
               VALUES ($1::uuid, $2::uuid, true, now())
               ON CONFLICT (election_id, user_id)
               DO UPDATE SET has_voted = true`,
              election.id,
              voter.user_id,
            );
          }
        }
      }, { timeout: 30000 });

      res.json({
        status: newStatus,
        mintedCount,
        votedCount,
        totalVoters: voters.length,
        onChain: {
          status: newStatus,
          nftAddress,
          votingAddress: election.contract_address,
        },
      });
    } catch (error) {
      console.error("Erreur /sync :", error);
      res.status(500).json({ error: "Erreur de synchronisation", detail: error.message });
    }
  },
);

// ============================================================
// GET /api/organizations/:orgSlug/elections/:id/results
// ============================================================
// Retourne les resultats du scrutin depouille.
// Lit on-chain getResults() + winningChoiceIndex + totalVotes.
// Persiste dans election_results pour acces rapide.

router.get(
  "/:id/results",
  authenticate,
  requireOrgRole(["ADMIN", "ORGANIZER", "MEMBER"]),
  async (req, res) => {
    const s = `"${req.schemaName}"`;

    try {
      // 1. Charger l'election + ses choix + la liste des votants
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

      if (!election.contractAddress) {
        return res.status(409).json({ error: "Scrutin non deploye" });
      }
      if (election.status !== "tallied") {
        return res.status(409).json({
          error: `Resultats disponibles uniquement apres depouillement (statut actuel : ${election.status})`,
        });
      }

      // 2. Lire on-chain : getResults, winningChoiceIndex
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

      // 3. Calculer percentages + ranks
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

      // 4. Persister election_results (idempotent)
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < choicesRows.length; i++) {
          const choice = choicesRows[i];
          const result = scored[i];
          if (!result) continue;
          await tx.$queryRawUnsafe(
            `INSERT INTO ${s}.election_results (election_id, choice_id, vote_count, percentage, rank)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5)
             ON CONFLICT (election_id, choice_id)
             DO UPDATE SET vote_count = EXCLUDED.vote_count,
                           percentage = EXCLUDED.percentage,
                           rank = EXCLUDED.rank,
                           tallied_at = now()`,
            election.id, choice.id, result.voteCount, result.percentage, result.rank,
          );
        }
      }, { timeout: 15000 });

      // 5. Construire la reponse
      const participationRate = totalRegistered > 0
        ? Math.round((totalVotes / totalRegistered) * 10000) / 100
        : 0;

      res.json({
        election,
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
      console.error("Erreur /results :", error);
      res.status(500).json({ error: "Erreur serveur", detail: error.message });
    }
  },
);

module.exports = router;
