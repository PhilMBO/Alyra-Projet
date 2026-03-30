# Planning d'implémentation — Verivo (4 semaines)

## Hypothèses

- **1 développeur**
- **1 point = 1 demi-journée** (~4h)
- **Budget total : 40 points = 20 jours = 4 semaines**
- Priorité : couvrir **toutes les exigences C1–C8** en réduisant le scope au strict nécessaire

---

## Scope MVP (ce qu'on garde)

- 1 seul système de vote : **uninominal 1 tour**
- Pas de voteMultiple (jugement/approbation → hors scope)
- Badges simplifiés (métadonnées on-chain, pas d'IPFS)
- Frontend minimaliste mais fonctionnel
- Wallet custodial simplifié (backend signe directement, pas d'ERC-2771 pour le MVP)
- CI/CD : pipeline basique (compile + test + coverage)
- Déploiement on-chain sur **Polygon Amoy** (testnet Ethereum)

---

## Vue par semaine

| Semaine | Focus | Charge | Exigences couvertes |
|---|---|---|---|
| **S1** | Setup + smart contracts + tests | 12 pts | C2, C3, C4, C6 |
| **S2** | Backend complet | 10 pts | C2, C7 |
| **S3** | Frontend + déploiement testnet | 12 pts | C7, C8 |
| **S4** | Sécurité + CI + docs + livrables | 6 pts | C1, C4, C5 |

---

## S1 — Smart contracts + tests (12 pts)

| Clé | Résumé | Pts | Exigence | Jour |
|---|---|---|---|---|
| VER-001 | Init Hardhat + OpenZeppelin + solidity-coverage + gas-reporter | 1 | C5, C6 | L |
| VER-002 | VerivoVotingNFT : ERC-721 soul-bound (mint, batchMint, burn, override transfer) | 2 | C2, C3 | L-Ma |
| VER-003 | VerivoElection : storage, constructeur, vote(uint8), close(), tally(), getResults() | 3 | C2 | Ma-Me |
| VER-004 | VerivoParticipationBadge : ERC-721 standard (mintBadge, batchMint, tokenURI) | 2 | C2, C3 | Je |
| VER-005 | Tests VerivoVotingNFT (mint, batch, soul-bound revert, burn, access control) | 1 | C6 | Ve |
| VER-006 | Tests VerivoElection (deploy, vote, double vote, close, tally, getResults, access) | 2 | C6 | Ve-S |
| VER-007 | Tests VerivoParticipationBadge (mint, transfer OK, tokenURI) | 1 | C6 | S |

**Livrable fin S1** : 3 contrats compilent, tests passent, coverage > 80%

---

## S2 — Backend complet (10 pts)

| Clé | Résumé | Pts | Exigence | Jour |
|---|---|---|---|---|
| VER-010 | Évoluer schema Prisma (User, OrganizationMember, enums) + migration | 1 | C2 | L |
| VER-011 | POST /auth/register (email + wallet custodial) + service wallet.service.js | 2 | C7 | L-Ma |
| VER-012 | Service tenant.service.js (création schéma tenant via $executeRaw) | 1 | C2 | Ma |
| VER-013 | Middleware orgAuth.js + routes CRUD élections (dans le schéma tenant) | 2 | C7 | Me |
| VER-014 | Route POST /voters/import (CSV parse + création comptes + voter_registry) | 2 | C7 | Je |
| VER-015 | Service blockchain.service.js + route POST /deploy + POST /close + POST /tally | 2 | C7, C8 | Ve |

**Livrable fin S2** : API complète, testable avec Postman/curl

---

## S3 — Frontend + déploiement testnet (12 pts)

| Clé | Résumé | Pts | Exigence | Jour |
|---|---|---|---|---|
| VER-020 | Install wagmi/viem/react-router + AuthContext + WalletProvider | 1 | C7 | L |
| VER-021 | Page Register + Login (email ou wallet) | 2 | C7 | L-Ma |
| VER-022 | Dashboard admin : liste élections + CreateElection (formulaire + CSV upload) | 2 | C7 | Ma-Me |
| VER-023 | Page Vote (sélection candidat + envoi tx via wagmi ou appel API custodial) | 2 | C7 | Me-Je |
| VER-024 | Page PublicResults (résultats + preuves blockchain + lien Polygonscan) | 1 | C7 | Je |
| VER-025 | Page MyBadges (liste badges NFT) | 1 | C3, C7 | Je |
| VER-026 | Script deploy.js Hardhat + déployer sur Polygon Amoy | 1 | C8 | Ve |
| VER-027 | Vérifier les contrats sur Polygonscan (hardhat verify) | 1 | C8 | Ve |
| VER-028 | Test E2E sur testnet : deploy → mint → vote → tally → results (preuve que tout fonctionne) | 1 | C8, C6 | Ve |

**Livrable fin S3** : app fonctionnelle + contrats déployés et vérifiés sur Amoy

---

## S4 — Sécurité + CI + docs + livrables (6 pts)

| Clé | Résumé | Pts | Exigence | Jour |
|---|---|---|---|---|
| VER-030 | Analyse Slither + optimisation gas (gas-reporter) | 1 | C4 | L |
| VER-031 | Rédiger le tableau des attaques connues et contre-mesures | 1 | C4 | L |
| VER-032 | Pipeline GitHub Actions (compile + test + coverage + lint) | 1 | C5 | Ma |
| VER-033 | Héberger frontend (Vercel) + backend (Railway ou Docker VPS) | 1 | C7 | Ma |
| VER-034 | Finaliser le cahier des charges (screenshots, URLs live, schéma fonctionnel) | 1 | C1 | Me |
| VER-035 | Préparer la soutenance (slides, démo live, argumentaire) | 1 | C1 | Je-Ve |

**Livrable fin S4** : tous les livrables Alyra prêts

---

## Couverture exigences Alyra

| Exigence | Tâches | Semaine |
|---|---|---|
| **C1** Cahier des charges | VER-034, VER-035 | S4 |
| **C2** Smart contract Solidity | VER-002, VER-003, VER-004, VER-010, VER-012 | S1, S2 |
| **C3** Jeton numérique (NFT) | VER-002 (soul-bound), VER-004 (badge), VER-025 | S1, S3 |
| **C4** Sécurité & optimisation | VER-030, VER-031 | S4 |
| **C5** CI/CD + versioning | VER-001, VER-032 + Git tout au long | S1, S4 |
| **C6** Tests > 80% coverage | VER-005, VER-006, VER-007, VER-028 | S1, S3 |
| **C7** Frontend ↔ blockchain | VER-011→015, VER-020→025, VER-033 | S2, S3, S4 |
| **C8** Déploiement on-chain | VER-026, VER-027, VER-028 | S3 |

**Toutes les exigences C1–C8 sont couvertes.**

---

## Chemin critique

```
VER-001 → VER-003 → VER-006 → VER-015 → VER-023 → VER-026 → VER-028
Hardhat    Election   Tests     Backend    Vote       Deploy    E2E
setup      contract   SC        blockchain frontend   Amoy      testnet
```

---

## Risques et plan B

| Risque | Impact | Plan B |
|---|---|---|
| Tests coverage < 80% | C6 non validée | Ajouter des tests edge cases le WE S1 |
| Problème déploiement Amoy | C8 non validée | Déployer sur Polygon Amoy à la place |
| Frontend pas fini S3 | C7 incomplète | Prioriser Vote + Results, couper Badges |
| Slither trouve des high | C4 fragilisée | Corriger en priorité sur S4 |
