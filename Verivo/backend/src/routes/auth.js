const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAddress } = require("ethers");
const { PrismaClient } = require("@prisma/client");

const { verifySiwe, SiweVerificationError } = require("../lib/siwe");
const { createTenantSchema, slugToSchemaName } = require("../lib/tenant");
const { signToken } = require("../lib/jwt");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ==============================================
// Helpers
// ==============================================

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

class ConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ==============================================
// POST /api/auth/register
// ==============================================

const validateRegister = [
  body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/).withMessage("walletAddress invalide"),
  body("signature").notEmpty(),
  body("message").notEmpty(),
  body("displayName").trim().isLength({ min: 2, max: 255 }),
  body("organization.name").trim().isLength({ min: 1, max: 255 }),
  body("organization.slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Slug invalide"),
  body("organization.logoUrl").optional({ checkFalsy: true }).isURL(),
];

router.post("/register", validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { displayName, organization } = req.body;

  // ---------- 1. Verifier la signature SIWE ----------
  let walletAddress;
  try {
    const result = await verifySiwe(req.body.message, req.body.signature);
    const declaredAddress = getAddress(req.body.walletAddress);
    if (result.address !== declaredAddress) {
      return res.status(401).json({ error: "Adresse non coherente" });
    }
    walletAddress = result.address;
  } catch (error) {
    if (error instanceof SiweVerificationError) {
      return res.status(401).json({ error: error.message, code: error.code });
    }
    throw error;
  }

  // ---------- 2. Calculer le slug et le schema_name ----------
  const slug = organization.slug || slugify(organization.name);
  const schemaName = slugToSchemaName(slug);

  // ---------- 3. Transaction atomique ----------
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 3.0 — Verifier unicite (les contraintes DB font aussi le job, on remonte juste des messages clairs)
      const existingUser = await tx.user.findUnique({ where: { walletAddress } });
      if (existingUser) throw new ConflictError("WALLET_EXISTS", "Wallet deja utilise");

      const existingOrg = await tx.organization.findUnique({ where: { slug } });
      if (existingOrg) throw new ConflictError("SLUG_EXISTS", "Slug deja utilise");

      // 3.1 — Creer le User
      const user = await tx.user.create({
        data: {
          walletAddress,
          displayName,
        },
      });

      // 3.2 — Creer l'Organization
      const org = await tx.organization.create({
        data: {
          name: organization.name,
          slug,
          schemaName,
          logoUrl: organization.logoUrl || null,
        },
      });

      // 3.3 — Creer le lien OrganizationMember (role ADMIN)
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "ADMIN",
        },
      });

      // 3.4 — Creer le schema tenant
      //        Si ca echoue, toute la transaction rollback
      await createTenantSchema(tx, schemaName);

      return { user, organization: org };
    }, {
      timeout: 15000,
    });

    // ---------- 4. Emettre le JWT et repondre ----------
    const token = signToken(result.user);
    return res.status(201).json({
      user: result.user,
      organization: result.organization,
      token,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return res.status(409).json({ error: error.message, code: error.code });
    }
    console.error("Erreur /register :", error);
    return res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

// ==============================================
// POST /api/auth/wallet-login
// ==============================================
// Seul endpoint de connexion. Un wallet signe un message SIWE, on verifie,
// et si l'user existe on emet un JWT.

const validateWalletLogin = [
  body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/),
  body("signature").notEmpty(),
  body("message").notEmpty(),
];

router.post("/wallet-login", validateWalletLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // 1. Verifier la signature SIWE
  let address;
  try {
    const result = await verifySiwe(req.body.message, req.body.signature);
    address = result.address;
    if (address !== getAddress(req.body.walletAddress)) {
      return res.status(401).json({ error: "Adresse non coherente" });
    }
  } catch (error) {
    if (error instanceof SiweVerificationError) {
      return res.status(401).json({ error: error.message, code: error.code });
    }
    throw error;
  }

  // 2. Trouver le user dans la DB
  const user = await prisma.user.findUnique({ where: { walletAddress: address } });
  if (!user) {
    return res.status(404).json({
      error: "Wallet non enregistre",
      code: "USER_NOT_FOUND",
    });
  }

  // 3. Emettre le JWT
  const token = signToken(user);
  res.json({ user, token });
});

// ==============================================
// GET /api/auth/me
// ==============================================

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      memberships: { include: { organization: true } },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  // Le frontend (AuthProvider) fait data.user.*
  res.json({ user });
});

module.exports = router;