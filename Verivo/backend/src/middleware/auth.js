const { verifyToken } = require("../lib/jwt");

/**
 * Valide le JWT et injecte req.userId + req.walletAddress.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const decoded = verifyToken(authHeader.split(" ")[1]);
    req.userId = decoded.sub;
    req.walletAddress = decoded.walletAddress;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalide ou expire" });
  }
}

module.exports = { authenticate };