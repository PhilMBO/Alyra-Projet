# Architecture Smart Contracts — Verivo

## Vue d'ensemble des contrats

```
┌─────────────────────────────────────────────────────────────────┐
│                        Réseau Blockchain                        │
│                    (Polygon / Ethereum / Testnet)                │
│                                                                 │
│  ┌───────────────────┐    ┌──────────────────────┐              │
│  │ VerivoElection     │    │ VerivoVotingNFT       │              │
│  │ (1 par scrutin)    │◄───│ (1 par scrutin)       │              │
│  │                    │    │ ERC-721 Soul-bound    │              │
│  │ • choices[]        │    │                        │              │
│  │ • voteCounts[]     │    │ • mint()               │              │
│  │ • hasVoted{}       │    │ • batchMint()          │              │
│  │ • vote()           │    │ • burn()               │              │
│  │ • tally()          │    │ • ✗ transferFrom       │              │
│  │ • getResults()     │    │ • ✗ approve            │              │
│  └───────────────────┘    └──────────────────────┘              │
│                                                                 │
│  ┌────────────────────────────┐                                 │
│  │ VerivoParticipationBadge    │                                 │
│  │ (1 global ou 1 par scrutin) │                                 │
│  │ ERC-721 Standard            │                                 │
│  │                              │                                 │
│  │ • mintBadge()                │                                 │
│  │ • batchMintBadges()          │                                 │
│  │ • ✓ transferFrom             │                                 │
│  │ • tokenURI → IPFS            │                                 │
│  └────────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interactions entre contrats

```
  Wallet Votant                VerivoElection              VerivoVotingNFT
  ──────────────               ────────────────            ─────────────────
       │                              │                          │
       │── vote(choiceIndex) ────────>│                          │
       │                              │── balanceOf(voter) ─────>│
       │                              │<── 1 (a le NFT) ────────│
       │                              │                          │
       │                              │── enregistre le vote     │
       │                              │── emit VoteCast          │
       │<── tx receipt ───────────────│                          │
```

---

## Sécurité et contrôle d'accès

### VerivoElection

| Fonction | Accès | Vérifications |
|---|---|---|
| `vote()` | Tout détenteur de NFT | balanceOf > 0, !hasVoted, status == Open |
| `voteMultiple()` | Tout détenteur de NFT | idem + indices valides |
| `close()` | Owner uniquement | status == Open |
| `tally()` | Owner uniquement | status == Closed |
| `getResults()` | Public (view) | Aucune |
| `hasVoted()` | Public (view) | Aucune |
| `totalVotes()` | Public (view) | Aucune |

### VerivoVotingNFT

| Fonction | Accès | Vérifications |
|---|---|---|
| `mint()` | Minter uniquement | to != address(0) |
| `batchMint()` | Minter uniquement | Toutes adresses valides |
| `burn()` | Minter ou owner du token | Token existe |
| `transferFrom()` | **BLOQUÉ** | Revert toujours (soul-bound) |
| `approve()` | **BLOQUÉ** | Revert toujours (soul-bound) |

### VerivoParticipationBadge

| Fonction | Accès | Vérifications |
|---|---|---|
| `mintBadge()` | Owner uniquement | to != address(0) |
| `batchMintBadges()` | Owner uniquement | Arrays même longueur |
| `transferFrom()` | Owner du token ou approuvé | Standard ERC-721 |
| `tokenURI()` | Public (view) | Token existe |

---

## Gas Estimates (approximatifs)

| Opération | Gas estimé | Coût ~Polygon (0.03$/MATIC) |
|---|---|---|
| Déployer VerivoElection | ~2,000,000 | ~$0.06 |
| Déployer VerivoVotingNFT | ~1,500,000 | ~$0.05 |
| Mint 1 NFT | ~100,000 | ~$0.003 |
| Batch mint 50 NFTs | ~2,500,000 | ~$0.08 |
| Vote (uninominal) | ~80,000 | ~$0.0025 |
| Vote (multiple, 5 choix) | ~150,000 | ~$0.005 |
| Close | ~50,000 | ~$0.0015 |
| Tally | ~50,000 | ~$0.0015 |
| Mint 1 badge | ~120,000 | ~$0.004 |
| Batch mint 50 badges | ~3,000,000 | ~$0.09 |

### Coût total pour un scrutin de 100 votants

```
Déploiement contrats   : ~$0.11
Mint 100 voting NFTs   : ~$0.16  (2 batch de 50)
100 votes              : ~$0.25  (payé par chaque votant ou Verivo)
Close + Tally          : ~$0.003
Mint 100 badges        : ~$0.18  (2 batch de 50)
────────────────────────────────
Total                  : ~$0.70 (sur Polygon)
```

---

## Configuration Hardhat

```javascript
// hardhat.config.js
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  networks: {
    hardhat: {},                           // Tests locaux
    localhost: { url: "http://127.0.0.1:8545" },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137
    },
    amoy: {                                // Polygon testnet
      url: process.env.AMOY_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 80002
    },
    sepolia: {                             // Ethereum testnet
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 11155111
    }
  }
};
```

---

## Variables d'environnement requises

```env
# Blockchain
POLYGON_RPC_URL=https://polygon-rpc.com
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
DEPLOYER_PRIVATE_KEY=0x...          # Wallet opérateur Verivo
CHAIN_ID=137                         # Réseau cible

# IPFS (pour les badges)
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# Explorateur (pour la vérification de contrats)
POLYGONSCAN_API_KEY=...
ETHERSCAN_API_KEY=...
```
