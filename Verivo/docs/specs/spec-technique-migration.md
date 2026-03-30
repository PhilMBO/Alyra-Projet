# Specification Technique — Migration Verivo

## 1. Objectif

Migrer le frontend de React+Vite vers **Next.js (App Router)** avec **Tailwind CSS** et integration Web3 (**wagmi/viem**), initialiser l'environnement **Hardhat** pour les smart contracts, tout en conservant le backend Express+Prisma+PostgreSQL existant.

---

## 2. Stack technique cible

### Frontend

| Outil | Role | Version |
|---|---|---|
| Next.js (App Router) | Framework React SSR/CSR | 15.x |
| React | Librairie UI | 19.x |
| Tailwind CSS | Framework CSS utilitaire | 4.x |
| wagmi | Hooks React pour Ethereum | 2.x |
| viem | Client Ethereum TypeScript | 2.x |
| @rainbow-me/rainbowkit | UI de connexion wallet | 2.x |
| @tanstack/react-query | Cache et state async | 5.x |
| TypeScript | Typage statique | 5.x |

### Blockchain

| Outil | Role | Version |
|---|---|---|
| Solidity | Langage smart contracts | 0.8.24 |
| Hardhat | Environnement de dev/test/deploy | 2.22+ |
| @nomicfoundation/hardhat-toolbox | Plugins Hardhat (ethers, chai, etc.) | 5.x |
| OpenZeppelin Contracts | Librairie de contrats securises | 5.1+ |
| dotenv | Gestion des variables d'environnement | 16.x |

### Backend (inchange)

| Outil | Role | Version |
|---|---|---|
| Express | Serveur HTTP REST | 4.21 |
| Prisma | ORM PostgreSQL | 6.4 |
| PostgreSQL | Base de donnees | 16 |
| jsonwebtoken | Authentification JWT | 9.x |
| bcrypt | Hashage de mots de passe | 5.x |

### Infrastructure

| Outil | Role |
|---|---|
| Docker Compose | Orchestration des services |
| Nginx | Reverse proxy + SSL |

---

## 3. Architecture globale

```
                    ┌──────────────┐
                    │    Nginx     │
                    │  (SSL :443)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
      /api/*  │                    /*   │
              v                         v
     ┌────────────────┐      ┌──────────────────┐
     │    Backend      │      │    Frontend       │
     │  Express :3001  │      │  Next.js :3000    │
     │  Prisma ORM     │      │  App Router       │
     └───────┬────────┘      │  Tailwind + wagmi │
             │                └──────────────────┘
             v
     ┌────────────────┐      ┌──────────────────┐
     │  PostgreSQL     │      │   Blockchain      │
     │  :5432          │      │  Polygon / Amoy   │
     └────────────────┘      │  Sepolia / Local   │
                              └──────────────────┘
```

---

## 4. Structure de fichiers cible

```
Verivo/
├── frontend/                              # NEXT.JS APP ROUTER
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                # Layout racine : Inter font, Web3Provider
│   │   │   ├── page.tsx                  # Accueil : liste + formulaire organisations
│   │   │   └── globals.css              # @tailwind base/components/utilities
│   │   ├── components/
│   │   │   ├── Header.tsx               # Logo + titre + ConnectButton
│   │   │   ├── OrganizationForm.tsx     # Formulaire creation organisation
│   │   │   └── OrganizationList.tsx     # Liste des organisations
│   │   ├── providers/
│   │   │   └── Web3Provider.tsx         # WagmiProvider + QueryClientProvider + RainbowKitProvider
│   │   └── lib/
│   │       └── wagmi.ts                 # createConfig : chains, transports, ssr
│   ├── public/
│   │   └── logoverivo.png              # Logo existant (conserve)
│   ├── next.config.ts                   # Rewrites API, remotePatterns images, output standalone
│   ├── tailwind.config.ts              # Design tokens Verivo
│   ├── postcss.config.mjs              # Config PostCSS standard
│   ├── tsconfig.json                   # Config TypeScript (genere par create-next-app)
│   ├── Dockerfile                      # Multi-stage build (deps → builder → runner)
│   ├── .env.local                      # Variables d'environnement frontend
│   └── package.json
│
├── blockchain/                            # HARDHAT
│   ├── contracts/
│   │   ├── VerivoElection.sol           # Contrat de vote principal
│   │   ├── VerivoVotingNFT.sol          # ERC-721 soul-bound (droit de vote)
│   │   └── VerivoParticipationBadge.sol # ERC-721 standard (badge participation)
│   ├── scripts/
│   │   └── deploy.js                   # Script de deploiement
│   ├── test/                            # Tests des contrats
│   ├── hardhat.config.js               # Solidity 0.8.24, networks, optimizer
│   ├── .env.example                    # Template variables blockchain
│   ├── .gitignore                      # artifacts/, cache/, node_modules/
│   └── package.json
│
├── backend/                               # INCHANGE
│   ├── src/
│   │   ├── index.js                    # Express :3001
│   │   ├── middleware/auth.js          # JWT authenticate + requireSuperAdmin
│   │   └── routes/
│   │       ├── auth.js                 # POST /login, GET /me
│   │       └── organizations.js        # POST /, GET /
│   ├── prisma/
│   │   ├── schema.prisma              # Admin, Organization
│   │   └── seed.js                    # Super admin par defaut
│   ├── Dockerfile
│   └── package.json
│
├── nginx/
│   ├── nginx.conf                      # MIS A JOUR : proxy frontend:3000
│   └── Dockerfile
│
├── docker-compose.yml                     # MIS A JOUR : env frontend, volumes
└── docs/
```

---

## 5. Configuration detaillee

### 5.1 Tailwind CSS — Design tokens

Transposition des variables CSS existantes (`index.css`) vers `tailwind.config.ts` :

```typescript
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:        { DEFAULT: "#0A1628", hover: "#142238" },
        secondary:      "#1E6BB8",
        accent:         "#4FC3F7",
        success:        "#059669",
        error:          "#DC2626",
        warning:        "#D97706",
        "text-primary": "#0F172A",
        "text-secondary":"#3A4A5C",
        border:         "#D1D9E0",
        surface:        "#F0F4F8",
        background:     "#FFFFFF",
      },
      borderRadius: { DEFAULT: "8px" },
      boxShadow:    { card: "0 1px 3px rgba(10, 22, 40, 0.1)" },
      fontFamily:   { sans: ["Inter", "system-ui", "-apple-system", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
```

### 5.2 Configuration wagmi

```typescript
// frontend/src/lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon, polygonAmoy, sepolia, hardhat } from "wagmi/chains";
import { http } from "wagmi";

export const config = getDefaultConfig({
  appName: "Verivo",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
  chains: [polygon, polygonAmoy, sepolia, hardhat],
  transports: {
    [polygon.id]:     http(),
    [polygonAmoy.id]: http(),
    [sepolia.id]:     http(),
    [hardhat.id]:     http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
```

### 5.3 Web3Provider

```typescript
// frontend/src/providers/Web3Provider.tsx
"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 5.4 Layout racine

```typescript
// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Verivo",
  description: "Plateforme de vote decentralise pour organisations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-surface text-text-primary`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
```

### 5.5 Next.js config — Proxy API et images

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
```

### 5.6 Hardhat config

```javascript
// blockchain/hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 137,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 80002,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
};
```

---

## 6. Migration des composants — CSS vers Tailwind

### 6.1 OrganizationForm

| Element | CSS actuel | Classes Tailwind |
|---|---|---|
| Section | `.org-form-section` | `bg-background rounded-lg p-6 shadow-card border border-border` |
| Titre | `.org-form-section h2` | `mb-4 text-primary font-semibold` |
| Formulaire | `.org-form` | `flex flex-col gap-4` |
| Groupe champ | `.form-group` | `flex flex-col gap-1` |
| Label | `.form-group label` | `font-semibold text-sm text-text-secondary` |
| Input | `.form-group input` | `px-3 py-2.5 border border-border rounded text-base focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15` |
| Erreurs | `.form-errors p` | `text-error text-sm` |
| Succes | `.form-success` | `text-success text-sm` |
| Bouton | `button` | `py-2.5 bg-primary text-white rounded text-base cursor-pointer hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed` |

### 6.2 OrganizationList

| Element | CSS actuel | Classes Tailwind |
|---|---|---|
| Section | `.org-list-section` | `bg-background rounded-lg p-6 shadow-card border border-border` |
| Vide | `.org-list-empty` | `text-text-secondary text-center p-4` |
| Liste | `.org-list` | `flex flex-col gap-3 list-none` |
| Item | `.org-item` | `flex justify-between items-center p-4 border border-border rounded hover:bg-surface transition-colors` |
| Logo | `.org-logo` | `w-10 h-10 rounded object-cover` |
| Info | `.org-info` | `flex items-center gap-3` |
| Status badge | `.org-status` | `text-xs px-2 py-0.5 rounded-full font-semibold` |
| Status actif | `.status-active` | `bg-success/10 text-success` |
| Status suspendu | `.status-suspended` | `bg-warning/10 text-warning` |
| Status archive | `.status-archived` | `bg-error/10 text-error` |
| Date | `.org-date` | `text-text-secondary text-sm` |

### 6.3 Header (nouveau composant extrait de App.jsx)

Integre le `ConnectButton` de RainbowKit pour la connexion wallet.

```
┌─────────────────────────────────────────────┐
│  [logo]  Verivo      [Connecter Wallet]     │
│  Gestion des organisations                   │
└─────────────────────────────────────────────┘
```

---

## 7. Smart contracts

Trois contrats conformes a l'architecture documentee dans `docs/specs/10-smart-contracts-architecture.md` :

### 7.1 VerivoElection

- **Role** : Gestion d'un scrutin (creation, vote, cloture, decompte)
- **Fonctions principales** :
  - `vote(uint choiceIndex)` — Vote (restreint aux detenteurs de VerivoVotingNFT)
  - `close()` — Cloture du scrutin (owner uniquement)
  - `tally()` — Calcul des resultats (owner uniquement)
  - `getResults() view` — Consultation publique des resultats
- **Systemes de vote supportes** : uninominal 1 tour, 2 tours, jugement majoritaire, approbation

### 7.2 VerivoVotingNFT (ERC-721 Soul-bound)

- **Role** : Droit de vote materialise par un NFT non-transferable
- **Fonctions principales** :
  - `mint(address voter)` — Emission d'un droit de vote (owner)
  - `batchMint(address[] voters)` — Emission en lot
  - `burn(uint tokenId)` — Destruction apres vote
  - `transferFrom()` — **BLOQUE** (soul-bound)
  - `approve()` — **BLOQUE** (soul-bound)
- **Heritage** : OpenZeppelin ERC721 avec surcharges de transfert

### 7.3 VerivoParticipationBadge (ERC-721 Standard)

- **Role** : Badge de participation delivre apres un scrutin
- **Fonctions principales** :
  - `mintBadge(address participant)` — Emission d'un badge
  - `batchMintBadges(address[] participants)` — Emission en lot
- **Heritage** : OpenZeppelin ERC721 standard (transferable)
- **Metadata** : Stockee sur IPFS via Pinata

### 7.4 Reseaux de deploiement

| Reseau | Chain ID | Usage |
|---|---|---|
| Hardhat | 31337 | Developpement local |
| Polygon Amoy | 80002 | Testnet principal |
| Sepolia | 11155111 | Testnet secondaire |
| Polygon | 137 | Production |

### 7.5 Cout estime

~$0.70 total pour une election de 100 votants sur Polygon (deploy + mint + votes + tally).

---

## 8. Variables d'environnement

### Frontend (`frontend/.env.local`)

```
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<walletconnect_cloud_project_id>
```

### Blockchain (`blockchain/.env`)

```
POLYGON_RPC_URL=
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
POLYGONSCAN_API_KEY=
ETHERSCAN_API_KEY=
```

### Backend (inchange, `backend/.env`)

```
DATABASE_URL=postgresql://verivo:verivo_secret@localhost:5432/verivo?schema=public
JWT_SECRET=<a_changer_en_production>
PORT=3001
```

---

## 9. Infrastructure Docker

### 9.1 Frontend Dockerfile (multi-stage)

| Stage | Role | Image |
|---|---|---|
| `deps` | Installation des dependances (`npm ci`) | node:20-alpine |
| `builder` | Build Next.js (`npm run build`) | node:20-alpine |
| `runner` | Serveur de production (`node server.js`) | node:20-alpine |

Port expose : **3000**

L'option `output: "standalone"` de Next.js genere un serveur autonome. Les fichiers `public/` et `.next/static` sont copies explicitement dans le stage `runner`.

### 9.2 docker-compose.yml — Changements

```yaml
services:
  postgres:
    # INCHANGE

  backend:
    # INCHANGE

  frontend:
    build: ./frontend
    container_name: verivo-frontend
    restart: unless-stopped
    environment:
      BACKEND_URL: http://backend:3001
      NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: ${WALLET_CONNECT_PROJECT_ID}
    depends_on:
      - backend
    # Volumes Vite SUPPRIMES (standalone build)

  nginx:
    # INCHANGE sauf nginx.conf
```

### 9.3 nginx.conf — Changement

```diff
  location / {
-     proxy_pass http://frontend:5173;
+     proxy_pass http://frontend:3000;
      proxy_set_header Host $host;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
  }
```

Le bloc `location /api/` reste inchange (proxy vers `backend:3001`).

---

## 10. Fichiers supprimes

| Fichier | Remplace par |
|---|---|
| `frontend/index.html` | `src/app/layout.tsx` |
| `frontend/vite.config.js` | `next.config.ts` |
| `frontend/src/main.jsx` | Point d'entree gere par Next.js |
| `frontend/src/App.jsx` | `src/app/page.tsx` |
| `frontend/src/App.css` | Classes Tailwind dans `page.tsx` |
| `frontend/src/index.css` | `globals.css` + `tailwind.config.ts` |
| `frontend/src/components/OrganizationForm.jsx` | `OrganizationForm.tsx` (Tailwind) |
| `frontend/src/components/OrganizationForm.css` | Classes Tailwind inline |
| `frontend/src/components/OrganizationList.jsx` | `OrganizationList.tsx` (Tailwind) |
| `frontend/src/components/OrganizationList.css` | Classes Tailwind inline |

---

## 11. Points d'attention techniques

| Sujet | Detail | Solution |
|---|---|---|
| Hydratation SSR | `toLocaleDateString("fr-FR")` peut diverger serveur/client | `page.tsx` est `"use client"`, pas de mismatch |
| Images externes | Logos d'organisations depuis URLs arbitraires | `remotePatterns: [{ hostname: "**" }]` dans `next.config.ts` |
| Standalone + rewrites | Les rewrites sont resolues au build time | `BACKEND_URL` passe comme ARG au build Docker, ou nginx gere le proxy |
| RainbowKit SSR | Le provider doit etre dans un composant client | `Web3Provider.tsx` est marque `"use client"`, config wagmi a `ssr: true` |
| TypeScript | Migration `.jsx` vers `.tsx` | Typage minimal (interfaces pour les props) |
| WalletConnect Project ID | Requis par RainbowKit | Creer un projet sur cloud.walletconnect.com |

---

## 12. Sequence d'implementation

| Etape | Action | Dependance |
|---|---|---|
| 1 | Supprimer les fichiers Vite (garder `public/`) | — |
| 2 | `npx create-next-app@latest . --app --src-dir --tailwind --eslint` | Etape 1 |
| 3 | `npm install wagmi viem @tanstack/react-query @rainbow-me/rainbowkit` | Etape 2 |
| 4 | Ecrire `tailwind.config.ts` avec design tokens | Etape 2 |
| 5 | Ecrire `globals.css` (directives Tailwind) | Etape 4 |
| 6 | Ecrire `wagmi.ts` + `Web3Provider.tsx` | Etape 3 |
| 7 | Ecrire `layout.tsx` (font Inter, Web3Provider) | Etape 5, 6 |
| 8 | Ecrire `next.config.ts` (rewrites, images, standalone) | Etape 2 |
| 9 | Migrer `Header.tsx` + `ConnectButton` | Etape 7 |
| 10 | Migrer `OrganizationForm.tsx` (CSS → Tailwind) | Etape 7 |
| 11 | Migrer `OrganizationList.tsx` (CSS → Tailwind) | Etape 7 |
| 12 | Ecrire `page.tsx` (compose Header + Form + List) | Etape 9, 10, 11 |
| 13 | Mettre a jour `Dockerfile` (multi-stage Next.js) | Etape 8 |
| 14 | Mettre a jour `docker-compose.yml` | Etape 13 |
| 15 | Mettre a jour `nginx.conf` (port 5173 → 3000) | Etape 13 |
| 16 | `npm init -y` dans `blockchain/` + installer Hardhat | — |
| 17 | Ecrire `hardhat.config.js` | Etape 16 |
| 18 | Ecrire contrats squelettes (Election, VotingNFT, Badge) | Etape 17 |
| 19 | Ecrire `scripts/deploy.js` | Etape 17 |
| 20 | Verifier : `npm run dev` (frontend) + `npx hardhat compile` (blockchain) | Etape 12, 18 |
| 21 | Verifier : `docker compose up --build` (stack complete) | Etape 14, 15 |

Les etapes 1-15 (frontend) et 16-19 (blockchain) peuvent etre executees en parallele.
