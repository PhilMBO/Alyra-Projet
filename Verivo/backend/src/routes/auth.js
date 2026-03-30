const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "changeme-dev-secret";
const SALT_ROUNDS = 10;

function generateToken(admin) {
  return jwt.sign(
    { id: admin.id, role: admin.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function sanitizeAdmin(admin) {
  const { passwordHash, ...safe } = admin;
  return safe;
}

// POST /api/auth/login
const validateLogin = [
  body("email").isEmail().withMessage("Email invalide"),
  body("password").notEmpty().withMessage("Le mot de passe est requis"),
];

router.post("/login", validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { email: req.body.email },
    });
    if (!admin) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const valid = await bcrypt.compare(req.body.password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const token = generateToken(admin);
    res.json({ token, admin: sanitizeAdmin(admin) });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      include: { organizations: true },
    });

    if (!admin) {
      return res.status(404).json({ error: "Administrateur introuvable" });
    }

    res.json(sanitizeAdmin(admin));
  } catch (error) {
    return res.status(401).json({ error: "Token invalide" });
  }
});

module.exports = router;
