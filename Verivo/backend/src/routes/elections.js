const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { requireOrgRole } = require("../middleware/orgRole");

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

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
          VALUES ($1, $2, $3::${s}.voting_system, $4::${s}.choice_type, 'draft', $5, $6, $7, $8::uuid)
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

module.exports = router;
