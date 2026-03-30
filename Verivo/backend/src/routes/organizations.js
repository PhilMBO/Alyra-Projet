const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const validateOrganization = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Le nom de l'organisation est requis")
    .isLength({ max: 255 })
    .withMessage("Le nom ne doit pas depasser 255 caracteres"),
  body("slug")
    .trim()
    .notEmpty()
    .withMessage("Le slug est requis")
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Le slug ne doit contenir que des lettres minuscules, chiffres et tirets")
    .isLength({ max: 100 })
    .withMessage("Le slug ne doit pas depasser 100 caracteres"),
  body("logo")
    .optional()
    .trim()
    .isURL()
    .withMessage("Le logo doit etre une URL valide"),
  body("admin.email")
    .isEmail()
    .withMessage("L'email de l'administrateur est invalide"),
  body("admin.password")
    .isLength({ min: 8 })
    .withMessage("Le mot de passe doit contenir au moins 8 caracteres"),
  body("admin.displayName")
    .trim()
    .notEmpty()
    .withMessage("Le nom de l'administrateur est requis"),
];

// POST /api/organizations (super admin uniquement)
router.post("/", authenticate, requireSuperAdmin, validateOrganization, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: req.body.admin.email },
    });
    if (existingAdmin) {
      return res.status(409).json({ error: "Cet email administrateur est deja utilise" });
    }

    const passwordHash = await bcrypt.hash(req.body.admin.password, SALT_ROUNDS);

    const organization = await prisma.organization.create({
      data: {
        name: req.body.name,
        slug: req.body.slug,
        logo: req.body.logo || null,
        admin: {
          create: {
            email: req.body.admin.email,
            passwordHash,
            displayName: req.body.admin.displayName,
            role: "ORG_ADMIN",
          },
        },
      },
      include: { admin: { select: { id: true, email: true, displayName: true, role: true } } },
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce slug est deja utilise" });
    }
    res.status(500).json({ error: "Erreur lors de la creation de l'organisation" });
  }
});

// GET /api/organizations (admin connecte)
router.get("/", authenticate, async (req, res) => {
  try {
    const where = req.adminRole === "SUPER_ADMIN" ? {} : { adminId: req.adminId };
    const organizations = await prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { id: true, email: true, displayName: true, role: true } } },
    });
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Erreur lors de la recuperation des organisations" });
  }
});

module.exports = router;
