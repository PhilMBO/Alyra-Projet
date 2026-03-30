# UC-8 — Badge NFT de participation (Bonus)

> À la fin de chaque vote, Mme ClubY reçoit un Badge NFT personnalisé attestant de sa participation (ou non-participation) au scrutin.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **Verivo (système)** : mint automatiquement les badges après le tally
- **Mme ClubY** : récipiendaire du badge

### Pré-conditions
- Le scrutin est en statut 'tallied' (UC-6 terminé)
- L'utilisateur est inscrit dans le voter_registry

### Scénario principal

```
1. Après le tally (UC-6), le système déclenche la distribution des badges
2. Pour chaque votant inscrit dans le voter_registry :
   a. Si has_voted == true :
      - Mint un NFT "Preuve de participation"
      - Métadonnées personnalisées :
        * Titre du scrutin
        * Date du vote
        * Organisation
        * Visual unique (généré dynamiquement)
        * Mention "A participé"
   b. Si has_voted == false :
      - Mint un NFT "Preuve de non-participation"
      - Même structure de métadonnées
      - Mention "N'a pas participé"
3. Les métadonnées sont stockées sur IPFS (immuables)
4. Le NFT est minté vers le wallet du votant
5. L'enregistrement est fait dans tenant.voter_nfts (nft_type = 'participation_proof')
6. Mme ClubY voit son badge dans :
   - Son dashboard Verivo (collection de badges)
   - Son wallet (MetaMask, OpenSea, etc.) — le NFT est un ERC-721 standard
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Échec mint d'un badge | Retry (3 tentatives), sinon marquer comme 'pending' |
| E2 | IPFS indisponible | Stocker les métadonnées temporairement, retry plus tard |
| E3 | Badge déjà minté pour ce scrutin/utilisateur | Skip (unicité dans voter_nfts) |

### Règles métier

- **RG-8.1** : Le badge NFT est **transférable** (contrairement au NFT de droit de vote) — c'est un collectible
- **RG-8.2** : Les métadonnées suivent le standard ERC-721 Metadata (name, description, image, attributes)
- **RG-8.3** : L'image du badge est générée dynamiquement (SVG on-chain ou image sur IPFS)
- **RG-8.4** : Chaque badge est unique grâce à ses attributs (scrutin, date, participation)
- **RG-8.5** : Le badge est minté APRÈS le tally, pas pendant le vote (pour inclure aussi les non-participants)
- **RG-8.6** : Le badge contient le résultat du scrutin dans ses attributs (transparence)

---

## 2. TYPES — Contrats de données

### Smart Contract

#### VerivoParticipationBadge.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVerivoParticipationBadge {
    // --- Events ---
    event BadgeMinted(
        address indexed to,
        uint256 tokenId,
        bytes32 indexed electionId,
        bool participated
    );

    // --- Structs ---
    struct BadgeInfo {
        bytes32 electionId;
        bool participated;
        uint256 mintedAt;
    }

    // --- Functions ---
    function mintBadge(
        address to,
        bytes32 electionId,
        bool participated,
        string calldata tokenURI
    ) external returns (uint256);    // onlyOwner

    function batchMintBadges(
        address[] calldata recipients,
        bytes32 electionId,
        bool[] calldata participated,
        string[] calldata tokenURIs
    ) external returns (uint256[] memory);  // onlyOwner

    function getBadgeInfo(uint256 tokenId) external view returns (BadgeInfo memory);
    function badgesOf(address owner) external view returns (uint256[] memory);
}
```

### NFT Metadata (ERC-721 standard)

```typescript
interface BadgeMetadata {
  name: string;                     // "Participation - Élection du président FédéX"
  description: string;              // "Badge attestant de la participation au scrutin..."
  image: string;                    // ipfs://Qm... ou data:image/svg+xml;base64,...
  external_url: string;             // lien vers la page de résultats publics
  attributes: BadgeAttribute[];
}

interface BadgeAttribute {
  trait_type: string;
  value: string | number | boolean;
}

// Exemple d'attributes :
// [
//   { trait_type: "Scrutin", value: "Élection du président" },
//   { trait_type: "Organisation", value: "Fédération X" },
//   { trait_type: "Date", value: "2026-03-15" },
//   { trait_type: "Participation", value: "A participé" },
//   { trait_type: "Système de vote", value: "Uninominal 1 tour" },
//   { trait_type: "Taux de participation", value: "78%" },
//   { trait_type: "Nombre de votants", value: 156 },
//   { trait_type: "Réseau", value: "Polygon" }
// ]
```

### API Contract

#### Déclencher la distribution des badges

```
POST /api/organizations/:orgSlug/elections/:electionId/badges/distribute
Authorization: Bearer <token>
```

```typescript
interface DistributeBadgesResponse {
  electionId: string;
  totalBadges: number;
  participatedCount: number;
  notParticipatedCount: number;
  status: 'distributing' | 'completed';
  contractAddress: string;
}
```

#### Mes badges

```
GET /api/me/badges
Authorization: Bearer <token>
```

```typescript
interface MyBadgesResponse {
  badges: Badge[];
}

interface Badge {
  tokenId: number;
  contractAddress: string;
  electionTitle: string;
  organizationName: string;
  participated: boolean;
  mintedAt: string;
  metadataUri: string;
  imageUrl: string;
  explorerUrl: string;
}
```

### Image du badge (SVG dynamique)

```typescript
interface BadgeSvgParams {
  title: string;                    // titre du scrutin
  organization: string;             // nom de l'organisation
  date: string;                     // date du scrutin
  participated: boolean;            // a participé ou non
  participationRate: number;        // taux de participation global
  logoUrl?: string;                 // logo de l'organisation
  colorScheme: 'gold' | 'silver';  // gold = participé, silver = non participé
}
```

---

## 3. TESTS — Cas de test

### Tests smart contract

```
test/VerivoParticipationBadge.test.js
├── Minting
│   ├── ✓ devrait minter un badge de participation
│   ├── ✓ devrait minter un badge de non-participation
│   ├── ✓ devrait minter en batch
│   ├── ✓ devrait stocker les métadonnées (tokenURI)
│   ├── ✓ devrait stocker les infos du badge (BadgeInfo)
│   ├── ✗ devrait rejeter le mint par un non-owner
│   └── ✗ devrait rejeter le mint vers l'adresse zéro
├── Transferabilité
│   ├── ✓ devrait permettre le transfert (contrairement au voting NFT)
│   ├── ✓ devrait permettre l'approbation
│   └── ✓ devrait émettre Transfer
├── Queries
│   ├── ✓ badgesOf() retourne les tokens d'un owner
│   ├── ✓ getBadgeInfo() retourne les bonnes infos
│   └── ✓ tokenURI() retourne l'URI des métadonnées
```

### Tests d'intégration

```
test-integration/badges.test.js
├── ✓ flow complet : tally → distribution → badges mintés
├── ✓ vérifier que les participants reçoivent un badge "participé"
├── ✓ vérifier que les non-participants reçoivent un badge "non participé"
├── ✓ vérifier les métadonnées sur IPFS
├── ✓ vérifier la génération SVG du badge
└── ✓ vérifier l'enregistrement dans voter_nfts
```

### Tests E2E

```
test-e2e/badges.spec.js
├── ✓ afficher la collection de badges dans le dashboard
├── ✓ afficher le détail d'un badge avec son image
├── ✓ afficher le lien vers l'explorateur
└── ✓ afficher le badge dans un wallet externe (OpenSea compatible)
```

---

## 4. IMPLEMENTATION — Plan

### Smart Contracts

| Fichier | Action |
|---|---|
| `blockchain/contracts/VerivoParticipationBadge.sol` | Contrat ERC-721 pour les badges |

### Backend

| Fichier | Action |
|---|---|
| `src/routes/badges.js` | Routes distribution + liste badges |
| `src/services/badge.service.js` | Orchestration mint badges |
| `src/services/metadata.service.js` | Génération métadonnées JSON |
| `src/services/svg.service.js` | Génération image SVG du badge |
| `src/services/ipfs.service.js` | Upload métadonnées + image sur IPFS |

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/MyBadges.jsx` | Page collection de badges |
| `src/components/BadgeCard.jsx` | Carte individuelle d'un badge |
| `src/components/BadgeDetail.jsx` | Modal détail avec métadonnées complètes |

### Dépendances

| Package | Rôle | Couche |
|---|---|---|
| `@pinata/sdk` ou `nft.storage` | Upload IPFS | Backend |
| `sharp` ou `svg-builder` | Génération images | Backend |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Badge minté | `balanceOf(mmeClubY.wallet)` >= 1 sur le contrat badge |
| Métadonnées correctes | `tokenURI(tokenId)` → fetch IPFS → vérifier les attributs |
| Participation correcte | `getBadgeInfo(tokenId).participated` == `participation_log.has_voted` |
| Image accessible | `metadata.image` → URL IPFS valide et téléchargeable |
| Transférable | `transferFrom` fonctionne (contrairement au voting NFT) |
| Compatible OpenSea | `tokenURI` retourne un JSON conforme au standard ERC-721 Metadata |
| Tous les inscrits | Nombre de badges mintés == nombre d'inscrits dans voter_registry |
