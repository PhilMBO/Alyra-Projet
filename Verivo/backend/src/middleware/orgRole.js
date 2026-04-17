const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Factory : verifie que l'user connecte a un role suffisant dans l'organisation
 * identifiee par :orgSlug dans l'URL.
 *
 * Apres ce middleware, req.organization, req.schemaName et req.role sont dispo.
 *
 * Usage :
 *   router.post("/", authenticate, requireOrgRole(["ADMIN", "ORGANIZER"]), handler);
 */
function requireOrgRole(allowedRoles) {
  return async function (req, res, next) {
    const orgSlug = req.params.orgSlug;
    if (!orgSlug) {
      return res.status(400).json({ error: "orgSlug manquant" });
    }

    try {
      const organization = await prisma.organization.findUnique({
        where: { slug: orgSlug },
      });
      if (!organization) {
        return res.status(404).json({ error: "Organisation introuvable" });
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: req.userId,
          },
        },
      });
      if (!membership) {
        return res.status(403).json({ error: "Vous n'etes pas membre de cette organisation" });
      }

      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({
          error: `Role insuffisant. Requis : ${allowedRoles.join(" ou ")}`,
        });
      }

      req.organization = organization;
      req.schemaName = organization.schemaName;
      req.role = membership.role;
      next();
    } catch (error) {
      console.error("Erreur requireOrgRole :", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  };
}

module.exports = { requireOrgRole };
