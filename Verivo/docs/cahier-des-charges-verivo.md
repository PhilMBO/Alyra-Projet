# Cahier des charges — Verivo

## Plateforme de vote décentralisé pour organisations

---

# Table des matières

1. [Contexte et besoin](#1-contexte-et-besoin)
2. [Apport de la blockchain](#2-apport-de-la-blockchain)
3. [Objectifs du projet](#3-objectifs-du-projet)
4. [Cible et périmètre](#4-cible-et-périmètre)
5. [Architecture technique](#5-architecture-technique)
6. [Schéma fonctionnel et arborescence](#6-schéma-fonctionnel-et-arborescence)
7. [Cas d'usage détaillés (UC-1 à UC-8)](#7-cas-dusage-détaillés)
8. [Smart contracts](#8-smart-contracts)
9. [Jetons numériques (NFT)](#9-jetons-numériques-nft)
10. [Sécurité — Tableau des attaques connues et contre-mesures](#10-sécurité--tableau-des-attaques-connues-et-contre-mesures)
11. [Tests fonctionnels — Stratégie et couverture](#11-tests-fonctionnels--stratégie-et-couverture)
12. [CI/CD — Intégration continue](#12-cicd--intégration-continue)
13. [Déploiement](#13-déploiement)
14. [Stratégie Gasless](#14-stratégie-gasless)
15. [Stack technique](#15-stack-technique)
16. [Matrice de conformité Alyra (C1–C8)](#16-matrice-de-conformité-alyra-c1c8)

---

# 1. Contexte et besoin

Les fédérations sportives, associations et collectivités organisent régulièrement des scrutins (élections de bureau, votes sur des statuts, budgets participatifs). Ces votes sont aujourd'hui gérés par courrier, main levée ou outils en ligne propriétaires. Aucune de ces méthodes ne garantit simultanément :

- **La transparence** : les électeurs ne peuvent pas vérifier le décompte
- **L'intégrité** : l'organisateur peut modifier les résultats
- **L'auditabilité** : aucun tiers indépendant ne peut recompter
- **L'accessibilité** : les membres éloignés sont souvent exclus

**Verivo** répond à ce besoin en fournissant une plateforme de vote décentralisé où chaque scrutin est exécuté on-chain via des smart contracts, rendant les résultats **immuables, vérifiables par tous et auditables sans tiers de confiance**.

---

# 2. Apport de la blockchain

| Problème (Web2) | Solution Verivo (Web3) |
|---|---|
| L'opérateur peut modifier les votes en base de données | Les votes sont des **transactions on-chain immuables** |
| Il faut faire confiance à l'organisateur pour le décompte | **N'importe qui** peut recompter en lisant le contrat public |
| L'admin peut ajouter des votants fantômes après coup | Le **registre électoral est scellé on-chain** via les NFTs mintés |
| Aucune preuve de participation | Un **NFT badge** atteste cryptographiquement de la participation |
| Le double vote repose sur une vérification serveur falsifiable | Le smart contract **interdit structurellement** le double vote (mapping + NFT) |

**En une phrase** : la blockchain transforme un système "croyez-nous" en un système "vérifiez vous-mêmes".

---

# 3. Objectifs du projet

### Objectifs quantitatifs
- Supporter des scrutins de **10 à 10 000 votants**
- Coût par scrutin (100 votants) : **< $1** en gas sur Polygon
- Couverture de tests smart contracts : **> 80%**
- Temps de déploiement d'un scrutin : **< 5 minutes**

### Objectifs qualitatifs
- **Zéro friction** pour le votant (gasless, wallet custodial)
- **Vérification universelle** des résultats par toute personne
- **Multi-tenant** : isolation totale entre organisations
- **4 systèmes de vote** : uninominal 1 tour, 2 tours, jugement majoritaire, approbation
- **Conformité** : pas de stockage du choix de vote en base de données

---

# 4. Cible et périmètre

### Cible
- Fédérations sportives
- Associations loi 1901
- Collectivités territoriales
- Tout organisme nécessitant un vote vérifiable

### Périmètre MVP
- Inscription admin + création d'organisation
- Configuration d'un scrutin uninominal 1 tour
- Import CSV de la liste électorale
- Déploiement du contrat + mint des NFTs de droit de vote
- Vote on-chain (wallet direct ou custodial)
- Décompte et publication des résultats
- Vérification universelle des résultats
- Badge NFT de participation

### Hors périmètre MVP
- Scrutin uninominal 2 tours (mécanisme de 2e tour)
- Vote chiffré (commit-reveal)
- Application mobile native
- Paiement / facturation intégrés

---

# 5. Architecture technique

```
                         INTERNET
                            │
                            ▼
                    ┌───────────────┐
                    │     NGINX     │  Reverse proxy + SSL
                    │   (port 443)  │
                    └───────┬───────┘
                            │
               ┌────────────┴────────────┐
               │                         │
          Route: /*                 Route: /api/*
               │                         │
               ▼                         ▼
      ┌─────────────────┐      ┌─────────────────┐
      │    FRONTEND      │      │    BACKEND       │
      │  React 19 + Vite │      │  Express + Prisma│
      │  + wagmi/viem    │      │  + ethers.js     │
      └─────────────────┘      └────────┬─────────┘
                                        │
                           ┌────────────┴────────────┐
                           │                         │
                           ▼                         ▼
                  ┌─────────────────┐      ┌─────────────────┐
                  │   PostgreSQL    │      │   Blockchain     │
                  │  (multi-tenant) │      │  (Polygon/EVM)   │
                  └─────────────────┘      └─────────────────┘
```

### Modèle d'authentification dual

```
┌──────────────────────────────────────────────────┐
│               Utilisateur Verivo                  │
├────────────────────┬─────────────────────────────┤
│  Mode Wallet       │  Mode Email                 │
│  MetaMask / Rabby  │  email + mot de passe       │
│  SIWE (EIP-4361)   │  JWT + wallet custodial     │
│  Non-custodial     │  Clé chiffrée AES-256-GCM   │
└────────────────────┴─────────────────────────────┘
```

### Multi-tenancy PostgreSQL

```
shared (schéma global)          tenant_federation_x (par organisation)
├── users                       ├── elections
├── organizations               ├── choices
└── organization_members        ├── voter_registry
                                ├── voter_nfts
                                ├── participation_log
                                └── election_results
```

Chaque organisation possède un schéma PostgreSQL isolé, créé automatiquement à l'onboarding via `shared.create_tenant_schema()`.

---

# 6. Schéma fonctionnel et arborescence

## Flux global

```
Admin crée le scrutin → importe CSV votants → déploie on-chain
     ↓
Chaque votant reçoit un NFT de droit de vote
     ↓
Les votants signent leur vote via wallet (ou custodial)
     ↓
Clôture → décompte on-chain → résultats publics vérifiables
     ↓
Badge NFT de participation minté pour chaque inscrit
```

## Transitions d'état du scrutin

```
  ┌─────────┐     deploy      ┌──────────┐     close      ┌──────────┐     tally      ┌──────────┐
  │  DRAFT  │────────────────>│   OPEN   │───────────────>│  CLOSED  │──────────────>│ TALLIED  │
  └─────────┘                 └──────────┘                └──────────┘               └──────────┘
       │                           │
  Modifications :             vote() possible
  - choix                     (pendant open)
  - votants
  - dates
```

## Arborescence de l'application (pages)

```
/                           → Page d'accueil
/register                   → Inscription (email ou wallet)
/login                      → Connexion
/dashboard                  → Dashboard admin ou votant
│
├── /organizations/:slug
│   ├── /elections                    → Liste des scrutins
│   ├── /elections/new                → Créer un scrutin
│   ├── /elections/:id                → Détail du scrutin (admin)
│   ├── /elections/:id/voters         → Gestion des votants + import CSV
│   ├── /elections/:id/deploy         → Déploiement on-chain
│   └── /elections/:id/results        → Résultats (admin)
│
├── /me/elections                     → Mes scrutins (vue votant)
├── /me/elections/:id/vote            → Page de vote
├── /me/badges                        → Ma collection de badges
│
└── /public/elections/:id/results     → Résultats publics (sans auth)
```

## Diagramme de séquence complet

```
    M. FédéX            Verivo Backend            Blockchain             Mme ClubY
    ────────            ──────────────            ──────────             ──────────

UC-1 │── register ────────>│                          │                      │
     │                      │── create user + org ────>│                      │
     │<── JWT ──────────────│                          │                      │
     │                      │                          │                      │
UC-2 │── create election ──>│                          │                      │
     │── upload CSV ───────>│                          │                      │
     │                      │── create voters ────────>│                      │
     │<── election (draft) ─│                          │                      │
     │                      │                          │                      │
UC-3 │── deploy ───────────>│                          │                      │
     │                      │── deploy contracts ─────────────>│              │
     │                      │── batchMint NFTs ───────────────>│              │
     │<── addresses ────────│                          │                      │
     │                      │                          │                      │
UC-4 │                      │                          │          │── login ──>│
     │                      │<──── GET /me/elections ──────────────────────────│
     │                      │── balanceOf(wallet) ────────────>│              │
     │                      │──── elections + NFT ────────────────────────────>│
     │                      │                          │                      │
UC-5 │                      │                          │<── vote(choice) ─────│
     │                      │                          │── verify + record    │
     │                      │<── event VoteCast ───────│                      │
     │                      │── update participation ─>│                      │
     │                      │                          │── confirmation ─────>│
     │                      │                          │                      │
UC-6 │── close + tally ────>│                          │                      │
     │                      │── close() + tally() ────────────>│              │
     │                      │── getResults() ─────────────────>│              │
     │                      │── save results ─────────>│                      │
     │<── results ──────────│                          │                      │
     │                      │                          │                      │
UC-7 │    Anyone ───────────│── GET /public/results ──>│                      │
     │                      │── getResults() on-chain ────────>│              │
     │    Anyone <──────────│── results + proofs ──────│                      │
     │                      │                          │                      │
UC-8 │                      │── generate badges ──────>│                      │
     │                      │── batchMint badges ─────────────>│              │
     │                      │                          │── badge ────────────>│
```

## Matrice couche × UC

```
                  UC-1   UC-2   UC-3   UC-4   UC-5   UC-6   UC-7   UC-8
  ───────────────────────────────────────────────────────────────────────
  Frontend         ●      ●      ○      ●      ●      ○      ●      ●
  Backend API      ●      ●      ●      ●      ○*     ●      ●      ●
  PostgreSQL       ●      ●      ●      ●      ○      ●      ○      ●
  Smart Contract   ─      ─      ●      ○      ●      ●      ●      ●
  IPFS             ─      ─      ─      ─      ─      ─      ─      ●

  ● principal  ○ secondaire  ○* custodial uniquement  ─ non impliqué
```

---

# 7. Cas d'usage détaillés

---

## UC-1 — Onboarding sur la WebApp Verivo

> M. FédéX crée son compte, renseigne sa fédération.

### Acteurs
- **M. FédéX** : administrateur d'une fédération

### Scénario principal

1. M. FédéX accède à `/register`
2. Il choisit son mode d'authentification :
   - **Email** : email + mot de passe → wallet custodial créé en arrière-plan
   - **Wallet** : connexion MetaMask/Rabby via SIWE (EIP-4361)
3. Il renseigne sa fédération : nom, slug (auto-généré), logo (optionnel)
4. Le système crée en une **transaction atomique** :
   - Le compte utilisateur (`shared.users`)
   - L'organisation (`shared.organizations`)
   - Le lien admin (`shared.organization_members`, role = `admin`)
   - Le schéma tenant PostgreSQL
5. Redirection vers le dashboard

### Règles métier

- Mot de passe : ≥ 8 caractères, 1 majuscule, 1 chiffre
- Slug : lowercase, alphanumeric + hyphens, unique
- Wallet custodial : paire de clés Ethereum, clé privée chiffrée AES-256-GCM
- SIWE : vérification signature EIP-4361
- Création atomique (rollback si échec)
- `schema_name` = `tenant_<slug>`

### Erreurs

| Code | Cas | HTTP |
|---|---|---|
| E1 | Email déjà utilisé | 409 |
| E2 | Wallet déjà enregistré | 409 |
| E3 | Slug déjà pris | 409 |
| E4 | Validation échouée | 400 |
| E5 | Échec création tenant | 500 (rollback) |

### API

```
POST /api/auth/register

Body (email) : { authMethod, email, password, displayName, organization: { name, slug?, logoUrl? } }
Body (wallet): { authMethod, walletAddress, signature, message, displayName, organization: { name, slug?, logoUrl? } }

→ 201 : { user, organization, token }
```

### Tests

| Test | Type |
|---|---|
| Créer un utilisateur email avec wallet custodial | Unit |
| Créer un utilisateur wallet via SIWE | Unit |
| Créer l'organisation et le schéma tenant | Unit |
| Lier l'utilisateur avec role admin | Unit |
| Retourner un JWT valide | Unit |
| Rejeter email déjà utilisé (409) | Unit |
| Rejeter mot de passe trop faible (400) | Unit |
| Rejeter signature SIWE invalide (401) | Unit |
| Rollback si création tenant échoue (500) | Unit |
| Flow complet email : register → login → dashboard | Intégration |
| Flow complet wallet : connect → sign → register | Intégration |
| Vérifier que le schéma tenant existe | Intégration |
| Inscription par email via le formulaire | E2E |
| Afficher les erreurs de validation | E2E |

### Proof

- `shared.users` contient le compte
- `shared.organizations` contient l'org
- `shared.organization_members` contient le lien admin
- `information_schema.schemata` contient `tenant_<slug>`
- Le wallet custodial est une adresse Ethereum valide (EIP-55)
- Le JWT est décodable avec les bons claims

---

## UC-2 — Configuration du scrutin

> M. FédéX définit un scrutin uninominal à un tour et fournit via un import CSV la liste électorale.

### Acteurs
- **M. FédéX** : admin ou organizer de l'organisation

### Scénario principal

1. M. FédéX configure le scrutin depuis `/organizations/:slug/elections/new` :
   - Titre, description, type (uninominal 1 tour), type de choix (candidat/proposition)
   - Dates début/fin (optionnel), quorum (défaut: 0)
2. Il ajoute les candidats/propositions (label, description, position)
3. Il importe la liste électorale via CSV :
   - Colonnes : `nom, prenom, email, club, wallet_address` (wallet optionnel)
   - Auto-détection du séparateur (virgule ou point-virgule)
   - Aperçu avant confirmation
4. Le système crée :
   - L'élection (`tenant.elections`, status = `draft`)
   - Les choix (`tenant.choices`)
   - Les comptes manquants (`shared.users` + wallet custodial)
   - Les inscriptions (`tenant.voter_registry`)

### Règles métier

- Seuls les rôles `admin` et `organizer` peuvent créer un scrutin
- Statut initial : `draft` (non visible par les votants)
- CSV : minimum une colonne d'identification (email OU wallet_address)
- Si email inconnu → création de compte avec wallet custodial + invitation
- Si wallet_address fourni → utilisé directement (pas de custodial)
- Systèmes de vote : `uninominal_1tour`, `uninominal_2tours`, `jugement_majoritaire`, `approbation`

### Format CSV

```csv
nom,prenom,email,club,wallet_address
Dupont,Marie,marie.dupont@club.fr,Club Lyon,0x1234...abcd
Martin,Jean,jean.martin@club.fr,Club Paris,
```

### API

```
POST /api/organizations/:orgSlug/elections
Body : { title, description?, votingSystem, choiceType, startDate?, endDate?, quorum?, choices[] }
→ 201 : { election, choices }

POST /api/organizations/:orgSlug/elections/:id/voters/import
Content-Type: multipart/form-data (champ 'file')
→ 200 : { imported, created, skipped, errors[], voters[] }
```

### Tests

| Test | Type |
|---|---|
| Créer un scrutin uninominal avec candidats | Unit |
| Initialiser le status à 'draft' | Unit |
| Valider la cohérence des dates | Unit |
| Parser un CSV virgule et point-virgule | Unit |
| Créer les entrées voter_registry | Unit |
| Créer des comptes pour emails inconnus | Unit |
| Générer des wallets custodial | Unit |
| Rejeter CSV sans header (400) | Unit |
| Signaler les adresses wallet invalides (400) | Unit |
| Signaler les doublons (400) | Unit |
| Rejeter si non admin/organizer (403) | Unit |
| Flow : créer scrutin → importer CSV → vérifier registre | Intégration |
| Vérifier l'isolation tenant | Intégration |
| Créer un scrutin via le formulaire | E2E |
| Uploader un CSV et voir l'aperçu | E2E |

### Proof

- `tenant.elections` contient l'élection en `draft`
- `tenant.choices` contient les choix ordonnés
- `tenant.voter_registry` contient tous les votants
- Nombre lignes CSV = `imported + skipped + errors.length`
- Les données ne sont pas accessibles depuis un autre schéma tenant

---

## UC-3 — Déploiement par Verivo

> Verivo déploie le smart-contract du scrutin et opère la distribution des NFT de droit de vote.

### Acteurs
- **M. FédéX** : déclenche le déploiement
- **Verivo (système)** : déploie et mint

### Pré-conditions
- Scrutin en `draft`, ≥ 2 choix, ≥ 1 votant inscrit
- Wallet opérateur Verivo funded en gas

### Scénario principal

1. M. FédéX clique "Déployer le scrutin"
2. Le backend déploie `VerivoElection` :
   - Choix (bytes32 hashés), adresse owner, type de scrutin, quorum
   - `contract_address` enregistré en DB
3. Le backend déploie `VerivoVotingNFT` (ERC-721 soul-bound, lié à l'élection)
4. Le backend mint en batch un NFT par votant inscrit :
   - `token_id`, `tx_hash`, `contract_address` → `tenant.voter_nfts`
   - `nft_status` = `minted`
5. Statut de l'élection → `open`

### Règles métier

- Déploiement **irréversible** : les choix ne peuvent plus être modifiés
- NFT soul-bound : `transferFrom` et `approve` revert
- Seul le wallet Verivo peut minter (onlyMinter)
- Batch minting pour optimiser le gas
- Le contrat vérifie la possession du NFT avant d'accepter un vote
- Seul l'owner peut déclencher close/tally

### API

```
POST /api/organizations/:orgSlug/elections/:id/deploy
→ 200 : { contractAddress, nftContractAddress, deployTxHash, mintedNFTs, status: 'open', explorerUrl }

GET /api/organizations/:orgSlug/elections/:id/deploy/status
→ 200 : { step, progress: { totalVoters, mintedCount, failedCount }, contractAddress?, error? }
```

### Tests

| Test | Type |
|---|---|
| Déployer VerivoElection avec les bons choix | Smart contract |
| Initialiser le status on-chain à 'open' | Smart contract |
| Enregistrer l'owner (wallet Verivo) | Smart contract |
| Rejeter déploiement sans choix | Smart contract |
| Minter un NFT vers une adresse | Smart contract |
| Minter en batch | Smart contract |
| Rejeter transferFrom (soul-bound) | Smart contract |
| Rejeter safeTransferFrom (soul-bound) | Smart contract |
| Rejeter approve (soul-bound) | Smart contract |
| Brûler un NFT | Smart contract |
| Rejeter mint par non-minter | Smart contract |
| Seul l'owner peut tally/close | Smart contract |
| Déployer sur Hardhat local + minter les NFTs | Intégration |
| Mettre à jour contract_address en DB | Intégration |
| Passer le statut à 'open' | Intégration |
| Échouer si scrutin pas en 'draft' | Intégration |

### Proof

- `contract_address` vérifiable sur l'explorateur blockchain
- `balanceOf(voter)` == 1 pour chaque votant
- `transferFrom` → revert
- `owner()` == adresse wallet Verivo
- `getChoices()` retourne les bons labels hashés
- `voter_nfts.nft_status` == `minted` pour tous

---

## UC-4 — Vérification d'inscription

> Mme ClubY se connecte et constate son inscription au scrutin.

### Acteurs
- **Mme ClubY** : membre inscrite sur la liste électorale

### Scénario principal

1. Mme ClubY se connecte (wallet ou email)
2. Elle accède à `/me/elections` — liste des scrutins auxquels elle est inscrite
3. Pour chaque scrutin : titre, organisation, statut, dates, sa participation
4. Elle sélectionne le scrutin de M. FédéX → détail :
   - Description, candidats/propositions
   - Son NFT (tokenId, lien explorateur)
   - Vérification on-chain : `balanceOf(sonWallet)` == 1
5. Vérification indépendante possible via l'explorateur blockchain

### Règles métier

- Vérification off-chain (DB) ET on-chain (NFT balanceOf)
- Seuls les scrutins de ses organisations sont visibles
- Les autres votants ne sont pas listés (vie privée)
- "a voté / n'a pas voté" visible uniquement par le votant et les admins

### API

```
GET /api/me/elections
→ 200 : { elections: [{ id, title, organizationName, status, participation: { isRegistered, hasVoted, nftStatus, tokenId } }] }

GET /api/organizations/:orgSlug/elections/:id/voter-view
→ 200 : { election, choices, myRegistration: { eligible, nft: { tokenId, contractAddress, status, explorerUrl } }, verification: { onChainBalance, isVerified } }
```

### Tests

| Test | Type |
|---|---|
| Retourner les scrutins de l'utilisateur | Unit |
| Inclure le statut de participation | Unit |
| Retourner les infos du NFT | Unit |
| Vérifier la possession on-chain (balanceOf) | Unit |
| Retourner 403 si non inscrit | Unit |
| Flow : login → liste scrutins → détail → vérification NFT | Intégration |
| Cohérence DB / on-chain | Intégration |
| Données d'autres votants masquées | Intégration |
| Afficher la liste des scrutins | E2E |
| Afficher le lien vers l'explorateur | E2E |

### Proof

- Le scrutin apparaît dans "Mes scrutins"
- `balanceOf(mmeClubY.wallet)` == 1
- `voter_nfts.nft_status` == `minted` ET `balanceOf` == 1
- Aucun autre votant listé dans la réponse API

---

## UC-5 — Vote

> Mme ClubY envoie une transaction contenant son vote sur le smart-contract.

### Acteurs
- **Mme ClubY** : votante avec NFT de droit de vote

### Pré-conditions
- Scrutin `open`, NFT détenu (`balanceOf` == 1), pas encore voté

### Scénario principal (wallet direct)

1. Mme ClubY voit les candidats sur `/me/elections/:id/vote`
2. Selon le système :
   - **Uninominal** : sélectionne UN candidat
   - **Jugement majoritaire** : attribue une mention à chaque candidat
   - **Approbation** : coche les candidats approuvés
3. Clic "Voter"
4. La WebApp prépare l'appel `VerivoElection.vote(choiceIndex)` (ou `voteMultiple`)
5. **Stratégie gasless** : le votant **signe** (EIP-712, gratuit), le relayer Verivo envoie la meta-tx et paie le gas
6. Le smart contract :
   - Vérifie NFT (`balanceOf > 0`)
   - Vérifie pas de double vote (`!hasVoted[voter]`)
   - Enregistre le vote, émet `VoteCast`
7. Le backend détecte l'événement → met à jour `participation_log`
8. Confirmation : hash de la transaction + lien explorateur

### Scénario wallet custodial (email)

1. La WebApp envoie le choix au backend (`POST /vote`)
2. Le backend déchiffre la clé privée, signe et envoie la transaction
3. Résultat identique (vote on-chain)

### Règles métier

- Vote **en clair** sur la blockchain (pas de chiffrement)
- **Un seul vote** par scrutin (mapping `hasVoted` on-chain)
- Vote **final** — pas de modification
- Le backend ne connaît PAS le choix (seulement la participation via l'événement)
- Gas payé par Verivo (meta-transactions ERC-2771 ou custodial)

### API (custodial uniquement)

```
POST /api/organizations/:orgSlug/elections/:id/vote
Body : { choiceIndex? , choiceIndices? }
→ 200 : { txHash, status, explorerUrl }

GET /api/transactions/:txHash/status
→ 200 : { txHash, status, blockNumber?, confirmations }
```

### Tests

| Test | Type |
|---|---|
| Accepter un vote d'un détenteur de NFT | Smart contract |
| Incrémenter le compteur du choix | Smart contract |
| Marquer `hasVoted[voter]` = true | Smart contract |
| Émettre `VoteCast(voter, choiceIndex)` | Smart contract |
| Rejeter un votant sans NFT | Smart contract |
| Rejeter un double vote | Smart contract |
| Rejeter un choiceIndex hors limites | Smart contract |
| Rejeter si élection pas ouverte | Smart contract |
| Accepter un vote multiple (approbation) | Smart contract |
| Vote uninominal < 100k gas | Smart contract |
| Flow complet : connexion → vote → confirmation | Intégration |
| Vote custodial : API → backend signe → tx on-chain | Intégration |
| Mise à jour participation_log après vote | Intégration |
| Sélectionner un candidat et voter (mock wallet) | E2E |
| Afficher "Vous avez déjà voté" | E2E |

### Proof

- `voteCounts(choiceIndex)` incrémenté on-chain
- `hasVoted(mmeClubY.wallet)` == true
- Log `VoteCast` dans la transaction
- `participation_log.has_voted` == true, `tx_hash` renseigné
- 2e vote → revert "Already voted"
- La DB ne contient PAS le `choiceIndex`

---

## UC-6 — Décompte

> Verivo déclenche le décompte du scrutin.

### Acteurs
- **M. FédéX** : déclenche la clôture
- **Verivo (système)** : exécute close + tally on-chain

### Scénario principal

1. Date de fin atteinte OU M. FédéX clique "Clôturer"
2. Backend appelle `VerivoElection.close()` → statut `closed`, plus de votes
3. Backend appelle `VerivoElection.tally()` → statut `tallied`
4. Backend lit `getResults()` + `totalVotes()` on-chain
5. Résultats enregistrés en DB : `election_results` (vote_count, percentage, rank)
6. M. FédéX voit : tableau résultats, taux de participation, quorum atteint/non

### Règles métier

- Seul l'owner (wallet Verivo) peut `close()` et `tally()`
- `close()` puis `tally()` : deux transactions séparées
- Le tally est **déterministe** : calculable par quiconque à partir des données on-chain
- Résultats en DB pour accès rapide, blockchain = source de vérité
- Taux de participation = `totalVotes / nombre d'inscrits`

### API

```
POST /api/organizations/:orgSlug/elections/:id/close
→ 200 : { txHash, status: 'closed' }

POST /api/organizations/:orgSlug/elections/:id/tally
→ 200 : { txHash, status: 'tallied', results[], summary: { totalVotes, totalRegistered, participationRate, quorum, quorumReached } }
```

### Tests

| Test | Type |
|---|---|
| Passer le statut à 'closed' | Smart contract |
| Émettre `ElectionClosed` | Smart contract |
| Empêcher tout vote après close | Smart contract |
| Passer le statut à 'tallied' | Smart contract |
| Émettre `ElectionTallied` | Smart contract |
| Retourner les résultats via `getResults()` | Smart contract |
| Fonctionner avec 0 votes | Smart contract |
| Rejeter close/tally si pas le bon statut | Smart contract |
| Rejeter close/tally par non-owner | Smart contract |
| Résultats identiques avant/après tally (déterminisme) | Smart contract |
| Flow : close → tally → résultats DB | Intégration |
| Cohérence on-chain / DB | Intégration |
| Calcul taux de participation | Intégration |
| Flag quorumReached | Intégration |

### Proof

- `status()` on-chain == Tallied
- Vote après close → revert
- `getResults()` retourne les compteurs exacts
- `election_results.vote_count` == `voteCounts[i]` on-chain
- Hash de la tx de tally vérifiable sur l'explorateur

---

## UC-7 — Vérification universelle

> Tout le monde peut vérifier le résultat du scrutin.

### Acteurs
- **Tout le monde** : avec ou sans compte Verivo

### Scénario principal

1. Accès à `/public/elections/:id/results` (sans authentification)
2. La page affiche :
   - Résumé du scrutin, tableau des résultats (choix, votes, %, rang)
   - Statistiques : inscrits, votants, taux, quorum
   - Preuves blockchain : adresses contrats, hash tx déploiement + tally
3. Vérification indépendante possible :
   - Lire `getResults()` directement sur le contrat
   - Recompter via les événements `VoteCast`
   - Vérifier NFTs mintés vs votes
   - **Script de vérification téléchargeable** (Node.js autonome)

### Règles métier

- Résultats **publics** : aucune authentification
- Source de vérité = blockchain
- Identités non divulguées (seules les adresses wallet sont on-chain)
- URL stable, partageable
- Script de vérification fourni pour audit off-line

### API

```
GET /api/public/elections/:id/results       (pas d'auth)
→ 200 : { election, results[], statistics, blockchain: { network, chainId, contracts, txHashes, explorerUrl }, verification: { onChainResults, isConsistent } }

GET /api/public/elections/:id/verification-script
→ 200 : fichier JavaScript autonome
```

### Tests

| Test | Type |
|---|---|
| Retourner les résultats sans authentification | Unit |
| Inclure les preuves blockchain | Unit |
| Calculer `isConsistent` (DB vs on-chain) | Unit |
| `getResults()` accessible par tout le monde | Smart contract |
| Recompter via événements == getResults() | Smart contract |
| `totalVotes` == somme des voteCounts | Smart contract |
| Chaque adresse n'apparaît qu'une fois | Smart contract |
| Accéder sans token → 200 OK | Intégration |
| Exécuter le script de vérification | Intégration |
| Afficher la page de résultats publics | E2E |
| Afficher les liens explorateur | E2E |

### Proof

- GET sans token → 200 OK
- `getResults()` on-chain == résultats affichés
- Somme des événements `VoteCast` == `totalVotes`
- `isConsistent` == true
- Script de vérification → mêmes résultats

---

## UC-8 — Badge NFT de participation (Bonus)

> Mme ClubY reçoit un Badge NFT personnalisé attestant de sa participation au scrutin.

### Acteurs
- **Verivo (système)** : mint après le tally
- **Mme ClubY** : récipiendaire

### Scénario principal

1. Après le tally (UC-6), le système distribue les badges
2. Pour chaque inscrit dans `voter_registry` :
   - `has_voted == true` → badge "A participé" (visuel gold)
   - `has_voted == false` → badge "N'a pas participé" (visuel silver)
3. Métadonnées ERC-721 (name, description, image, attributes) uploadées sur IPFS
4. Image SVG générée dynamiquement (titre, organisation, date, participation)
5. NFT minté vers le wallet du votant
6. Enregistrement dans `tenant.voter_nfts` (nft_type = `participation_proof`)
7. Visible dans le dashboard Verivo ET dans le wallet (OpenSea, etc.)

### Règles métier

- Badge **transférable** (ERC-721 standard, contrairement au voting NFT soul-bound)
- Métadonnées standard ERC-721 Metadata
- Image SVG on-chain ou IPFS
- Badges mintés APRÈS le tally (pour inclure les non-participants)
- Le badge contient le résultat du scrutin dans ses attributs

### Métadonnées (exemple)

```json
{
  "name": "Participation — Élection président FédéX",
  "description": "Badge attestant de la participation au scrutin",
  "image": "ipfs://Qm...",
  "attributes": [
    { "trait_type": "Scrutin", "value": "Élection du président" },
    { "trait_type": "Organisation", "value": "Fédération X" },
    { "trait_type": "Date", "value": "2026-03-15" },
    { "trait_type": "Participation", "value": "A participé" },
    { "trait_type": "Taux de participation", "value": "78%" }
  ]
}
```

### API

```
POST /api/organizations/:orgSlug/elections/:id/badges/distribute
→ 200 : { totalBadges, participatedCount, notParticipatedCount, contractAddress }

GET /api/me/badges
→ 200 : { badges: [{ tokenId, contractAddress, electionTitle, participated, imageUrl, explorerUrl }] }
```

### Tests

| Test | Type |
|---|---|
| Minter un badge participation | Smart contract |
| Minter un badge non-participation | Smart contract |
| Minter en batch | Smart contract |
| Stocker les métadonnées (tokenURI) | Smart contract |
| Permettre le transfert (pas soul-bound) | Smart contract |
| `badgesOf(owner)` retourne les tokens | Smart contract |
| Rejeter mint par non-owner | Smart contract |
| Flow : tally → distribution → badges mintés | Intégration |
| Participants → badge "participé" | Intégration |
| Non-participants → badge "non participé" | Intégration |
| Métadonnées IPFS valides | Intégration |
| Afficher la collection dans le dashboard | E2E |

### Proof

- `balanceOf(mmeClubY.wallet)` ≥ 1 sur le contrat badge
- `tokenURI(tokenId)` → JSON conforme ERC-721 Metadata
- `getBadgeInfo(tokenId).participated` == `participation_log.has_voted`
- `transferFrom` fonctionne (transférable)
- Nombre de badges == nombre d'inscrits dans voter_registry

---

# 8. Smart contracts

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    Réseau Blockchain (Polygon)               │
│                                                              │
│  ┌───────────────────┐    ┌───────────────────────┐         │
│  │ VerivoElection     │◄───│ VerivoVotingNFT        │         │
│  │ (1 par scrutin)    │    │ ERC-721 Soul-bound     │         │
│  │                    │    │                         │         │
│  │ • vote()           │    │ • mint() / batchMint() │         │
│  │ • voteMultiple()   │    │ • burn()               │         │
│  │ • close()          │    │ • ✗ transferFrom       │         │
│  │ • tally()          │    │ • ✗ approve            │         │
│  │ • getResults()     │    └───────────────────────┘         │
│  └───────────────────┘                                       │
│                                                              │
│  ┌───────────────────────────┐                               │
│  │ VerivoParticipationBadge   │                               │
│  │ ERC-721 Standard           │                               │
│  │                             │                               │
│  │ • mintBadge()               │                               │
│  │ • batchMintBadges()         │                               │
│  │ • ✓ transferFrom            │                               │
│  │ • tokenURI → IPFS           │                               │
│  └───────────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

## Contrôle d'accès

| Contrat | Fonction | Accès |
|---|---|---|
| VerivoElection | `vote()` | Détenteur NFT uniquement |
| VerivoElection | `close()`, `tally()` | Owner (Verivo) uniquement |
| VerivoElection | `getResults()`, `hasVoted()`, `totalVotes()` | Public (view) |
| VerivoVotingNFT | `mint()`, `batchMint()`, `burn()` | Minter uniquement |
| VerivoVotingNFT | `transferFrom`, `approve` | **BLOQUÉ** (soul-bound) |
| VerivoParticipationBadge | `mintBadge()`, `batchMintBadges()` | Owner uniquement |
| VerivoParticipationBadge | `transferFrom` | Standard ERC-721 |

## Interaction vote

```solidity
function vote(uint8 choiceIndex) external onlyEligible {
    address voter = _msgSender();           // ERC-2771 : vrai sender
    require(!hasVoted[voter], "Already voted");
    require(choiceIndex < choicesCount, "Invalid choice");

    hasVoted[voter] = true;
    voteCounts[choiceIndex]++;
    totalVotes++;

    emit VoteCast(voter, choiceIndex);
}
```

---

# 9. Jetons numériques (NFT)

## Deux types de jetons, deux rôles distincts

| | VerivoVotingNFT | VerivoParticipationBadge |
|---|---|---|
| **Standard** | ERC-721 étendu | ERC-721 standard |
| **Transférabilité** | Non-transférable (soul-bound) | Transférable |
| **Rôle** | Droit de vote | Preuve de participation |
| **Cycle de vie** | Minté au déploiement → optionnellement brûlé au vote | Minté après le tally |
| **Librairie** | OpenZeppelin ERC721 + override transfer | OpenZeppelin ERC721URIStorage |
| **Métadonnées** | Minimales (election, voter) | Riches (image SVG, attributs, IPFS) |

## Justification du choix OpenZeppelin

- **Auditée** : OpenZeppelin est la librairie la plus auditée de l'écosystème Solidity (audits Trail of Bits, Consensys Diligence)
- **Standard** : implémentation de référence des EIPs (ERC-721, ERC-2771)
- **Modulaire** : extensions composables (URIStorage, Ownable, ERC2771Context)
- **Maintenue** : mises à jour régulières, communauté active

## Pourquoi soul-bound pour le droit de vote

Un NFT de vote transférable permettrait de **vendre son droit de vote** ou de **concentrer les votes** sur une seule adresse. Le soul-bound garantit : 1 inscrit = 1 vote, non cessible.

```solidity
// Override qui empêche tout transfert
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    if (from != address(0) && to != address(0)) {
        revert("Soul-bound: non-transferable");
    }
    return super._update(to, tokenId, auth);
}
```

---

# 10. Sécurité — Tableau des attaques connues et contre-mesures

## Attaques smart contracts

| Attaque | Description | Risque Verivo | Contre-mesure |
|---|---|---|---|
| **Reentrancy** | Un contrat malveillant rappelle la fonction avant la fin de l'exécution | Faible (pas de transfert d'ETH dans vote) | Pattern checks-effects-interactions + `ReentrancyGuard` (OpenZeppelin) |
| **Integer overflow/underflow** | Dépassement de capacité d'un entier | Nul | Solidity 0.8+ : checked math natif (revert automatique) |
| **Front-running** | Un mineur/MEV bot voit la transaction en mempool et agit avant | Faible — le vote est en clair, pas d'avantage à front-runner un vote | Assumé par design (vote public). Pour un futur vote secret : commit-reveal |
| **Replay attack (signature)** | Rejouer une signature EIP-712 sur un autre contrat/chain | Moyen | Nonce + chainId + verifyingContract dans le domaine EIP-712 |
| **Access control** | Un utilisateur non autorisé appelle une fonction admin | Élevé | `Ownable` pour close/tally, vérification `balanceOf` pour vote |
| **Denial of Service (gas)** | Boucle coûteuse qui bloque le contrat | Faible | Comptage incrémental (pas de boucle dans tally), batch minting hors vote |
| **Soul-bound bypass** | Tenter de transférer un NFT de vote | Élevé si non protégé | Override de `_update` qui revert si `from != 0 && to != 0` |
| **Double vote** | Voter deux fois | Critique | `mapping(address => bool) hasVoted` vérifié avant chaque vote |
| **Vote après clôture** | Voter quand le scrutin est fermé | Élevé | `require(status == Status.Open)` dans le modifier `onlyEligible` |
| **Forge de NFT** | Minter des NFTs de vote sans autorisation | Critique | `onlyMinter` modifier, seul le wallet Verivo peut minter |

## Attaques Web / infrastructure

| Attaque | Description | Contre-mesure |
|---|---|---|
| **Injection SQL** | Requêtes SQL malveillantes via les inputs | Prisma ORM (requêtes paramétrées), `$executeRaw` avec paramètres bindés |
| **XSS** | Injection de script dans le frontend | React échappe par défaut, CSP headers via Nginx |
| **CSRF** | Requête forgée depuis un autre site | JWT Bearer token (pas de cookie), CORS restrictif |
| **Brute force login** | Tentatives massives de mot de passe | Rate limiting (express-rate-limit), bcrypt (coût élevé) |
| **Fuite de clé privée custodiale** | Accès à la clé privée d'un wallet custodial | Chiffrement AES-256-GCM, clé de chiffrement en variable d'environnement, jamais en DB en clair |
| **Man-in-the-middle** | Interception des communications | HTTPS obligatoire (Nginx SSL), redirection HTTP→HTTPS |
| **Wallet opérateur compromis** | Accès au wallet Verivo (déploiement, mint, tally) | Clé privée en variable d'environnement serveur, jamais dans le code. En production : HSM ou vault |

## Analyse critique des interactions utilisateur

| Interaction | Risque | Analyse |
|---|---|---|
| Inscription (register) | Création de comptes massifs | Rate limiting + validation email |
| Import CSV | Fichier malveillant (taille, format) | Limite de taille (10MB), parsing strict, validation ligne par ligne |
| Vote (wallet direct) | L'utilisateur signe une tx malveillante | La WebApp construit la tx, l'utilisateur voit le détail dans MetaMask avant de signer |
| Vote (custodial) | Le backend signe à la place de l'utilisateur | Le backend ne connaît que le choiceIndex — il ne peut pas voter pour un autre candidat que celui choisi par l'utilisateur |
| Résultats publics | Affichage de faux résultats | Double-vérification DB vs on-chain (`isConsistent`), script de vérification téléchargeable |

---

# 11. Tests fonctionnels — Stratégie et couverture

## Outils

| Couche | Outil | Rôle |
|---|---|---|
| Smart contracts | Hardhat + Chai + ethers.js | Tests unitaires et d'intégration Solidity |
| Smart contracts | `solidity-coverage` | Mesure de couverture |
| Backend | Jest (ou Vitest) | Tests unitaires et d'intégration API |
| Frontend | Vitest + React Testing Library | Tests composants |
| E2E | Playwright (ou Cypress) | Tests navigateur bout-en-bout |

## Objectif de couverture

| Couche | Objectif | Justification |
|---|---|---|
| Smart contracts | **> 90%** | Code critique et immuable une fois déployé |
| Backend (services) | **> 80%** | Logique métier (création scrutin, import CSV, orchestration) |
| Backend (routes) | **> 70%** | Validation et routing |
| Frontend | **> 60%** | Composants critiques (vote, résultats) |
| **Global** | **> 80%** | **Exigence Alyra C6** |

## Récapitulatif des tests par UC

| UC | Tests smart contract | Tests unit backend | Tests intégration | Tests E2E |
|---|---|---|---|---|
| UC-1 Onboarding | — | 9 | 5 | 3 |
| UC-2 Configuration | — | 12 | 4 | 5 |
| UC-3 Déploiement | 12 | — | 4 | — |
| UC-4 Vérification | — | 5 | 3 | 3 |
| UC-5 Vote | 11 | — | 4 | 4 |
| UC-6 Décompte | 10 | — | 4 | — |
| UC-7 Vérification | 5 | 3 | 2 | 3 |
| UC-8 Badge | 8 | — | 5 | 3 |
| **Total** | **46** | **29** | **31** | **21** |

## Commandes

```bash
# Smart contracts
cd blockchain && npx hardhat test
npx hardhat coverage

# Backend
cd backend && npm test
npm run test:coverage

# Frontend
cd frontend && npm test
npm run test:coverage

# E2E
npx playwright test
```

---

# 12. CI/CD — Intégration continue

## Pipeline GitHub Actions

```yaml
# .github/workflows/ci.yml
name: Verivo CI

on: [push, pull_request]

jobs:
  smart-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd Verivo/blockchain && npm ci
      - run: cd Verivo/blockchain && npx hardhat compile
      - run: cd Verivo/blockchain && npx hardhat test
      - run: cd Verivo/blockchain && npx hardhat coverage
      # Vérifier couverture > 80%

  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: verivo
          POSTGRES_PASSWORD: verivo_secret
          POSTGRES_DB: verivo_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd Verivo/backend && npm ci
      - run: cd Verivo/backend && npx prisma migrate deploy
      - run: cd Verivo/backend && npm test -- --coverage

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd Verivo/frontend && npm ci
      - run: cd Verivo/frontend && npm run build
      - run: cd Verivo/frontend && npm test -- --coverage

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd Verivo/blockchain && npm ci && npx solhint 'contracts/**/*.sol'
```

## Historisation des versions

- **Outil** : Git (GitHub)
- **Branching** : `main` (production), `develop` (intégration), feature branches (`feat/UC-x-...`)
- **Commits** : conventionnels (`feat:`, `fix:`, `test:`, `docs:`)
- **Tags** : versioning sémantique (`v1.0.0`, `v1.1.0`)
- **Protection** : `main` protégé, merge via PR uniquement, CI doit passer

---

# 13. Déploiement

## Smart contracts

| Environnement | Réseau | Outil | Usage |
|---|---|---|---|
| Local | Hardhat Network | `npx hardhat node` | Développement + tests |
| Testnet | Polygon Amoy (chainId 80002) | Hardhat deploy script | Tests d'intégration, démo |
| Testnet alt. | Sepolia (chainId 11155111) | Hardhat deploy script | Compatibilité Ethereum |
| Production | Polygon (chainId 137) | Hardhat deploy script | Production |

```bash
# Compilation
npx hardhat compile

# Déploiement testnet
npx hardhat run scripts/deploy.js --network amoy

# Vérification du code source
npx hardhat verify --network amoy <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Application Web

| Service | Hébergement | URL |
|---|---|---|
| Frontend | Vercel ou Netlify | `https://verivo.app` |
| Backend | VPS Docker (ou Railway) | `https://api.verivo.app` |
| PostgreSQL | VPS Docker (ou Supabase) | Interne |

## Variables d'environnement

```env
# Blockchain
POLYGON_RPC_URL=https://polygon-rpc.com
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=0x...
CHAIN_ID=80002

# Backend
DATABASE_URL=postgresql://verivo:***@postgres:5432/verivo
JWT_SECRET=<secret>
CUSTODIAL_ENCRYPTION_KEY=<secret>

# IPFS
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# Explorateur
POLYGONSCAN_API_KEY=...
```

---

# 14. Stratégie Gasless

## Principe

Le votant **signe** son vote (off-chain, gratuit) mais ne **paie jamais** de gas. Le backend Verivo relaie la transaction.

```
Votant                    Verivo Backend (Relayer)       Smart Contract
──────                    ────────────────────────       ──────────────
  │── signe (EIP-712) ──────>│                               │
  │   (gratuit)               │── envoie la tx (paie gas) ──>│
  │                           │                               │── vérifie signature
  │                           │                               │── enregistre le vote
  │<── confirmation ──────────│<── tx receipt ────────────────│
```

## Stack technique

| Composant | Rôle |
|---|---|
| **ERC-2771** (OpenZeppelin) | Le contrat extrait le vrai `msg.sender` depuis les calldata du Trusted Forwarder |
| **EIP-712** | Signature typée lisible dans MetaMask |
| **Relayer Verivo** | Le backend reçoit la signature, construit la meta-tx, soumet on-chain |
| **Polygon** | Gas natif très faible |

## Coûts

| Opération | Payé par | Coût (Polygon, 100 votants) |
|---|---|---|
| Déploiement contrats | Verivo | ~$0.11 |
| Mint NFTs (batch) | Verivo | ~$0.16 |
| Votes (relayés) | Verivo | ~$0.25 |
| Close + Tally | Verivo | ~$0.003 |
| Badges (batch) | Verivo | ~$0.18 |
| **Total** | **Verivo** | **~$0.70** |
| **Coût pour le votant** | | **$0** |

## Évolution

Si le volume augmente : migration vers **ERC-4337 (Account Abstraction)** avec Paymaster pour mutualiser les coûts gas.

---

# 15. Stack technique

| Couche | Technologie | Version | Rôle |
|---|---|---|---|
| Frontend | React | 19 | Interface utilisateur |
| Frontend | Vite | 6 | Build tool |
| Frontend | wagmi + viem | latest | Connexion wallet |
| Frontend | react-router-dom | 7 | Routing SPA |
| Backend | Express | 4 | API REST |
| Backend | Prisma | 6 | ORM PostgreSQL |
| Backend | ethers.js | 6 | Interaction blockchain |
| Backend | bcrypt | 5 | Hash mots de passe |
| Backend | jsonwebtoken | 9 | Authentification JWT |
| Backend | siwe | latest | Sign-In with Ethereum |
| Backend | multer + csv-parse | latest | Import CSV |
| Database | PostgreSQL | 16 | Persistance multi-tenant |
| Blockchain | Solidity | 0.8.24 | Smart contracts |
| Blockchain | Hardhat | latest | Framework dev + test + deploy |
| Blockchain | OpenZeppelin | 5.x | ERC-721, Ownable, ERC2771Context |
| Blockchain | solidity-coverage | latest | Couverture de tests |
| Infra | Docker Compose | latest | Orchestration |
| Infra | Nginx | alpine | Reverse proxy + SSL |
| CI/CD | GitHub Actions | — | Intégration continue |

---

# 16. Matrice de conformité Alyra (C1–C8)

| Compétence | Exigence | Livrable Verivo | Section |
|---|---|---|---|
| **C1** — Cahier des charges | Besoin identifié, apport blockchain démontré, objectifs définis, schéma fonctionnel + arborescence | Ce document (cahier des charges complet) | §1-6 |
| **C2** — Smart contract Solidity | Langage adapté, compilation sans erreurs, répond aux fonctionnalités | 3 contrats Solidity 0.8.24 : VerivoElection, VerivoVotingNFT, VerivoParticipationBadge | §8 + UC-3/5/6/8 |
| **C3** — Jeton numérique | Librairies auditées + justifiées, fonctionnalités NFT implémentées | OpenZeppelin ERC-721 (audité). Deux types NFT : soul-bound (droit vote) + transférable (badge) | §9 |
| **C4** — Sécurité | Optimisation gas/mémoire, vulnérabilités identifiées + solutions, tableau attaques | Tableau de 10 attaques smart contract + 7 attaques web + analyse interactions | §10 |
| **C5** — CI/CD + versioning | Intégration continue, outil d'historisation | GitHub Actions (compile, test, coverage, lint) + Git avec branching protégé | §12 |
| **C6** — Tests > 80% | Procédure expliquée, couverture > 80%, moyens expliqués | 127 cas de test (46 smart contract, 29 unit backend, 31 intégration, 21 E2E). Hardhat + Jest + Playwright. Coverage cible > 80% | §11 |
| **C7** — Frontend ↔ blockchain | Langage web adapté, syntaxe maîtrisée, hébergement public, fonctionnalités accessibles | React 19 + wagmi/viem. Vote, résultats, badges accessibles via l'interface. Hébergement Vercel/Netlify | §13 + UC-5/7 |
| **C8** — Déploiement on-chain | Déployé via outil adapté, réseau adapté, interactions possibles | Hardhat sur Polygon Amoy (testnet). vote(), tally(), getResults(), mint — toutes interactions fonctionnelles | §13 |
