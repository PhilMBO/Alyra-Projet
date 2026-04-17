const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { requireOrgRole } = require("../middleware/orgRole");
const { parseCsv, validateRow, findOrCreateUser } = require("../lib/csvImport");

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
      const elections = await prisma.$queryRawUnsafe(
        `SELECT * FROM ${s}.elections WHERE id = $1::uuid`,
        req.params.id,
      );
      if (elections.length === 0) {
        return res.status(404).json({ error: "Scrutin introuvable" });
      }
      const choices = await prisma.$queryRawUnsafe(
        `SELECT * FROM ${s}.choices WHERE election_id = $1::uuid ORDER BY position`,
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

module.exports = router;
