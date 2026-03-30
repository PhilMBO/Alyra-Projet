# API Routes — Résumé complet

## Routes d'authentification

| Méthode | Route | Auth | UC | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Non | UC-1 | Inscription (email ou wallet) + création organisation |
| `POST` | `/api/auth/login` | Non | UC-1 | Connexion email → JWT |
| `POST` | `/api/auth/wallet-login` | Non | UC-1 | Connexion wallet via SIWE → JWT |
| `GET` | `/api/auth/me` | Oui | UC-1 | Profil de l'utilisateur connecté |

## Routes utilisateur

| Méthode | Route | Auth | UC | Description |
|---|---|---|---|---|
| `GET` | `/api/me/elections` | Oui | UC-4 | Mes scrutins (vue votant) |
| `GET` | `/api/me/badges` | Oui | UC-8 | Mes badges NFT |

## Routes organisation

| Méthode | Route | Auth | UC | Description |
|---|---|---|---|---|
| `GET` | `/api/organizations` | Oui | UC-1 | Lister mes organisations |
| `GET` | `/api/organizations/:orgSlug` | Oui | UC-1 | Détails d'une organisation |

## Routes élections

| Méthode | Route | Auth | Rôle | UC | Description |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/:orgSlug/elections` | Oui | admin/organizer | UC-2 | Créer un scrutin |
| `GET` | `/api/organizations/:orgSlug/elections` | Oui | membre | UC-2 | Lister les scrutins |
| `GET` | `/api/organizations/:orgSlug/elections/:id` | Oui | membre | UC-2 | Détails d'un scrutin |
| `PUT` | `/api/organizations/:orgSlug/elections/:id` | Oui | admin/organizer | UC-2 | Modifier un scrutin (draft) |
| `DELETE` | `/api/organizations/:orgSlug/elections/:id` | Oui | admin | UC-2 | Supprimer un scrutin (draft) |

## Routes votants

| Méthode | Route | Auth | Rôle | UC | Description |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/:orgSlug/elections/:id/voters/import` | Oui | admin/organizer | UC-2 | Importer CSV votants |
| `GET` | `/api/organizations/:orgSlug/elections/:id/voters` | Oui | admin/organizer | UC-2 | Lister les votants |
| `GET` | `/api/organizations/:orgSlug/elections/:id/voter-view` | Oui | votant | UC-4 | Vue votant du scrutin |

## Routes déploiement

| Méthode | Route | Auth | Rôle | UC | Description |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/:orgSlug/elections/:id/deploy` | Oui | admin | UC-3 | Déployer le scrutin on-chain |
| `GET` | `/api/organizations/:orgSlug/elections/:id/deploy/status` | Oui | admin | UC-3 | Statut du déploiement |

## Routes vote

| Méthode | Route | Auth | Rôle | UC | Description |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/:orgSlug/elections/:id/vote` | Oui | votant custodial | UC-5 | Vote via wallet custodial |
| `GET` | `/api/transactions/:txHash/status` | Oui | tout | UC-5 | Statut d'une transaction |

## Routes décompte

| Méthode | Route | Auth | Rôle | UC | Description |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/:orgSlug/elections/:id/close` | Oui | admin | UC-6 | Clôturer le scrutin |
| `POST` | `/api/organizations/:orgSlug/elections/:id/tally` | Oui | admin | UC-6 | Déclencher le décompte |
| `GET` | `/api/organizations/:orgSlug/elections/:id/results` | Oui | membre | UC-6 | Résultats (auth) |

## Routes publiques

| Méthode | Route | Auth | UC | Description |
|---|---|---|---|---|
| `GET` | `/api/public/elections/:id/results` | Non | UC-7 | Résultats publics |
| `GET` | `/api/public/elections/:id/verification-script` | Non | UC-7 | Script de vérification |

## Routes badges

| Méthode | Route | Auth | Rôle | UC | Description |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/:orgSlug/elections/:id/badges/distribute` | Oui | admin | UC-8 | Distribuer les badges |
| `GET` | `/api/organizations/:orgSlug/elections/:id/badges` | Oui | admin | UC-8 | Statut distribution |

---

## Middleware chain

```
Request
  │
  ├── CORS
  ├── JSON parser
  │
  ├── /api/public/*  ────────────────────────────────────> Route handler
  │
  ├── /api/auth/register ────────────────────────────────> Route handler
  ├── /api/auth/login ───────────────────────────────────> Route handler
  │
  └── All other routes
       ├── JWT Auth middleware ── extracts userId, role
       │
       ├── /api/me/* ───────────────────────────────────> Route handler
       │
       └── /api/organizations/:orgSlug/*
            ├── Org membership middleware ── verifies membership + role
            │
            └── Route handler
```
