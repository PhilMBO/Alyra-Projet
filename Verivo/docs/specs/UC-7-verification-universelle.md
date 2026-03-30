# UC-7 — Vérification universelle

> Tout le monde peut vérifier le résultat du scrutin.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **Tout le monde** : n'importe qui, avec ou sans compte Verivo

### Pré-conditions
- Le scrutin est en statut 'tallied'
- Le contrat est déployé sur un réseau public (Ethereum, Polygon, etc.)

### Scénario principal

```
1. Un utilisateur (avec ou sans compte) accède à la page publique de résultats :
   - Via un lien partagé : /elections/<electionId>/results
   - Via l'explorateur blockchain directement (contrat public)
2. La WebApp affiche les résultats :
   a. Résumé du scrutin (titre, organisation, dates, système de vote)
   b. Tableau des résultats (choix, votes, %, rang)
   c. Statistiques :
      - Nombre d'inscrits
      - Nombre de votants
      - Taux de participation
      - Quorum atteint / non atteint
   d. Preuves cryptographiques :
      - Adresse du contrat d'élection
      - Adresse du contrat NFT
      - Hash de la transaction de tally
      - Hash de la transaction de déploiement
3. L'utilisateur peut vérifier de manière indépendante :
   a. Lire les résultats directement sur le contrat (getResults())
   b. Recompter manuellement en lisant tous les événements VoteCast
   c. Vérifier le nombre de NFTs mintés vs votes enregistrés
   d. Vérifier que chaque votant n'a voté qu'une fois
4. La page affiche un guide "Comment vérifier vous-même" :
   - Lien vers l'explorateur du contrat
   - Instructions pour lire les fonctions publiques
   - Script de vérification téléchargeable
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Scrutin pas encore tallied | Afficher "Résultats en attente de décompte" |
| E2 | Contrat sur un réseau inaccessible | Afficher les résultats DB avec avertissement |
| E3 | Incohérence on-chain / off-chain | Afficher un avertissement et les deux sources |

### Règles métier

- **RG-7.1** : Les résultats sont **publics** — aucune authentification requise
- **RG-7.2** : La source de vérité est la blockchain, pas la base de données
- **RG-7.3** : Tout le monde peut recompter indépendamment en lisant les événements VoteCast
- **RG-7.4** : L'identité des votants n'est pas divulguée (seules les adresses wallet sont visibles on-chain)
- **RG-7.5** : La page de résultats est linkable et shareable (URL stable)
- **RG-7.6** : Un script de vérification est fourni pour permettre un audit complet off-line

---

## 2. TYPES — Contrats de données

### API Contract (public, pas d'auth)

#### Résultats publics

```
GET /api/public/elections/:electionId/results
```

```typescript
interface PublicElectionResultsResponse {
  election: {
    id: string;
    title: string;
    description?: string;
    organizationName: string;
    votingSystem: VotingSystem;
    choiceType: 'candidate' | 'proposal';
    status: 'tallied';
    startDate: string;
    endDate: string;
  };
  results: PublicResult[];
  statistics: {
    totalRegistered: number;
    totalVotes: number;
    participationRate: number;
    quorum: number;
    quorumReached: boolean;
  };
  blockchain: {
    network: string;                  // "polygon", "ethereum", "sepolia"...
    chainId: number;
    electionContract: string;         // adresse
    nftContract: string;              // adresse
    deployTxHash: string;
    tallyTxHash: string;
    explorerBaseUrl: string;          // ex: "https://polygonscan.com"
  };
  verification: {
    // Résultats lus directement on-chain au moment de la requête
    onChainResults: OnChainResult[];
    onChainTotalVotes: number;
    isConsistent: boolean;            // true si DB == on-chain
    lastVerifiedAt: string;           // timestamp de la vérification
  };
}

interface PublicResult {
  label: string;
  voteCount: number;
  percentage: number;
  rank: number;
}

interface OnChainResult {
  choiceIndex: number;
  labelHash: string;                  // bytes32
  voteCount: number;
}
```

#### Script de vérification

```
GET /api/public/elections/:electionId/verification-script
Content-Type: application/javascript
```

```typescript
// Retourne un script Node.js autonome qui :
// 1. Se connecte au réseau via un RPC public
// 2. Lit getResults() sur le contrat
// 3. Lit tous les événements VoteCast
// 4. Recompte et compare
// 5. Affiche le résultat de la vérification
```

### Smart Contract (fonctions de lecture publiques)

```solidity
// Toutes ces fonctions sont view (pas de gas, appelables par tout le monde)

function getResults() external view returns (Choice[] memory);
function totalVotes() external view returns (uint256);
function voterCount() external view returns (uint256);
function hasVoted(address voter) external view returns (bool);
function status() external view returns (Status);
function choices(uint8 index) external view returns (bytes32 labelHash, uint256 voteCount);
```

---

## 3. TESTS — Cas de test

### Tests unitaires

```
test-unit/public/results.test.js
├── ✓ devrait retourner les résultats publics sans authentification
├── ✓ devrait inclure les preuves blockchain
├── ✓ devrait calculer isConsistent (DB vs on-chain)
├── ✓ devrait retourner les statistiques de participation
├── ✗ devrait retourner 404 si le scrutin n'existe pas
├── ✗ devrait retourner 400 si le scrutin n'est pas tallied
└── ✗ devrait masquer les adresses wallet des votants individuels
```

### Tests smart contract

```
test/VerivoElection.verification.test.js
├── ✓ getResults() accessible par tout le monde
├── ✓ recompter via événements VoteCast == getResults()
├── ✓ totalVotes == somme des voteCounts
├── ✓ nombre d'événements VoteCast == totalVotes
└── ✓ chaque adresse n'apparaît qu'une fois dans les événements
```

### Tests d'intégration

```
test-integration/public-results.test.js
├── ✓ accéder aux résultats sans token d'authentification
├── ✓ vérifier la cohérence DB / on-chain
└── ✓ télécharger et exécuter le script de vérification
```

### Tests E2E

```
test-e2e/public-results.spec.js
├── ✓ afficher la page de résultats publics
├── ✓ afficher les liens vers l'explorateur blockchain
├── ✓ afficher le tableau des résultats avec classement
├── ✓ afficher les statistiques de participation
└── ✓ partager le lien (URL stable)
```

---

## 4. IMPLEMENTATION — Plan

### Backend

| Fichier | Action |
|---|---|
| `src/routes/public.js` | Routes publiques (pas d'auth middleware) |
| `src/services/verification.service.js` | Lecture on-chain + comparaison DB |
| `src/templates/verification-script.js` | Template du script de vérification |

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/PublicResults.jsx` | Page de résultats publics |
| `src/components/ResultsChart.jsx` | Graphique des résultats (barres horizontales) |
| `src/components/BlockchainProof.jsx` | Affichage des preuves blockchain |
| `src/components/VerificationGuide.jsx` | Guide "Comment vérifier vous-même" |

### Script de vérification (autonome)

```javascript
// verify-election.js — Script téléchargeable
// Usage : node verify-election.js <contract_address> <rpc_url>
//
// 1. Lit getResults() via ethers.js
// 2. Lit les événements VoteCast (pagination par blocs)
// 3. Recompte manuellement
// 4. Compare les deux résultats
// 5. Vérifie unicité des votants
// 6. Affiche PASS / FAIL avec détails
```

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Accès public | GET sans token → 200 OK |
| Résultats corrects | `getResults()` on-chain == résultats affichés |
| Recomptage | Somme des événements VoteCast == totalVotes |
| Unicité | Chaque adresse n'apparaît qu'une fois dans les événements |
| Cohérence | `isConsistent == true` (DB == blockchain) |
| Transparence | Toutes les adresses de contrats et tx hash sont vérifiables |
| Reproductibilité | Le script de vérification produit les mêmes résultats |
