const Papa = require("papaparse");
const { getAddress } = require("viem");

/**
 * Parse un buffer CSV et retourne un tableau d'objets.
 * Papa Parse auto-detecte le separateur (virgule, point-virgule, tab).
 *
 * Colonnes reconnues : nom, prenom, email, club, wallet_address
 * Seul wallet_address est obligatoire (mode wallet-only).
 */
function parseCsv(buffer) {
  const csvString = buffer.toString("utf8");
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,      // on veut tout en string, on caste nous-meme
    transformHeader: (h) => h.toLowerCase().trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
    // delimiter vide = auto-detection (, ; \t)
    delimiter: "",
  });
  if (result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type === "Quotes" || e.type === "Delimiter");
    if (fatal) throw new Error(fatal.message);
  }
  return result.data;
}

/**
 * Valide une ligne CSV.
 * Wallet-only : wallet_address obligatoire.
 */
function validateRow(row, lineNum) {
  const errors = [];
  const hasWallet = row.wallet_address && row.wallet_address.length > 0;

  if (!hasWallet) {
    errors.push(`Ligne ${lineNum} : wallet_address obligatoire`);
    return { valid: false, errors };
  }

  let wallet;
  try {
    wallet = getAddress(row.wallet_address);
  } catch {
    errors.push(`Ligne ${lineNum} : adresse wallet invalide "${row.wallet_address}"`);
    return { valid: false, errors };
  }

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push(`Ligne ${lineNum} : email invalide "${row.email}"`);
  }

  const displayName =
    [row.prenom, row.nom].filter(Boolean).join(" ") ||
    `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  return {
    valid: true,
    errors: [],
    normalized: {
      walletAddress: wallet,
      displayName,
    },
  };
}

/**
 * Find-or-create user par wallet (wallet-only).
 */
async function findOrCreateUser(tx, normalized) {
  const existing = await tx.user.findUnique({
    where: { walletAddress: normalized.walletAddress },
  });
  if (existing) return { user: existing, created: false };

  const user = await tx.user.create({
    data: {
      walletAddress: normalized.walletAddress,
      displayName: normalized.displayName,
    },
  });
  return { user, created: true };
}

module.exports = { parseCsv, validateRow, findOrCreateUser };
