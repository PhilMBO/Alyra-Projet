# Specification Technique — Verivo

## 1. Presentation

Verivo est une plateforme de vote decentralise pour organisations (federations, associations, collectivites).
Elle permet de creer des scrutins transparents et auditables dont les votes sont enregistres on-chain via des smart contracts Ethereum.

**Principes directeurs** :
- Le vote est stocke uniquement on-chain (la base de donnees ne conserve que la participation, pas le choix)
- Les droits de vote sont materialises par des NFT soul-bound (non-transferables)
- L'authentification : wallet (SIWE)
- L'architecture est multi-tenant (une organisation = un espace isole)

---

## 2. Stack technique

### Frontend

| Outil | Role |
|---|---|
| Next.js (App Router) | Framework React avec rendu hybride SSR/CSR |
| Tailwind CSS | Systeme de classes utilitaires CSS |
| wagmi + viem | Interaction avec la blockchain Ethereum |
| RainbowKit | Interface de connexion wallet |
| @tanstack/react-query | Gestion du cache et des requetes asynchrones |
| TypeScript | Typage statique |

### Blockchain

| Outil | Role |
|---|---|
| Solidity | Langage des smart contracts |
| Hardhat | Compilation, tests, deploiement des contrats |
| OpenZeppelin Contracts | Librairie de contrats audites (ERC-721, access control) |

### Backend

| Outil | Role |
|---|---|
| Express | Serveur REST API |
| Prisma | ORM pour PostgreSQL |
| PostgreSQL | Base de donnees relationnelle |
| JWT + bcrypt | Authentification et hashage |

### Infrastructure

| Outil | Role |
|---|---|
| Docker Compose | Orchestration des services (postgres, backend, frontend, nginx) |
| Nginx | Reverse proxy avec terminaison SSL |

---

## 3. Architecture

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
     └───────┬────────┘      └────────┬─────────┘
             │                         │
             v                         v
     ┌────────────────┐      ┌──────────────────┐
     │  PostgreSQL     │      │   Blockchain      │
     │  :5432          │      │  Polygon / Amoy   │
     └────────────────┘      │  Sepolia / Local   │
                              └──────────────────┘
```

**Flux reseau** :
- Nginx recoit toutes les requetes HTTPS
- Les appels `/api/*` sont proxifies vers le backend Express
- Le reste est servi par le frontend Next.js
- Le frontend communique directement avec la blockchain via wagmi/viem (cote client)

---

## 4. Reseaux blockchain

| Reseau | Usage |
|---|---|
| Hardhat (local) | Developpement et tests unitaires |
| Polygon Amoy | Testnet principal |
| Sepolia | Testnet secondaire |
| Polygon | Production |

Cout estime : ~$0.70 par election de 100 votants sur Polygon.

---

## 5. Smart contracts

### VerivoElection

Gestion du cycle de vie d'un scrutin : creation, vote, cloture, decompte.

- Seuls les detenteurs d'un VerivoVotingNFT peuvent voter
- Le vote est enregistre on-chain (index du choix)
- Quatre systemes de vote : uninominal 1 tour, uninominal 2 tours, jugement majoritaire, approbation/ Pour la démo uninominal ou pondéré.
- Les resultats sont consultables publiquement apres le decompte

### VerivoVotingNFT (ERC-721 Soul-bound)

Materialise le droit de vote pour un scrutin donné.

- Emis par l'administrateur de l'election (mint individuel ou en lot)
- Non-transferable (transferFrom et approve bloques)
- Detruit apres le vote (burn)
- Un NFT = un droit de vote = une adresse

### VerivoParticipationBadge (ERC-721 Standard)

Badge delivre apres un scrutin en tant que preuve de participation.

- Emis pour les votants et optionnellement les non-votants
- Transferable (ERC-721 standard)
- Metadata stockee sur IPFS (image SVG + attributs JSON)

---

## 6. Modele de donnees (Backend)

### Entites existantes

| Entite | Champs cles | Role |
|---|---|---|
| Admin | email, passwordHash, displayName, role | Utilisateur administrateur |
| Organization | name, slug, logo, status, adminId | Organisation (tenant) |

### Roles

| Role | Droits |
|---|---|
| SUPER_ADMIN | Gestion de toutes les organisations |
| ORG_ADMIN | Gestion de ses propres organisations |

### Statuts organisation

| Statut | Signification |
|---|---|
| ACTIVE | Organisation operationnelle |
| SUSPENDED | Organisation temporairement desactivee |
| ARCHIVED | Organisation archivee |

---

## 7. API REST (Backend)

### Authentification

| Methode | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Connexion email/mot de passe → JWT | Non |
| GET | `/api/auth/me` | Profil de l'admin connecte | Bearer JWT |

### Organisations

| Methode | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/organizations` | Creer une organisation + son admin | SUPER_ADMIN |
| GET | `/api/organizations` | Lister les organisations (filtrees par role) | Bearer JWT |

Le JWT a une duree de validite de 24 heures.

---

## 8. Frontend — Pages et composants

### Layout racine

- Police Inter (via next/font)
- Provider Web3 global (wagmi + RainbowKit + react-query)
- Theme Tailwind avec les design tokens Verivo

### Page d'accueil

- Header avec logo, titre et bouton de connexion wallet
- Formulaire de creation d'organisation
- Liste des organisations avec statut et date

### Design tokens

| Token | Valeur | Usage |
|---|---|---|
| Primary | `#0A1628` | Titres, boutons principaux |
| Secondary | `#1E6BB8` | Focus, liens |
| Accent | `#4FC3F7` | Elements de mise en avant |
| Success | `#059669` | Statut actif, messages de succes |
| Error | `#DC2626` | Erreurs, statut archive |
| Warning | `#D97706` | Statut suspendu |
| Surface | `#F0F4F8` | Fond de page |
| Background | `#FFFFFF` | Fond des cartes |
| Border | `#D1D9E0` | Bordures |

---

## 9. Authentification

### Mode Wallet

- Connexion via RainbowKit (MetaMask, WalletConnect, etc.)
- Signature SIWE (Sign-In with Ethereum) pour prouver la possession de l'adresse
- Pas de mot de passe

### Mode Email

- Connexion classique email + mot de passe
- JWT delivre par le backend
- Wallet custodial gere cote serveur pour les interactions blockchain

Les deux modes permettent d'acceder aux memes fonctionnalites. Le mode email est destine aux utilisateurs non-familiers avec les wallets.

---

## 10. Infrastructure Docker

### Services

| Service | Image | Port interne | Role |
|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | Base de donnees |
| backend | Node 20 (Express) | 3001 | API REST |
| frontend | Node 20 (Next.js standalone) | 3000 | Interface utilisateur |
| nginx | Nginx | 80, 443 | Reverse proxy SSL |

### Strategie de build frontend

Build multi-stage en 3 etapes :
1. Installation des dependances
2. Build Next.js (mode standalone)
3. Image minimale de production avec le serveur autonome

---

## 11. Cas d'usage (UC)

| UC | Nom | Description |
|---|---|---|
| UC-1 | Onboarding | Inscription admin (email ou wallet), creation de compte |
| UC-2 | Configuration scrutin | Creation d'une election, ajout candidats/propositions, import CSV des electeurs |
| UC-3 | Deploiement | Deploiement du smart contract, mint des NFT de vote |
| UC-4 | Verification inscription | L'electeur verifie qu'il possede un NFT de vote |
| UC-5 | Vote | Soumission du vote on-chain (direct ou via wallet custodial) |
| UC-6 | Decompte | Cloture du scrutin, calcul et publication des resultats |
| UC-7 | Verification universelle | Page publique de resultats, verification on-chain, script d'audit |
| UC-8 | Badge NFT | Emission de badges de participation (bonus) |

---

## 12. Securite

| Mesure | Detail |
|---|---|
| NFT soul-bound | Empeche la delegation ou revente du droit de vote |
| Vote unique | Le smart contract verifie qu'une adresse n'a pas deja vote |
| Burn apres vote | Le NFT de vote est detruit pour empecher toute reutilisation |
| JWT + bcrypt | Authentification backend securisee |
| HTTPS (Nginx SSL) | Chiffrement des echanges |
| Separation donnees | Le choix de vote n'est jamais stocke en base de donnees |
| Verification publique | N'importe qui peut auditer les resultats on-chain |

---

## 13. Contraintes et objectifs

| Contrainte | Cible |
|---|---|
| Nombre de votants | 10 a 10 000 par election |
| Cout gas par election (100 votants) | < $1 sur Polygon |
| Couverture de tests | > 80% |
| Temps de reponse API | < 500ms |
| Disponibilite | 99.5% (hors maintenance) |
