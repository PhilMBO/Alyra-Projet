const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/organizations
// Liste les organisations dont l'user connecte est membre.
router.get("/", authenticate, async (req, res) => {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.userId },
      include: { organization: true },
      orderBy: { joinedAt: "desc" },
    });

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      schemaName: m.organization.schemaName,
      logoUrl: m.organization.logoUrl,
      status: m.organization.status.toLowerCase(),
      role: m.role.toLowerCase(),
    }));

    res.json(organizations);
  } catch (error) {
    console.error("Erreur /organizations :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;