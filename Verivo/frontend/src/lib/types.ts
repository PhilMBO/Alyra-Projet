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

// === UC-2 : scrutins ===

export type VotingSystem =
  | "uninominal_1tour"
  | "uninominal_2tours"
  | "jugement_majoritaire"
  | "approbation";

export type ChoiceType = "candidate" | "proposal";

export type ElectionStatus =
  | "draft"
  | "open"
  | "closed"
  | "tallied"
  | "archived";

export interface Choice {
  id: string;
  election_id: string;
  label: string;
  description: string | null;
  position: number;
  created_at: string;
}

export interface Election {
  id: string;
  title: string;
  description: string | null;
  votingSystem: VotingSystem;
  choiceType: ChoiceType;
  status: ElectionStatus;
  startDate: string | null;
  endDate: string | null;
  contractAddress: string | null;
  quorum: number;
  createdAt: string;
  voterCount?: number;   // renvoye par GET /elections
  choiceCount?: number;
}

export interface CreateElectionRequest {
  title: string;
  description?: string;
  votingSystem: VotingSystem;
  choiceType?: ChoiceType;
  startDate?: string;
  endDate?: string;
  quorum?: number;
  choices: Array<{ label: string; description?: string }>;
}

export interface CreateElectionResponse {
  election: Election;
  choices: Choice[];
}