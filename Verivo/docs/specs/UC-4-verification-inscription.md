# UC-4 — Vérification d'inscription

> Mme ClubY se connecte et constate son inscription au scrutin organisé par M. FédéX.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **Mme ClubY** : membre d'un club, inscrite sur la liste électorale

### Pré-conditions
- Le scrutin est déployé (status = 'open')
- Mme ClubY a un compte Verivo (créé lors de l'import CSV ou préexistant)
- Un NFT de droit de vote a été minté vers son wallet

### Scénario principal

```
1. Mme ClubY accède à la WebApp Verivo
2. Elle se connecte :
   a. Mode wallet : connexion MetaMask/Rabby → vérification SIWE
   b. Mode email : email + mot de passe → JWT
3. Elle accède à son dashboard "Mes scrutins"
4. Le système affiche les scrutins auxquels elle est inscrite :
   - Titre du scrutin
   - Organisation émettrice
   - Statut (ouvert / fermé / en attente)
   - Dates de début et fin
   - Son statut de participation (inscrite / a voté)
5. Elle sélectionne le scrutin de M. FédéX
6. Le système affiche les détails :
   - Description du scrutin
   - Liste des candidats/propositions
   - Son NFT de droit de vote (tokenId, lien explorateur)
   - Vérification on-chain : confirmation que son wallet détient bien le NFT
7. Elle peut vérifier son inscription de manière indépendante :
   - Lien direct vers le contrat NFT sur l'explorateur
   - Appel public balanceOf(sonWallet) sur le contrat
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Mme ClubY n'est inscrite à aucun scrutin | Afficher "Aucun scrutin en cours" |
| E2 | Le NFT n'a pas encore été minté (pending) | Afficher "Inscription en cours de traitement" |
| E3 | Premier login avec compte créé automatiquement | Forcer le changement de mot de passe temporaire |
| E4 | Wallet connecté ne correspond pas au compte | Proposer de lier le wallet au compte existant |

### Règles métier

- **RG-4.1** : La vérification d'inscription est possible off-chain (DB) ET on-chain (NFT balanceOf)
- **RG-4.2** : Mme ClubY ne voit que les scrutins des organisations dont elle est membre
- **RG-4.3** : Les détails des autres votants ne sont pas visibles (vie privée)
- **RG-4.4** : L'information "a voté / n'a pas voté" est visible uniquement par le votant lui-même et les admins

---

## 2. TYPES — Contrats de données

### API Contracts

#### Lister mes scrutins

```
GET /api/me/elections
Authorization: Bearer <token>
```

```typescript
interface MyElectionsResponse {
  elections: MyElectionSummary[];
}

interface MyElectionSummary {
  id: string;
  title: string;
  description?: string;
  organizationName: string;
  organizationSlug: string;
  votingSystem: VotingSystem;
  status: ElectionStatus;
  startDate?: string;
  endDate?: string;
  participation: {
    isRegistered: boolean;
    hasVoted: boolean;
    votedAt?: string;
    nftStatus: 'pending' | 'minted' | 'burned';
    tokenId?: number;
  };
}
```

#### Détails d'un scrutin (vue votant)

```
GET /api/organizations/:orgSlug/elections/:electionId/voter-view
Authorization: Bearer <token>
```

```typescript
interface VoterElectionDetailResponse {
  election: {
    id: string;
    title: string;
    description?: string;
    votingSystem: VotingSystem;
    choiceType: 'candidate' | 'proposal';
    status: ElectionStatus;
    startDate?: string;
    endDate?: string;
    contractAddress: string;
    totalRegistered: number;       // nombre total d'inscrits
    totalVoted: number;            // nombre de votes enregistrés
    quorum: number;
  };
  choices: ChoiceResponse[];       // candidats/propositions
  myRegistration: {
    eligible: boolean;
    registeredAt: string;
    hasVoted: boolean;
    votedAt?: string;
    nft: {
      tokenId: number;
      contractAddress: string;
      status: 'pending' | 'minted' | 'burned';
      mintTxHash?: string;
      explorerUrl: string;         // lien vers l'explorateur
    };
  };
  verification: {
    onChainBalance: number;        // résultat de balanceOf (0 ou 1)
    isVerified: boolean;           // onChainBalance === 1
  };
}
```

---

## 3. TESTS — Cas de test

### Tests unitaires

```
test-unit/voter/my-elections.test.js
├── ✓ devrait retourner les scrutins où l'utilisateur est inscrit
├── ✓ devrait inclure le statut de participation
├── ✓ devrait filtrer par organisation accessible
├── ✗ devrait retourner une liste vide si non inscrit
└── ✗ devrait exclure les scrutins d'organisations archivées

test-unit/voter/election-detail.test.js
├── ✓ devrait retourner les détails du scrutin
├── ✓ devrait retourner les infos du NFT
├── ✓ devrait vérifier la possession on-chain (balanceOf)
├── ✗ devrait retourner 403 si l'utilisateur n'est pas inscrit à ce scrutin
└── ✗ devrait retourner 404 si le scrutin n'existe pas
```

### Tests d'intégration

```
test-integration/voter-view.test.js
├── ✓ flow : login → liste scrutins → détail → vérification NFT
├── ✓ vérifier la cohérence DB / on-chain (voter_nfts vs balanceOf)
└── ✓ vérifier que les données d'autres votants sont masquées
```

### Tests E2E

```
test-e2e/voter-dashboard.spec.js
├── ✓ afficher la liste des scrutins disponibles
├── ✓ afficher le détail d'un scrutin avec NFT
├── ✓ afficher le lien vers l'explorateur blockchain
└── ✓ afficher "Aucun scrutin" quand la liste est vide
```

---

## 4. IMPLEMENTATION — Plan

### Backend

| Fichier | Action |
|---|---|
| `src/routes/me.js` | Routes profil et "mes scrutins" |
| `src/services/voter-view.service.js` | Agrégation données votant (cross-tenant) |
| `src/services/nft-check.service.js` | Vérification on-chain balanceOf |

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/Dashboard.jsx` | Dashboard votant avec liste scrutins |
| `src/pages/ElectionDetail.jsx` | Vue détaillée d'un scrutin (votant) |
| `src/components/NftBadge.jsx` | Affichage statut NFT avec lien explorateur |
| `src/components/VerificationPanel.jsx` | Panel de vérification on-chain |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Inscription visible | L'utilisateur voit le scrutin dans "Mes scrutins" |
| NFT détenu | `balanceOf(mmeClubY.wallet)` == 1 sur le contrat NFT |
| Cohérence DB/chain | `voter_nfts.nft_status == 'minted'` ET `balanceOf == 1` |
| Vie privée | Aucun autre votant n'est listé dans la réponse API |
| Lien explorateur | URL valide pointant vers le bon token sur le bon réseau |
