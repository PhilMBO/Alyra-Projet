import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, hardhat } from "wagmi/chains";
import { http } from "wagmi";

// getDefaultConfig() cree une config wagmi + configure RainbowKit en meme temps
// C'est un raccourci fourni par RainbowKit pour eviter le boilerplate
export const config = getDefaultConfig({
  // Nom affiche dans les wallets lors de la connexion
  appName: "Verivo",

  // ID du projet WalletConnect (necessaire pour les wallets mobiles)
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,

  // Blockchains supportees par l'application
  chains: [sepolia, hardhat],

  // Comment se connecter a chaque blockchain
  // http() utilise le RPC public par defaut, sauf pour hardhat (local)
  transports: {
    [sepolia.id]:     http(),      // RPC public Sepolia testnet
    [hardhat.id]:     http("http://127.0.0.1:8545"),  // Noeud local
  },
  // IMPORTANT : active le mode SSR pour eviter les erreurs d'hydratation
  // Sans ca, le rendu serveur et client different → crash
  ssr: true,
});