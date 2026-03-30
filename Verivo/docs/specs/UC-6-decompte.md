# UC-6 — Décompte

> Verivo déclenche le décompte du scrutin.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **M. FédéX** : déclenche la clôture depuis le dashboard
- **Verivo (système)** : exécute le tally on-chain

### Pré-conditions
- Le scrutin est en statut 'open'
- La date de fin est passée OU M. FédéX déclenche manuellement la clôture
- Le wallet opérateur Verivo a suffisamment de gas

### Scénario principal

```
1. La date de fin est atteinte OU M. FédéX clique "Clôturer le scrutin"
2. Le backend appelle VerivoElection.close() :
   - Le contrat passe en statut 'closed'
   - Plus aucun vote n'est accepté
   - L'événement ElectionClosed est émis
3. Le backend appelle VerivoElection.tally() :
   - Le contrat calcule les résultats selon le système de vote :
     a. Uninominal 1 tour : le candidat avec le plus de votes gagne
     b. Uninominal 2 tours : si aucune majorité absolue → 2e tour (hors scope MVP)
     c. Jugement majoritaire : mention médiane par candidat
     d. Approbation : somme des approbations par candidat
   - L'événement ElectionTallied est émis
   - Le statut passe à 'tallied'
4. Le backend lit les résultats on-chain :
   - getResults() retourne les votes par choix
   - totalVotes() retourne le nombre total de votes
5. Le backend enregistre les résultats en DB :
   - tenant.election_results : vote_count, percentage, rank par choix
   - tenant.elections : status = 'tallied'
6. M. FédéX voit les résultats :
   - Tableau récapitulatif (candidat, votes, pourcentage, rang)
   - Taux de participation (totalVotes / totalRegistered)
   - Quorum atteint ou non
   - Hash de la transaction de tally
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Scrutin pas en statut 'open' | 400 — "Le scrutin n'est pas en cours" |
| E2 | Aucun vote enregistré | Tally avec tous les compteurs à 0 |
| E3 | Quorum non atteint | Résultats enregistrés avec flag `quorumReached: false` |
| E4 | Échec transaction tally | 500 — retry avec gas augmenté |
| E5 | Date de fin pas encore atteinte (cloture manuelle) | Demander confirmation "X votants n'ont pas encore voté" |

### Règles métier

- **RG-6.1** : Seul le wallet opérateur Verivo (owner du contrat) peut appeler `close()` et `tally()`
- **RG-6.2** : `close()` puis `tally()` sont deux transactions séparées (atomicité indépendante)
- **RG-6.3** : Le tally est **déterministe** — les résultats sont calculables par quiconque à partir des données on-chain
- **RG-6.4** : Les résultats sont stockés en DB pour un accès rapide, mais la source de vérité reste la blockchain
- **RG-6.5** : Un scrutin tallied ne peut plus être modifié (transition finale avant archivage)
- **RG-6.6** : Le taux de participation = `totalVotes / nombre d'inscrits dans voter_registry`

---

## 2. TYPES — Contrats de données

### Smart Contract

```solidity
contract VerivoElection {
    enum Status { Open, Closed, Tallied }

    function close() external onlyOwner {
        require(status == Status.Open, "Not open");
        status = Status.Closed;
        emit ElectionClosed(electionId);
    }

    function tally() external onlyOwner {
        require(status == Status.Closed, "Not closed");
        // Les résultats sont déjà dans voteCounts (calculés incrémentalement)
        // tally() scelle les résultats et empêche toute modification
        status = Status.Tallied;
        emit ElectionTallied(electionId);
    }

    function getResults() external view returns (Choice[] memory) {
        // Retourne tous les choix avec leurs voteCounts
        Choice[] memory results = new Choice[](choicesCount);
        for (uint8 i = 0; i < choicesCount; i++) {
            results[i] = Choice({
                labelHash: choices[i].labelHash,
                voteCount: voteCounts[i]
            });
        }
        return results;
    }
}
```

### API Contract

#### Clôturer un scrutin

```
POST /api/organizations/:orgSlug/elections/:electionId/close
Authorization: Bearer <token>
```

```typescript
interface CloseElectionResponse {
  txHash: string;
  status: 'closed';
  closedAt: string;
}
```

#### Déclencher le décompte

```
POST /api/organizations/:orgSlug/elections/:electionId/tally
Authorization: Bearer <token>
```

```typescript
interface TallyResponse {
  txHash: string;
  status: 'tallied';
  results: ElectionResult[];
  summary: {
    totalVotes: number;
    totalRegistered: number;
    participationRate: number;       // pourcentage
    quorum: number;
    quorumReached: boolean;
  };
}

interface ElectionResult {
  choiceId: string;
  label: string;
  voteCount: number;
  percentage: number;                // arrondi à 2 décimales
  rank: number;                      // 1 = gagnant
}
```

#### Consulter les résultats

```
GET /api/organizations/:orgSlug/elections/:electionId/results
```

```typescript
// Même structure que TallyResponse
// Accessible publiquement après le tally (UC-7)
```

---

## 3. TESTS — Cas de test

### Tests smart contract

```
test/VerivoElection.tally.test.js
├── Close
│   ├── ✓ devrait passer le statut à 'closed'
│   ├── ✓ devrait émettre ElectionClosed
│   ├── ✓ devrait empêcher tout nouveau vote après close
│   ├── ✗ devrait rejeter close si pas open
│   └── ✗ devrait rejeter close par un non-owner
├── Tally
│   ├── ✓ devrait passer le statut à 'tallied'
│   ├── ✓ devrait émettre ElectionTallied
│   ├── ✓ devrait retourner les résultats corrects via getResults()
│   ├── ✓ devrait fonctionner avec 0 votes
│   ├── ✗ devrait rejeter tally si pas closed
│   └── ✗ devrait rejeter tally par un non-owner
└── Results
    ├── ✓ getResults() retourne les bons compteurs
    ├── ✓ totalVotes() correspond à la somme
    └── ✓ résultats identiques avant et après tally (déterminisme)
```

### Tests d'intégration

```
test-integration/tally.test.js
├── ✓ flow complet : close → tally → résultats DB
├── ✓ vérifier cohérence on-chain / DB
├── ✓ vérifier le calcul du taux de participation
├── ✓ vérifier le classement (rank) des candidats
└── ✓ vérifier le flag quorumReached
```

---

## 4. IMPLEMENTATION — Plan

### Backend

| Fichier | Action |
|---|---|
| `src/routes/tally.js` | Routes close + tally + results |
| `src/services/tally.service.js` | Orchestration close/tally, lecture résultats on-chain |
| `src/services/results.service.js` | Calcul pourcentages, rangs, quorum |
| `src/listeners/tally.listener.js` | Écoute événements ElectionClosed/Tallied |
| `src/jobs/auto-close.job.js` | Job CRON : fermer les scrutins dont la date est passée |

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/Results.jsx` | Page de résultats |
| `src/components/ResultsTable.jsx` | Tableau des résultats |
| `src/components/ParticipationGauge.jsx` | Jauge de participation |
| `src/components/QuorumBadge.jsx` | Badge quorum atteint/non atteint |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Scrutin fermé | `status()` on-chain == Closed/Tallied |
| Votes gelés | Tenter un vote après close → revert |
| Résultats on-chain | `getResults()` retourne les compteurs exacts |
| Déterminisme | Appeler getResults() depuis un nœud différent → mêmes valeurs |
| Cohérence DB | `election_results.vote_count` == `voteCounts[i]` on-chain |
| Participation | `totalVotes / voter_registry.count` == taux affiché |
| Quorum | `totalVotes >= quorum` ↔ `quorumReached == true` |
| Auditabilité | Hash de la tx de tally vérifiable sur l'explorateur |
