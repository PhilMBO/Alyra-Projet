# UC-3 — Déploiement par Verivo

> Verivo déploie le smart-contract du scrutin et opère la distribution des NFT représentant les droits de vote.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **M. FédéX** : déclenche le déploiement depuis le dashboard
- **Verivo (système)** : déploie le contrat et mint les NFTs

### Pré-conditions
- Le scrutin existe en statut 'draft'
- Au moins 2 choix sont définis
- Au moins 1 votant est inscrit dans le voter_registry
- Le backend dispose d'un wallet opérateur Verivo (funded en gas)

### Scénario principal

```
1. M. FédéX clique sur "Déployer le scrutin"
2. Le système vérifie les pré-conditions
3. Le backend déploie le smart contract VerivoElection :
   a. Paramètres du constructeur :
      - Liste des choix (identifiants + labels hashés)
      - Adresse de l'admin Verivo (owner du contrat)
      - Type de scrutin
      - Quorum
   b. Le contract_address est enregistré dans tenant.elections
4. Le système déploie (ou utilise) le contrat VerivoVotingNFT :
   a. NFT soul-bound (non-transférable, ERC-721 étendu)
   b. Lié au contrat d'élection
5. Le système mint un NFT de droit de vote pour chaque votant inscrit :
   a. Pour chaque entrée dans voter_registry :
      - Mint un NFT soul-bound vers le wallet_address du votant
      - Enregistre token_id, tx_hash, contract_address dans tenant.voter_nfts
      - Met à jour nft_status = 'minted'
   b. Opération en batch pour optimiser le gas
6. Le statut de l'élection passe à 'open'
7. M. FédéX voit la confirmation avec :
   - Adresse du contrat d'élection
   - Nombre de NFTs mintés
   - Lien vers l'explorateur blockchain
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Pas assez de gas sur le wallet Verivo | 503 — "Fonds insuffisants pour le déploiement" |
| E2 | Échec déploiement contrat | 500 — rollback, scrutin reste en 'draft' |
| E3 | Échec mint partiel | Le système retente les mints échoués (3 tentatives max) |
| E4 | Scrutin pas en statut 'draft' | 400 — "Le scrutin a déjà été déployé" |
| E5 | Aucun votant inscrit | 400 — "Importez au moins un votant avant le déploiement" |
| E6 | Moins de 2 choix | 400 — "Un scrutin doit avoir au moins 2 choix" |

### Règles métier

- **RG-3.1** : Le déploiement est **irréversible** — une fois déployé, les choix ne peuvent plus être modifiés
- **RG-3.2** : Le NFT de droit de vote est soul-bound : non-transférable (override de `transferFrom` qui revert)
- **RG-3.3** : Le mint est effectué par le wallet opérateur Verivo (seul minter autorisé)
- **RG-3.4** : Les mints sont exécutés en batch (multicall) pour réduire les coûts gas
- **RG-3.5** : Le contrat d'élection valide qu'un votant possède un NFT de droit de vote avant d'accepter un vote
- **RG-3.6** : Le wallet opérateur Verivo est le seul à pouvoir déclencher le tally (UC-6)
- **RG-3.7** : Le contrat stocke les choix sous forme de `bytes32` (keccak256 du label)

---

## 2. TYPES — Contrats de données

### Smart Contracts (Solidity)

#### VerivoElection.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerivoElection {
    // --- Events ---
    event ElectionCreated(bytes32 indexed electionId, uint8 votingSystem);
    event VoteCast(address indexed voter, uint8 choiceIndex);
    event ElectionTallied(bytes32 indexed electionId);
    event ElectionClosed(bytes32 indexed electionId);

    // --- Structs ---
    struct Choice {
        bytes32 labelHash;       // keccak256 du label
        uint256 voteCount;
    }

    // --- State Variables (exposed via getters) ---
    // bytes32 public electionId;
    // uint8 public votingSystem;    // 0=uninominal_1tour, 1=uninominal_2tours, ...
    // uint8 public status;          // 0=open, 1=closed, 2=tallied
    // uint256 public quorum;
    // address public votingNFT;     // adresse du contrat NFT
    // address public owner;         // wallet Verivo

    // --- Functions ---
    function vote(uint8 choiceIndex) external;
    function tally() external;       // onlyOwner
    function close() external;       // onlyOwner
    function getChoices() external view returns (Choice[] memory);
    function getResults() external view returns (Choice[] memory);
    function hasVoted(address voter) external view returns (bool);
    function totalVotes() external view returns (uint256);
    function voterCount() external view returns (uint256);
}
```

#### VerivoVotingNFT.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ERC-721 soul-bound (non-transférable)
interface IVerivoVotingNFT {
    // --- Events ---
    event VotingRightMinted(address indexed to, uint256 tokenId);
    event VotingRightBurned(address indexed from, uint256 tokenId);

    // --- Functions ---
    function mint(address to) external returns (uint256);        // onlyMinter
    function batchMint(address[] calldata to) external returns (uint256[] memory); // onlyMinter
    function burn(uint256 tokenId) external;                     // onlyMinter ou owner du token
    function setElectionContract(address election) external;     // onlyOwner

    // ERC-721 overrides pour soul-bound
    // transferFrom → revert "Soul-bound: non-transférable"
    // safeTransferFrom → revert "Soul-bound: non-transférable"
    // approve → revert "Soul-bound: non-transférable"
}
```

### API Contract

#### Déployer un scrutin

```
POST /api/organizations/:orgSlug/elections/:electionId/deploy
Authorization: Bearer <token>
```

```typescript
// Pas de body — le système utilise les données existantes

interface DeployElectionResponse {
  electionId: string;
  contractAddress: string;         // adresse du contrat VerivoElection
  nftContractAddress: string;      // adresse du contrat VerivoVotingNFT
  deployTxHash: string;            // hash de la transaction de déploiement
  mintedNFTs: number;              // nombre de NFTs mintés
  status: 'open';
  explorerUrl: string;             // lien vers l'explorateur (etherscan, polygonscan...)
}
```

#### Suivre le déploiement (polling ou WebSocket)

```
GET /api/organizations/:orgSlug/elections/:electionId/deploy/status
```

```typescript
interface DeployStatusResponse {
  step: 'deploying_contract' | 'minting_nfts' | 'completed' | 'failed';
  progress: {
    totalVoters: number;
    mintedCount: number;
    failedCount: number;
  };
  contractAddress?: string;
  error?: string;
}
```

### Types internes backend

```typescript
interface DeployConfig {
  rpcUrl: string;                  // URL du nœud Ethereum/Polygon
  chainId: number;
  operatorPrivateKey: string;      // clé du wallet Verivo (env var)
  gasLimit: bigint;
  maxFeePerGas?: bigint;
}

interface MintBatch {
  addresses: string[];             // wallets des votants
  batchSize: number;               // nombre d'adresses par transaction batch
  retryCount: number;              // nombre de tentatives par batch
}
```

---

## 3. TESTS — Cas de test

### Tests smart contracts (Hardhat/Chai)

```
test/VerivoElection.test.js
├── Deployment
│   ├── ✓ devrait déployer avec les choix corrects
│   ├── ✓ devrait initialiser le status à 'open'
│   ├── ✓ devrait enregistrer l'owner (wallet Verivo)
│   ├── ✗ devrait rejeter le déploiement sans choix
│   └── ✗ devrait rejeter le déploiement avec un seul choix
├── Vote (testé en détail dans UC-5)
│   └── ✓ devrait être callable (vérifié dans UC-5)
└── Access Control
    ├── ✓ seul l'owner peut tally
    ├── ✓ seul l'owner peut close
    └── ✗ un non-owner ne peut pas tally/close

test/VerivoVotingNFT.test.js
├── Minting
│   ├── ✓ devrait minter un NFT vers une adresse
│   ├── ✓ devrait minter en batch
│   ├── ✓ devrait incrémenter les tokenIds
│   ├── ✗ devrait rejeter le mint par un non-minter
│   └── ✗ devrait rejeter le mint vers l'adresse zéro
├── Soul-bound
│   ├── ✗ devrait rejeter transferFrom
│   ├── ✗ devrait rejeter safeTransferFrom
│   └── ✗ devrait rejeter approve
├── Burning
│   ├── ✓ devrait brûler un NFT
│   └── ✗ devrait rejeter le burn d'un NFT inexistant
```

### Tests d'intégration backend

```
test-integration/deploy.test.js
├── ✓ devrait déployer le contrat sur un réseau local (Hardhat node)
├── ✓ devrait minter les NFTs pour tous les votants
├── ✓ devrait mettre à jour le contract_address dans la DB
├── ✓ devrait passer le statut de l'élection à 'open'
├── ✓ devrait enregistrer les voter_nfts avec status 'minted'
├── ✗ devrait échouer si le scrutin n'est pas en 'draft'
└── ✗ devrait retenter les mints échoués
```

---

## 4. IMPLEMENTATION — Plan

### Smart Contracts (Hardhat)

| Fichier | Action |
|---|---|
| `blockchain/contracts/VerivoElection.sol` | Contrat de scrutin |
| `blockchain/contracts/VerivoVotingNFT.sol` | NFT soul-bound ERC-721 |
| `blockchain/contracts/interfaces/IVerivoElection.sol` | Interface du contrat |
| `blockchain/scripts/deploy.js` | Script de déploiement |
| `blockchain/hardhat.config.js` | Configuration Hardhat (réseaux, compilateur) |
| `blockchain/test/` | Tests Hardhat |

### Backend

| Fichier | Action |
|---|---|
| `src/routes/deploy.js` | Route POST deploy + GET status |
| `src/services/blockchain.service.js` | Interaction blockchain (ethers.js) |
| `src/services/deploy.service.js` | Orchestration déploiement + mint |
| `src/jobs/mint.job.js` | Job asynchrone pour le batch minting |

### Dépendances

| Package | Rôle | Couche |
|---|---|---|
| `hardhat` | Framework smart contracts | Blockchain |
| `@nomicfoundation/hardhat-toolbox` | Plugins Hardhat (ethers, chai, etc.) | Blockchain |
| `@openzeppelin/contracts` | ERC-721, Ownable, ReentrancyGuard | Blockchain |
| `ethers` (v6) | Interaction blockchain | Backend |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Contrat déployé | Vérifier `contract_address` sur l'explorateur blockchain |
| Code vérifié | `npx hardhat verify` sur le réseau cible |
| NFTs mintés | `balanceOf(voter)` == 1 pour chaque votant |
| Soul-bound | Tenter `transferFrom` → revert attendu |
| Owner correct | `owner()` == adresse du wallet Verivo |
| Choix corrects | `getChoices()` retourne les bons labels hashés |
| Statut on-chain | `status()` == 0 (open) |
| DB synchronisée | `voter_nfts.nft_status` == 'minted' pour tous les votants |
| Gas optimisé | Comparer coût batch vs mints individuels |
