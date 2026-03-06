const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

const validateOrganization = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Le nom de l'organisation est requis")
    .isLength({ max: 255 })
    .withMessage("Le nom ne doit pas depasser 255 caracteres"),
  body("logo")
    .optional()
    .trim()
    .isURL()
    .withMessage("Le logo doit etre une URL valide"),
];

// POST /api/organizations
router.post("/", validateOrganization, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const organization = await prisma.organization.create({
      data: {
        name: req.body.name,
        logo: req.body.logo || null,
      },
    });
    res.status(201).json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ error: "Erreur lors de la creation de l'organisation" });
  }
});

// GET /api/organizations
router.get("/", async (req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Erreur lors de la recuperation des organisations" });
  }
});

module.exports = router;
