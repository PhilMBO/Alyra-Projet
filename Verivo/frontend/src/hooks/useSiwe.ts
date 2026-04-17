"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

// Ce que le hook retourne apres une signature reussie
export interface SiweResult {
  message: string;     // Le message SIWE en texte brut
  signature: string;   // La signature cryptographique du wallet
}

export function useSiwe() {
  const { address } = useAccount();        // Adresse du wallet connecte
  const chainId = useChainId();            // ID de la blockchain active (ex: 137 pour Polygon)
  const { signMessageAsync } = useSignMessage();  // Fonction wagmi pour signer

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fonction principale : construit le message SIWE et le fait signer
  const signIn = useCallback(async (): Promise<SiweResult> => {
    if (!address) {
      throw new Error("Wallet non connecte");
    }
    setIsLoading(true);
    setError(null);
    try {
      // 1. Construire le message SIWE selon le standard EIP-4361
      const siweMessage = new SiweMessage({
        domain: window.location.host,         // "localhost:3000"
        address: address,                      // "0x1234...abcd"
        statement: "Connexion a Verivo",       // Message lisible par l'humain
        uri: window.location.origin,           // "http://localhost:3000"
        version: "1",                          // Version du standard SIWE
        chainId: chainId,                      // 137, 80002, etc.
        nonce: generateNonce(),                // Anti-replay (aleatoire)
        issuedAt: new Date().toISOString(),    // Horodatage
      });

      // 2. Convertir en texte brut
      const messageText = siweMessage.prepareMessage();

      // 3. Demander au wallet de signer
      //    → MetaMask affiche une popup avec le message
      //    → L'utilisateur clique "Sign"
      //    → Le wallet retourne la signature cryptographique
      const signature = await signMessageAsync({ message: messageText });

      return { message: messageText, signature };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur de signature";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  return { signIn, isLoading, error };
}

// Genere un nonce aleatoire de 16 caracteres
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}