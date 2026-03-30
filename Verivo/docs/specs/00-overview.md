# Verivo — Spécifications Techniques & Fonctionnelles

## Pipeline de développement

```
Spec → Types → Tests → Implementation → Proof
```

Chaque cas d'usage suit ce flow unique et cohérent :
1. **Spec** : Description fonctionnelle, règles métier, contrats d'API
2. **Types** : Interfaces TypeScript / Solidity, schémas Prisma, DTOs
3. **Tests** : Tests unitaires, d'intégration et E2E écrits AVANT le code
4. **Implementation** : Code backend, frontend, smart contracts
5. **Proof** : Preuve on-chain, vérification, audit trail

---

## Cas d'usage

| # | Cas d'usage | Acteur principal | Couches impactées |
|---|---|---|---|
| UC-1 | Onboarding WebApp | M. FédéX | Backend, Frontend, DB |
| UC-2 | Configuration du scrutin | M. FédéX | Backend, Frontend, DB |
| UC-3 | Déploiement par Verivo | Verivo (système) | Backend, Blockchain, DB |
| UC-4 | Vérification d'inscription | Mme ClubY | Frontend, Backend, Blockchain |
| UC-5 | Vote | Mme ClubY | Frontend, Blockchain |
| UC-6 | Décompte | Verivo (système) | Backend, Blockchain |
| UC-7 | Vérification universelle | Tout le monde | Frontend, Blockchain |
| UC-8 | Badge NFT (bonus) | Mme ClubY | Backend, Blockchain |

---

## Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | React 19 + Vite | SPA, connexion wallet |
| Backend | Express + Prisma | API REST, orchestration |
| Base de données | PostgreSQL 16 (multi-tenant) | Persistance, registres |
| Blockchain | Solidity (Hardhat) sur Ethereum/Polygon | Smart contracts de vote, NFTs |
| Wallet | Rabby, MetaMask (EIP-1193) | Signature des transactions |
| Infra | Docker Compose + Nginx | Orchestration, reverse proxy |

---

## Modèle d'authentification dual

```
┌─────────────────────────────────────────────┐
│              Utilisateur Verivo              │
├──────────────────┬──────────────────────────┤
│  Mode Wallet     │  Mode Email              │
│  ─────────────   │  ──────────              │
│  MetaMask/Rabby  │  email + mot de passe    │
│  SIWE (EIP-4361) │  JWT + wallet custodial  │
│  Non-custodial   │  Custodial (Verivo gère) │
└──────────────────┴──────────────────────────┘
```

---

## Invariants système

1. **Un vote = une transaction on-chain** — aucun vote n'est stocké off-chain
2. **Soul-bound NFT** — le NFT de droit de vote est non-transférable
3. **Un votant = un NFT** — pas de double vote possible (NFT brûlé après usage)
4. **Anonymat partiel** — la DB sait QUI a voté, pas POUR QUI (le vote est on-chain uniquement)
5. **Vérification universelle** — tout le monde peut auditer le résultat via le contrat
6. **Multi-tenant** — chaque organisation a son schéma PostgreSQL isolé
