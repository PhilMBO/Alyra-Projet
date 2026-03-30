# UC-2 — Configuration du scrutin

> M. FédéX définit un scrutin uninominal à un tour et fournit via un import CSV la liste électorale (club, adresse publique, etc.)

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **M. FédéX** : admin de l'organisation (role = 'admin' dans organization_members)

### Pré-conditions
- M. FédéX est authentifié
- Son organisation existe et son schéma tenant est créé
- Il a le rôle 'admin' ou 'organizer' dans l'organisation

### Scénario principal

```
1. M. FédéX accède à la page "Créer un scrutin" depuis son dashboard
2. Il configure le scrutin :
   a. Titre du scrutin (ex: "Élection du président de la Fédération X")
   b. Description (optionnel)
   c. Type de scrutin : uninominal 1 tour (parmi les systèmes disponibles)
   d. Type de choix : candidat ou proposition
   e. Dates de début et fin (optionnel, peut être déclenché manuellement)
   f. Quorum minimum (nombre ou pourcentage, défaut: 0)
3. Il ajoute les candidats/propositions :
   - Label (nom du candidat ou intitulé de la proposition)
   - Description (optionnel)
   - Position/ordre d'affichage
4. Il importe la liste électorale via CSV :
   - Colonnes attendues : nom, prénom, email, club, wallet_address (optionnel)
   - Le système valide le CSV (format, doublons, adresses)
   - Aperçu des données avant confirmation
5. Le système crée :
   - L'élection (tenant.elections, status = 'draft')
   - Les choix (tenant.choices)
   - Les votants dans le registre (tenant.voter_registry)
   - Les comptes utilisateurs manquants (shared.users) si l'email n'existe pas
   - Les liens organization_members si nécessaire
6. Le scrutin est prêt pour le déploiement (UC-3)
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | CSV mal formaté | 400 — détail des erreurs ligne par ligne |
| E2 | Adresse wallet invalide dans le CSV | 400 — liste des lignes avec adresses invalides |
| E3 | Doublon dans le CSV (même email/wallet) | 400 — liste des doublons détectés |
| E4 | Utilisateur non-admin | 403 Forbidden |
| E5 | Organisation suspendue/archivée | 403 — "Organisation inactive" |
| E6 | Dates incohérentes (fin < début) | 400 — "La date de fin doit être postérieure à la date de début" |

### Règles métier

- **RG-2.1** : Seuls les rôles 'admin' et 'organizer' peuvent créer un scrutin
- **RG-2.2** : Le scrutin est créé en statut 'draft' — il n'est pas encore visible par les votants
- **RG-2.3** : Le CSV doit contenir au minimum une colonne d'identification (email OU wallet_address)
- **RG-2.4** : Si un email du CSV ne correspond à aucun utilisateur existant, un compte email est créé avec un wallet custodial et un mot de passe temporaire (envoi d'email d'invitation)
- **RG-2.5** : Si un wallet_address est fourni dans le CSV, il est utilisé directement (pas de custodial)
- **RG-2.6** : Les systèmes de vote supportés sont :
  - `uninominal_1tour` : un seul choix, un seul tour, majorité simple
  - `uninominal_2tours` : deux tours si aucune majorité absolue
  - `jugement_majoritaire` : chaque candidat évalué sur une échelle
  - `approbation` : approuver autant de candidats que souhaité
- **RG-2.7** : Le quorum est exprimé en nombre absolu de votants minimum

### Format CSV attendu

```csv
nom,prenom,email,club,wallet_address
Dupont,Marie,marie.dupont@club.fr,Club Sportif Lyon,0x1234...abcd
Martin,Jean,jean.martin@club.fr,Club Sportif Paris,
Durand,Sophie,sophie.durand@club.fr,Club Sportif Marseille,0x5678...efgh
```

- Encodage : UTF-8
- Séparateur : virgule ou point-virgule (auto-détecté)
- Header obligatoire en première ligne
- `wallet_address` optionnel par ligne (custodial si absent)

---

## 2. TYPES — Contrats de données

### API Contracts

#### Créer un scrutin

```
POST /api/organizations/:orgSlug/elections
Authorization: Bearer <token>
```

```typescript
interface CreateElectionRequest {
  title: string;                    // 1-255 chars
  description?: string;
  votingSystem: VotingSystem;
  choiceType: 'candidate' | 'proposal';
  startDate?: string;               // ISO 8601
  endDate?: string;                  // ISO 8601, > startDate
  quorum?: number;                   // >= 0, défaut: 0
  choices: CreateChoiceInput[];
}

interface CreateChoiceInput {
  label: string;                     // 1-255 chars
  description?: string;
  position: number;                  // >= 0
}

type VotingSystem =
  | 'uninominal_1tour'
  | 'uninominal_2tours'
  | 'jugement_majoritaire'
  | 'approbation';
```

#### Response 201

```typescript
interface ElectionResponse {
  id: string;
  title: string;
  description?: string;
  votingSystem: VotingSystem;
  choiceType: 'candidate' | 'proposal';
  status: 'draft';
  startDate?: string;
  endDate?: string;
  quorum: number;
  choices: ChoiceResponse[];
  createdBy: string;
  createdAt: string;
}

interface ChoiceResponse {
  id: string;
  label: string;
  description?: string;
  position: number;
}
```

#### Importer la liste électorale

```
POST /api/organizations/:orgSlug/elections/:electionId/voters/import
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

```typescript
// Body: FormData avec champ 'file' (CSV)

interface ImportVotersResponse {
  imported: number;              // nombre de votants importés
  created: number;               // nombre de nouveaux comptes créés
  skipped: number;               // nombre de lignes ignorées
  errors: ImportError[];         // erreurs par ligne
  voters: VoterSummary[];        // aperçu des votants importés
}

interface ImportError {
  line: number;
  field: string;
  message: string;
}

interface VoterSummary {
  userId: string;
  displayName: string;
  email?: string;
  walletAddress: string;
  club?: string;
  isNew: boolean;                // true si le compte a été créé
  isCustodial: boolean;
}
```

### Prisma Schema (tenant — via $executeRaw)

Les tables tenant sont gérées via SQL brut car Prisma ne supporte pas nativement le multi-schéma dynamique. Les types ci-dessous documentent la structure.

```typescript
// Représentation TypeScript des tables tenant (non-Prisma)

interface TenantElection {
  id: string;
  title: string;
  description?: string;
  votingSystem: VotingSystem;
  choiceType: 'candidate' | 'proposal';
  status: ElectionStatus;
  startDate?: Date;
  endDate?: Date;
  contractAddress?: string;      // ajouté lors du déploiement (UC-3)
  quorum: number;
  createdBy: string;             // FK vers shared.users
  createdAt: Date;
  updatedAt: Date;
}

type ElectionStatus = 'draft' | 'open' | 'closed' | 'tallied' | 'archived';

interface TenantChoice {
  id: string;
  electionId: string;
  label: string;
  description?: string;
  position: number;
  createdAt: Date;
}

interface TenantVoterRegistry {
  id: string;
  electionId: string;
  userId: string;                // FK vers shared.users
  eligible: boolean;
  registeredAt: Date;
}
```

---

## 3. TESTS — Cas de test

### Tests unitaires

```
test-unit/elections/create-election.test.js
├── ✓ devrait créer un scrutin uninominal 1 tour avec candidats
├── ✓ devrait créer un scrutin jugement majoritaire avec propositions
├── ✓ devrait initialiser le status à 'draft'
├── ✓ devrait valider la cohérence des dates
├── ✓ devrait créer les choix associés avec positions
├── ✗ devrait rejeter un titre vide (400)
├── ✗ devrait rejeter un système de vote invalide (400)
├── ✗ devrait rejeter si end_date < start_date (400)
└── ✗ devrait rejeter si l'utilisateur n'est pas admin/organizer (403)

test-unit/elections/import-voters.test.js
├── ✓ devrait parser un CSV avec séparateur virgule
├── ✓ devrait parser un CSV avec séparateur point-virgule
├── ✓ devrait créer les entrées voter_registry
├── ✓ devrait créer des comptes utilisateurs pour les emails inconnus
├── ✓ devrait générer des wallets custodial pour les nouveaux comptes sans wallet
├── ✓ devrait utiliser le wallet_address du CSV si fourni
├── ✓ devrait ajouter les nouveaux utilisateurs comme membres de l'organisation
├── ✗ devrait rejeter un CSV sans header (400)
├── ✗ devrait rejeter un CSV sans colonne d'identification (400)
├── ✗ devrait signaler les adresses wallet invalides (400)
├── ✗ devrait signaler les doublons (400)
└── ✗ devrait rejeter si le scrutin n'est pas en 'draft' (400)
```

### Tests d'intégration

```
test-integration/configure-election.test.js
├── ✓ flow complet : créer scrutin → importer CSV → vérifier registre
├── ✓ vérifier que les données sont dans le bon schéma tenant
├── ✓ vérifier que les users créés ont un wallet custodial valide
├── ✓ vérifier que l'élection est bien en statut draft
└── ✓ vérifier l'idempotence (ré-importer le même CSV ne crée pas de doublons)
```

### Tests E2E

```
test-e2e/configure-election.spec.js
├── ✓ créer un scrutin via le formulaire
├── ✓ ajouter des candidats
├── ✓ uploader un fichier CSV
├── ✓ afficher l'aperçu des votants importés
├── ✓ afficher les erreurs de validation du CSV
└── ✓ voir le scrutin en statut 'draft' dans la liste
```

---

## 4. IMPLEMENTATION — Plan

### Backend

| Fichier | Action |
|---|---|
| `src/routes/elections.js` | Routes CRUD élections |
| `src/routes/voters.js` | Route import CSV votants |
| `src/services/csv.service.js` | Parsing et validation CSV |
| `src/services/election.service.js` | Logique métier élections (requêtes tenant) |
| `src/services/voter.service.js` | Création votants, wallets custodial |
| `src/middleware/orgAuth.js` | Middleware vérification rôle dans l'organisation |

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/CreateElection.jsx` | Formulaire multi-étapes |
| `src/components/CsvUploader.jsx` | Upload et aperçu CSV |
| `src/components/ChoiceEditor.jsx` | Ajout/édition des candidats/propositions |
| `src/components/ElectionList.jsx` | Liste des scrutins d'une organisation |

### Dépendances

| Package | Rôle | Couche |
|---|---|---|
| `multer` | Upload fichier (CSV) | Backend |
| `csv-parse` | Parsing CSV robuste | Backend |
| `papaparse` | Parsing CSV côté client (aperçu) | Frontend |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Élection créée | `SELECT * FROM tenant_<slug>.elections WHERE id = '...'` |
| Choix créés | `SELECT * FROM tenant_<slug>.choices WHERE election_id = '...' ORDER BY position` |
| Votants inscrits | `SELECT count(*) FROM tenant_<slug>.voter_registry WHERE election_id = '...'` |
| Comptes créés | Compter les nouveaux `shared.users` avec `is_custodial = true` |
| Intégrité CSV | Nombre de lignes CSV = `imported + skipped + errors.length` |
| Isolation tenant | Vérifier que les données ne sont pas accessibles depuis un autre schéma tenant |
