# UC-5 — Vote

> Avec son wallet (Rabby, MetaMask…) Mme ClubY envoie une transaction contenant son vote (en clair) sur le smart-contract du scrutin.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **Mme ClubY** : votante inscrite, détentrice d'un NFT de droit de vote

### Pré-conditions
- Le scrutin est en statut 'open'
- Mme ClubY possède un NFT de droit de vote (balanceOf == 1)
- Mme ClubY n'a pas encore voté pour ce scrutin
- Le wallet de Mme ClubY est connecté à la WebApp (ou elle utilise le wallet custodial)

### Scénario principal

```
1. Mme ClubY accède au détail du scrutin (UC-4)
2. Elle voit la liste des candidats/propositions
3. Selon le type de scrutin :
   a. Uninominal 1 tour : elle sélectionne UN seul candidat
   b. Uninominal 2 tours : elle sélectionne UN seul candidat
   c. Jugement majoritaire : elle attribue une mention à chaque candidat
   d. Approbation : elle coche les candidats qu'elle approuve
4. Elle clique sur "Voter"
5. La WebApp prépare la transaction :
   - Appel à VerivoElection.vote(choiceIndex) pour uninominal
   - Appel à VerivoElection.voteMultiple(uint8[]) pour jugement/approbation
6. Le wallet (MetaMask/Rabby) affiche la transaction pour signature
   - OU pour les wallets custodial : le backend signe automatiquement
7. Mme ClubY signe la transaction
8. La transaction est envoyée au réseau
9. Le smart contract :
   a. Vérifie que l'appelant possède un NFT de droit de vote
   b. Vérifie que l'appelant n'a pas déjà voté
   c. Enregistre le vote
   d. Émet l'événement VoteCast(voter, choiceIndex)
10. Le backend détecte l'événement et met à jour :
    - tenant.participation_log (has_voted = true, tx_hash)
    - tenant.voter_nfts (NFT droit de vote → status 'burned' si burn activé)
11. Mme ClubY voit la confirmation :
    - "Vote enregistré avec succès"
    - Hash de la transaction
    - Lien vers l'explorateur
```

### Mode wallet custodial (email users)

```
Pour les utilisateurs connectés par email (sans wallet personnel) :
1. La WebApp envoie le choix au backend
2. Le backend déchiffre la clé privée custodiale
3. Le backend signe et envoie la transaction
4. Le résultat est identique (vote on-chain)
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Pas de NFT de droit de vote | Smart contract revert "No voting right" |
| E2 | A déjà voté | Smart contract revert "Already voted" |
| E3 | Scrutin fermé | Smart contract revert "Election not open" |
| E4 | Index de choix invalide | Smart contract revert "Invalid choice" |
| E5 | Transaction rejetée par l'utilisateur | Afficher "Vote annulé" |
| E6 | Gas insuffisant dans le wallet | Afficher "Fonds insuffisants pour le gas" |
| E7 | Timeout réseau | Afficher "Transaction en attente" avec possibilité de retry |

### Règles métier

- **RG-5.1** : Le vote est **en clair** sur la blockchain (pas de chiffrement du choix)
- **RG-5.2** : Un votant ne peut voter qu'**une seule fois** par scrutin (vérifié par le contrat via mapping)
- **RG-5.3** : La vérification du droit de vote se fait via `balanceOf` sur le contrat NFT
- **RG-5.4** : Le vote est **final** — pas de modification possible après soumission
- **RG-5.5** : Le backend ne connaît PAS le choix du votant (seulement qu'il a voté via l'événement)
- **RG-5.6** : Pour les wallets custodial, le gas est payé par le wallet opérateur Verivo (meta-transaction ou funding)
- **RG-5.7** : L'événement `VoteCast` est émis pour permettre le suivi en temps réel

---

## 2. TYPES — Contrats de données

### Smart Contract Interface (détaillée)

```solidity
contract VerivoElection {
    // --- Storage ---
    mapping(address => bool) public hasVoted;
    mapping(uint8 => uint256) public voteCounts;  // choiceIndex => count
    uint256 public totalVotes;

    // --- Modifiers ---
    modifier onlyEligible() {
        require(
            IERC721(votingNFT).balanceOf(msg.sender) > 0,
            "No voting right"
        );
        require(!hasVoted[msg.sender], "Already voted");
        require(status == Status.Open, "Election not open");
        _;
    }

    // --- Vote (uninominal) ---
    function vote(uint8 choiceIndex) external onlyEligible {
        require(choiceIndex < choicesCount, "Invalid choice");

        hasVoted[msg.sender] = true;
        voteCounts[choiceIndex]++;
        totalVotes++;

        emit VoteCast(msg.sender, choiceIndex);
    }

    // --- Vote (jugement majoritaire / approbation) ---
    // Pour les systèmes multi-choix
    function voteMultiple(uint8[] calldata choiceIndices) external onlyEligible {
        for (uint i = 0; i < choiceIndices.length; i++) {
            require(choiceIndices[i] < choicesCount, "Invalid choice");
            voteCounts[choiceIndices[i]]++;
        }

        hasVoted[msg.sender] = true;
        totalVotes++;

        emit VotesCast(msg.sender, choiceIndices);
    }
}
```

### API Contracts

#### Vote via custodial wallet

```
POST /api/organizations/:orgSlug/elections/:electionId/vote
Authorization: Bearer <token>
```

```typescript
// Uniquement pour les utilisateurs email (custodial)
interface CustodialVoteRequest {
  choiceIndex?: number;            // pour uninominal
  choiceIndices?: number[];        // pour jugement/approbation
}

interface VoteResponse {
  txHash: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
}
```

#### Suivi de transaction

```
GET /api/transactions/:txHash/status
```

```typescript
interface TransactionStatusResponse {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  confirmations: number;
}
```

### Frontend Types

```typescript
interface VoteFormState {
  electionId: string;
  votingSystem: VotingSystem;
  // Uninominal
  selectedChoice?: number;
  // Jugement majoritaire
  mentions?: Map<number, MentionLevel>;
  // Approbation
  approvedChoices?: Set<number>;
}

type MentionLevel =
  | 'excellent'
  | 'tres_bien'
  | 'bien'
  | 'assez_bien'
  | 'passable'
  | 'insuffisant'
  | 'a_rejeter';

interface VoteTransaction {
  status: 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed' | 'failed';
  txHash?: string;
  error?: string;
}
```

---

## 3. TESTS — Cas de test

### Tests smart contract

```
test/VerivoElection.vote.test.js
├── Uninominal 1 tour
│   ├── ✓ devrait accepter un vote d'un détenteur de NFT
│   ├── ✓ devrait incrémenter le compteur du choix
│   ├── ✓ devrait incrémenter totalVotes
│   ├── ✓ devrait marquer hasVoted[voter] = true
│   ├── ✓ devrait émettre VoteCast(voter, choiceIndex)
│   ├── ✗ devrait rejeter un votant sans NFT
│   ├── ✗ devrait rejeter un double vote
│   ├── ✗ devrait rejeter un choiceIndex hors limites
│   └── ✗ devrait rejeter si l'élection n'est pas ouverte
├── Vote multiple (approbation)
│   ├── ✓ devrait accepter plusieurs choix
│   ├── ✓ devrait incrémenter chaque compteur
│   ├── ✗ devrait rejeter si un index est invalide
│   └── ✗ devrait rejeter un double vote
└── Gas
    ├── ✓ vote uninominal < 100k gas
    └── ✓ vote multiple (5 choix) < 200k gas
```

### Tests d'intégration

```
test-integration/vote-flow.test.js
├── ✓ flow complet : connexion → vote → confirmation → vérification on-chain
├── ✓ vote custodial : API → backend signe → tx on-chain
├── ✓ vérifier mise à jour participation_log après vote
├── ✓ vérifier que le vote est lisible on-chain (voteCounts)
└── ✗ vérifier qu'un double vote est impossible
```

### Tests E2E

```
test-e2e/vote.spec.js
├── ✓ sélectionner un candidat et voter (mock wallet)
├── ✓ afficher la confirmation avec le hash de transaction
├── ✓ afficher "Vous avez déjà voté" après un vote
├── ✓ désactiver le bouton de vote si pas de NFT
└── ✓ voter via wallet custodial (mode email)
```

---

## 4. IMPLEMENTATION — Plan

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/Vote.jsx` | Page de vote avec sélection des choix |
| `src/components/VoteUninominal.jsx` | Interface vote uninominal (radio buttons) |
| `src/components/VoteApprobation.jsx` | Interface vote approbation (checkboxes) |
| `src/components/VoteJugement.jsx` | Interface jugement majoritaire (échelle) |
| `src/components/TransactionStatus.jsx` | Suivi de la transaction en temps réel |
| `src/hooks/useVote.js` | Hook envoi de transaction de vote |
| `src/hooks/useTransactionStatus.js` | Hook suivi de confirmation |

### Backend

| Fichier | Action |
|---|---|
| `src/routes/vote.js` | Route vote custodial |
| `src/services/vote.service.js` | Signature et envoi tx custodiale |
| `src/listeners/vote.listener.js` | Écoute événement VoteCast → mise à jour DB |

### Smart Contracts

| Fichier | Action |
|---|---|
| `blockchain/contracts/VerivoElection.sol` | Fonctions vote() et voteMultiple() |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Vote enregistré on-chain | `voteCounts(choiceIndex)` incrémenté |
| Votant marqué | `hasVoted(mmeClubY.wallet)` == true |
| Événement émis | Vérifier le log VoteCast dans la transaction |
| Transaction valide | Hash vérifiable sur l'explorateur blockchain |
| Participation DB | `participation_log.has_voted == true` et `tx_hash` renseigné |
| Pas de double vote | Tenter un 2e vote → revert "Already voted" |
| Anonymat partiel | La DB ne contient PAS le choiceIndex du vote |
