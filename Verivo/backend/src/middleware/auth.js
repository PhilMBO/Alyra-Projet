const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "changeme-dev-secret";

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    req.adminId = decoded.id;
    req.adminRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalide ou expire" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Acces reserve au super administrateur" });
  }
  next();
}

module.exports = { authenticate, requireSuperAdmin };
