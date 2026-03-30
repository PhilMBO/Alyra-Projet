# UC-1 — Onboarding sur la WebApp Verivo

> M. FédéX crée son compte, renseigne sa fédération.

---

## 1. SPEC — Spécification fonctionnelle

### Acteurs
- **M. FédéX** : administrateur d'une fédération sportive (ou association, collectivité…)

### Pré-conditions
- Aucun compte existant pour cet email
- L'application Verivo est accessible via HTTPS

### Scénario principal

```
1. M. FédéX accède à la page d'inscription (/register)
2. Il choisit son mode d'authentification :
   a. Email + mot de passe (wallet custodial créé en arrière-plan)
   b. Wallet (connexion MetaMask/Rabby via SIWE)
3. Il renseigne les informations de sa fédération :
   - Nom de l'organisation (obligatoire)
   - Slug unique (auto-généré depuis le nom, modifiable)
   - Logo (URL, optionnel)
4. Le système crée :
   - Le compte utilisateur (shared.users)
   - L'organisation (shared.organizations)
   - Le lien admin (shared.organization_members avec role = 'admin')
   - Le schéma tenant PostgreSQL (via create_tenant_schema)
5. M. FédéX est redirigé vers son dashboard d'organisation
```

### Scénarios alternatifs

| Code | Scénario | Réponse |
|---|---|---|
| E1 | Email déjà utilisé | 409 Conflict — "Un compte existe déjà avec cet email" |
| E2 | Wallet déjà enregistré | 409 Conflict — "Ce wallet est déjà associé à un compte" |
| E3 | Slug déjà pris | 409 Conflict — "Ce slug est déjà utilisé" |
| E4 | Validation échouée | 400 Bad Request — liste des erreurs de validation |
| E5 | Échec création schéma tenant | 500 — rollback de toute la transaction |

### Règles métier

- **RG-1.1** : Le mot de passe doit contenir ≥ 8 caractères, 1 majuscule, 1 chiffre
- **RG-1.2** : Le slug est normalisé (lowercase, alphanumeric + hyphens uniquement)
- **RG-1.3** : En mode email, un wallet custodial (paire de clés Ethereum) est généré côté serveur, la clé privée est chiffrée (AES-256-GCM) avant stockage
- **RG-1.4** : En mode wallet, l'authentification utilise SIWE (Sign-In with Ethereum, EIP-4361)
- **RG-1.5** : La création du compte + organisation + tenant est **atomique** (transaction DB)
- **RG-1.6** : Le schema_name du tenant suit le pattern `tenant_<slug>`

---

## 2. TYPES — Contrats de données

### API Contract

```
POST /api/auth/register
```

#### Request Body (mode email)

```typescript
interface RegisterEmailRequest {
  authMethod: 'email';
  email: string;              // format email valide
  password: string;           // min 8 chars, 1 uppercase, 1 digit
  displayName: string;        // 2-255 chars
  organization: {
    name: string;             // 1-255 chars
    slug?: string;            // auto-généré si absent, pattern: ^[a-z0-9-]+$
    logoUrl?: string;         // URL valide
  };
}
```

#### Request Body (mode wallet)

```typescript
interface RegisterWalletRequest {
  authMethod: 'wallet';
  walletAddress: string;      // 0x + 40 hex chars
  signature: string;          // SIWE signature
  message: string;            // SIWE message signé
  displayName: string;
  organization: {
    name: string;
    slug?: string;
    logoUrl?: string;
  };
}
```

#### Response 201

```typescript
interface RegisterResponse {
  user: {
    id: string;               // UUID
    authMethod: 'email' | 'wallet';
    email?: string;
    walletAddress: string;    // toujours présent (custodial ou non)
    displayName: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    schemaName: string;
    status: 'active';
  };
  token: string;              // JWT (24h)
}
```

### Prisma Schema (évolutions)

```prisma
model User {
  id               String    @id @default(uuid())
  authMethod       AuthMethod
  email            String?   @unique
  passwordHash     String?
  walletAddress    String?   @unique @db.VarChar(42)
  displayName      String    @db.VarChar(255)
  identityVerified Boolean   @default(false)
  isCustodial      Boolean   @default(false)
  custodialKeyEnc  String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  memberships      OrganizationMember[]
}

enum AuthMethod {
  WALLET
  EMAIL
}

model Organization {
  id         String             @id @default(uuid())
  name       String             @db.VarChar(255)
  slug       String             @unique @db.VarChar(100)
  schemaName String             @unique @db.VarChar(100) @map("schema_name")
  logoUrl    String?
  status     OrganizationStatus @default(ACTIVE)
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt
  members    OrganizationMember[]
}

model OrganizationMember {
  id             String         @id @default(uuid())
  organizationId String
  userId         String
  role           MemberRole     @default(MEMBER)
  joinedAt       DateTime       @default(now())
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
}

enum MemberRole {
  ADMIN
  ORGANIZER
  MEMBER
}

enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}
```

---

## 3. TESTS — Cas de test

### Tests unitaires (backend)

```
test-unit/auth/register.test.js
├── ✓ devrait créer un utilisateur email avec wallet custodial
├── ✓ devrait créer un utilisateur wallet via SIWE
├── ✓ devrait créer l'organisation et le schéma tenant
├── ✓ devrait lier l'utilisateur à l'organisation avec role admin
├── ✓ devrait retourner un JWT valide
├── ✓ devrait hasher le mot de passe avec bcrypt
├── ✓ devrait chiffrer la clé custodiale en AES-256-GCM
├── ✓ devrait générer le slug depuis le nom si non fourni
├── ✗ devrait rejeter un email déjà utilisé (409)
├── ✗ devrait rejeter un wallet déjà enregistré (409)
├── ✗ devrait rejeter un slug déjà pris (409)
├── ✗ devrait rejeter un mot de passe trop faible (400)
├── ✗ devrait rejeter un email invalide (400)
├── ✗ devrait rejeter une signature SIWE invalide (401)
└── ✗ devrait rollback si la création du tenant échoue (500)
```

### Tests d'intégration

```
test-integration/onboarding.test.js
├── ✓ flow complet email : register → login → dashboard
├── ✓ flow complet wallet : connect → sign → register → dashboard
├── ✓ vérifier que le schéma tenant existe dans PostgreSQL
├── ✓ vérifier que les tables tenant sont créées (elections, choices, etc.)
└── ✓ vérifier que le wallet custodial a une adresse Ethereum valide
```

### Tests E2E (frontend)

```
test-e2e/onboarding.spec.js
├── ✓ afficher le formulaire d'inscription
├── ✓ inscription par email avec création d'organisation
├── ✓ afficher les erreurs de validation inline
├── ✓ redirection vers le dashboard après inscription
└── ✓ connexion wallet MetaMask (mock provider)
```

---

## 4. IMPLEMENTATION — Plan

### Backend

| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter modèles User, OrganizationMember, enums |
| `src/routes/auth.js` | Ajouter route `POST /register` |
| `src/services/wallet.service.js` | Génération wallet custodial (ethers.js) |
| `src/services/siwe.service.js` | Vérification signature SIWE |
| `src/services/tenant.service.js` | Création schéma tenant via Prisma.$executeRaw |
| `src/utils/crypto.js` | Chiffrement AES-256-GCM de la clé privée |

### Frontend

| Fichier | Action |
|---|---|
| `src/pages/Register.jsx` | Page d'inscription (email ou wallet) |
| `src/hooks/useWallet.js` | Hook connexion wallet (EIP-1193) |
| `src/context/AuthContext.jsx` | Contexte d'authentification global |
| `src/services/api.js` | Client API centralisé |

### Dépendances à ajouter

| Package | Rôle | Couche |
|---|---|---|
| `ethers` | Génération wallet, vérification adresses | Backend |
| `siwe` | Sign-In with Ethereum | Backend |
| `wagmi` + `viem` | Connexion wallet React | Frontend |
| `@walletconnect/web3modal` | Modal de sélection wallet | Frontend |
| `react-router-dom` | Routing SPA | Frontend |

---

## 5. PROOF — Vérification

| Preuve | Méthode |
|---|---|
| Compte créé | `SELECT * FROM shared.users WHERE email = '...'` |
| Organisation créée | `SELECT * FROM shared.organizations WHERE slug = '...'` |
| Lien admin | `SELECT * FROM shared.organization_members WHERE role = 'admin'` |
| Tenant schema | `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'tenant_...'` |
| Wallet custodial valide | Vérifier que `wallet_address` est une adresse Ethereum valide (checksum EIP-55) |
| Clé chiffrée | Vérifier que `custodial_key_enc` est déchiffrable et produit une clé privée dont l'adresse correspond à `wallet_address` |
| JWT valide | Décoder le token, vérifier `sub`, `exp`, `role` |
