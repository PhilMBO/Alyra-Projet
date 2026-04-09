// === Modeles de donnees ===

// Utilisateur authentifie par wallet
export interface User {
  id: string;
  authMethod: "wallet";
  walletAddress: string;       // 0x... (42 caracteres)
  displayName: string;
}

// Organisation creee par un admin
export interface Organization {
  id: string;
  name: string;
  slug: string;                // URL-friendly : "federation-xyz"
  schemaName: string;          // Nom du schema tenant PostgreSQL
  status: "active" | "suspended" | "archived";
  logoUrl?: string;
}

// === Contrats API (request/response) ===

// Corps de la requete POST /api/auth/register (mode wallet)
export interface RegisterWalletRequest {
  authMethod: "wallet";
  walletAddress: string;
  signature: string;           // Signature SIWE du wallet
  message: string;             // Message SIWE signe
  displayName: string;
  organization: {
    name: string;
    slug?: string;             // Auto-genere si absent
    logoUrl?: string;
  };
}

// Reponse du POST /api/auth/register
export interface RegisterResponse {
  user: User;
  organization: Organization;
  token: string;               // JWT valide 24h
}
// === Etat de l'authentification ===
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;          // true pendant la verification initiale du JWT
}