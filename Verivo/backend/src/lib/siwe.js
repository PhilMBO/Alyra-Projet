const { SiweMessage } = require("siwe");

const EXPECTED_DOMAIN = process.env.FRONTEND_DOMAIN || "localhost:3000";

/**
 * Verifie une signature SIWE
 *
 * @param {string} message    Le message SIWE brut (texte signe par le wallet)
 * @param {string} signature  La signature cryptographique du wallet (0x...)
 * @returns {Promise<{ address: string, chainId: number }>}
 * @throws {SiweVerificationError} si la signature est invalide
 */
async function verifySiwe(message, signature) {
  let siwe;
  try {
    // 1. Parser le message texte 
    siwe = new SiweMessage(message);
  } catch (error) {
    throw new SiweVerificationError("MESSAGE_INVALIDE", "Message SIWE mal forme");
  }

  // 2. Verifier que le domain correspond a notre frontend
  //    → Protege contre le phishing : signature volee sur un faux site
  //      non reutilisable sur verivo.io
  if (siwe.domain !== EXPECTED_DOMAIN) {
    throw new SiweVerificationError(
      "DOMAIN_INVALIDE",
      `Domain attendu "${EXPECTED_DOMAIN}", recu "${siwe.domain}"`
    );
  }

  // 3. Verifier la signature cryptographique
  //    verify() compare l'adresse declaree dans le message avec l'adresse qui
  //    a effectivement signe (derivee de la signature).
  let result;
  try {
    result = await siwe.verify({ signature });
  } catch (error) {
    throw new SiweVerificationError(
      "SIGNATURE_INVALIDE",
      "La signature ne correspond pas au message"
    );
  }

  if (!result.success) {
    throw new SiweVerificationError(
      "SIGNATURE_INVALIDE",
      result.error?.type || "Verification SIWE echouee"
    );
  }

  // 4. Verifier l'expiration si present dans le message
  if (siwe.expirationTime) {
    const expiresAt = new Date(siwe.expirationTime);
    if (expiresAt < new Date()) {
      throw new SiweVerificationError("MESSAGE_EXPIRE", "Message SIWE expire");
    }
  }

  return {
    address: siwe.address,       // Adresse du signataire (EIP-55 checksummed)
    chainId: siwe.chainId,
  };
}

class SiweVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SiweVerificationError";
    this.code = code;
  }
}

module.exports = { verifySiwe, SiweVerificationError };