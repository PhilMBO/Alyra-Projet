const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET manquant ou trop court (>= 32 caracteres)");
}

/**
 * Emet un JWT pour un utilisateur.
 * Claims :
 *   sub : user id (standard JWT)
 *   walletAddress : le wallet de l'user (pratique pour les checks cote client)
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      walletAddress: user.walletAddress,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };