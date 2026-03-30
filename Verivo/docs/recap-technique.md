# Verivo — Récap technique (pitch 3-5 min)

## Architecture en 3 couches

```
Frontend (React)  ←→  Backend (Express/Prisma)  ←→  Blockchain (Solidity)
                              ↕
                      PostgreSQL (multi-tenant)
```

## Choix techniques clés

### 1. Double authentification
- **Wallet** (MetaMask/Rabby) via SIWE (Sign-In with Ethereum) — pour les utilisateurs crypto-natifs
- **Email/mot de passe** — le backend crée un **wallet custodial** en arrière-plan (clé privée chiffrée AES-256) pour que tout le monde puisse voter on-chain, même sans connaître la blockchain

### 2. Multi-tenancy PostgreSQL
- Un **schéma isolé par organisation** (`tenant_federation_x`, `tenant_ligue_y`…)
- Les données d'une fédération ne sont jamais accessibles par une autre
- Création automatique du schéma à l'onboarding

### 3. Trois smart contracts
| Contrat | Rôle | Particularité |
|---|---|---|
| **VerivoElection** | Enregistre les votes, calcule les résultats | 1 instance par scrutin |
| **VerivoVotingNFT** | Représente le droit de vote | **Soul-bound** (non-transférable) |
| **VerivoParticipationBadge** | Badge post-scrutin | Transférable, métadonnées IPFS |

### 4. Le vote = une transaction blockchain
- Le choix du votant est enregistré **uniquement on-chain** — la base de données sait **qui** a voté, mais pas **pour qui**
- Pas de double vote possible : le contrat vérifie la possession du NFT + un mapping `hasVoted`
- 4 systèmes de vote supportés : uninominal 1 tour, 2 tours, jugement majoritaire, approbation

### 5. Vérification universelle
- **N'importe qui** peut auditer les résultats en lisant le contrat public
- Un script de vérification téléchargeable recompte tous les votes à partir des événements on-chain

## Flow utilisateur en 30 secondes

```
Admin crée le scrutin → importe un CSV de votants → déploie on-chain
     ↓
Chaque votant reçoit un NFT de droit de vote
     ↓
Les votants signent leur vote via leur wallet (ou le backend signe pour eux)
     ↓
Clôture → décompte on-chain → résultats publics vérifiables par tous
     ↓
Chaque inscrit reçoit un badge NFT de participation
```

## Stratégie Gasless — Zéro coût pour les votants

### Principe

Le votant **signe** son vote (off-chain, gratuit) mais ne **paie jamais** de gas. C'est le backend Verivo qui relaie la transaction et absorbe les frais.

### Implémentation : Meta-transactions (ERC-2771)

```
Votant (wallet/custodial)          Verivo Backend (Relayer)          Smart Contract
─────────────────────────          ────────────────────────          ──────────────
        │                                   │                              │
        │── signe le vote (off-chain) ─────>│                              │
        │   (EIP-712 typed data)            │                              │
        │                                   │── envoie la tx (paie le gas)─>│
        │                                   │                              │── vérifie la signature
        │                                   │                              │── enregistre le vote
        │                                   │                              │── emit VoteCast
        │<── confirmation ──────────────────│<── tx receipt ───────────────│
```

### Stack gasless

| Composant | Rôle |
|---|---|
| **ERC-2771 (OpenZeppelin)** | Le contrat accepte des `Trusted Forwarder` — il extrait le vrai `msg.sender` depuis les calldata |
| **EIP-712** | Le votant signe un message typé (`vote(electionId, choiceIndex)`) lisible dans MetaMask |
| **Relayer Verivo** | Le backend reçoit la signature, construit la meta-tx et la soumet on-chain en payant le gas |
| **Polygon** | Gas natif très faible (~0.003$ par vote) — Verivo absorbe le coût |

### Qui paie quoi

| Opération | Payé par | Coût estimé (Polygon) |
|---|---|---|
| Déploiement contrats | Verivo | ~$0.11 |
| Mint NFTs de droit de vote (batch) | Verivo | ~$0.16 / 100 votants |
| **Vote** | **Verivo (relayer)** | **~$0.25 / 100 votes** |
| Close + Tally | Verivo | ~$0.003 |
| Mint badges (batch) | Verivo | ~$0.18 / 100 votants |
| **Total scrutin 100 votants** | **Verivo** | **~$0.70** |
| **Coût pour le votant** | | **$0** |

### Pourquoi c'est viable

- Sur Polygon, 100 votes relayés coûtent **~$0.25** à Verivo
- Un scrutin complet de 1 000 votants revient à **~$7** en gas
- Ce coût est intégré dans le prix du service (négligeable vs l'infrastructure serveur)
- Si le volume explose : possibilité de migrer vers un **Paymaster** (ERC-4337 Account Abstraction) pour mutualiser encore plus

### Contrat compatible (extrait)

```solidity
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract VerivoElection is ERC2771Context {
    constructor(address trustedForwarder, ...)
        ERC2771Context(trustedForwarder)
    { ... }

    function vote(uint8 choiceIndex) external onlyEligible {
        address voter = _msgSender();  // ← extrait le vrai sender (pas le relayer)
        require(!hasVoted[voter], "Already voted");
        // ...
    }
}
```

## Pourquoi ces choix

| Problème | Solution |
|---|---|
| Tout le monde n'a pas de wallet | Wallet custodial transparent |
| Les votants ne veulent pas payer de gas | Meta-transactions (ERC-2771) — Verivo relaie et paie |
| Confiance dans les résultats | Source de vérité = blockchain publique |
| Isolation des données | 1 schéma PostgreSQL par organisation |
| Coûts gas pour Verivo | Polygon (~$0.70 pour 100 votants) — absorbé dans le service |
| Double vote | NFT soul-bound + vérification on-chain |

## Stack résumée

**React 19 · Express · Prisma · PostgreSQL 16 · Solidity 0.8.24 · Hardhat · ethers.js · OpenZeppelin (ERC-2771) · Docker · Nginx · Polygon**
