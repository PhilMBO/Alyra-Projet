# Architecture Verivo - Explication detaillee

## Vue d'ensemble

```
                         INTERNET
                            |
                            v
                    +---------------+
                    |   Port 80     |---- Redirection HTTP -> HTTPS
                    |   Port 443    |---- Point d'entree unique HTTPS
                    |               |
                    |    NGINX      |     Reverse Proxy / Terminaison SSL
                    |  (container)  |
                    +-------+-------+
                            |
               +------------+------------+
               |                         |
          Route: /*                 Route: /api/*
               |                         |
               v                         v
      +-----------------+      +-----------------+
      |    FRONTEND      |      |    BACKEND       |
      |  React + Vite    |      |  Express + Node  |
      |  (container)     |      |  (container)     |
      |  port interne    |      |  port interne    |
      |  5173            |      |  3001            |
      +-----------------+      +--------+---------+
                                        |
                                        | Prisma ORM
                                        |
                                +-------v---------+
                                |   POSTGRESQL     |
                                |  (container)     |
                                |  port 5432       |
                                +------------------+
                                        |
                                   Volume Docker
                                (persistance des
                                   donnees)
```

---

## 1. Nginx - Le gardien d'entree

**Fichiers** : `nginx/Dockerfile`, `nginx/nginx.conf`

Nginx est un serveur web qui joue ici le role de **reverse proxy**. C'est le seul composant expose a l'exterieur (ports 80 et 443). Aucun autre service n'est accessible directement depuis le navigateur.

### Responsabilites

| Responsabilite | Detail |
|---|---|
| **Terminaison SSL** | Il detient le certificat HTTPS et dechiffre les requetes. Les communications internes entre containers restent en HTTP (c'est normal et securise car c'est un reseau Docker isole) |
| **Redirection HTTP->HTTPS** | Toute requete sur le port 80 est automatiquement renvoyee vers le port 443 |
| **Routage** | Il lit l'URL et decide ou envoyer la requete : `/api/*` va au backend, tout le reste va au frontend |
| **WebSocket** | Le header `Upgrade` est transmis pour que le Hot Module Replacement (HMR) de Vite fonctionne en dev |

### Flux d'une requete

```
https://localhost/api/organizations
    |
    |  Nginx voit "/api/" -> proxy vers http://backend:3001/api/organizations
    v
Backend repond -> Nginx renvoie la reponse au client en HTTPS
```

```
https://localhost/
    |
    |  Nginx voit "/" -> proxy vers http://frontend:5173/
    v
Frontend repond avec le HTML/JS -> Nginx renvoie au client en HTTPS
```

---

## 2. Frontend - L'interface utilisateur

**Fichiers** : `frontend/`

Une application **React** construite avec **Vite** (un bundler rapide). C'est ce que l'utilisateur voit dans son navigateur.

### Composants

| Fichier | Role |
|---|---|
| `main.jsx` | Point d'entree React - monte l'application dans le DOM |
| `App.jsx` | Composant racine - orchestre le formulaire et la liste, gere l'etat global (liste des organisations) |
| `OrganizationForm.jsx` | Formulaire de creation - envoie un `POST /api/organizations` au backend |
| `OrganizationList.jsx` | Affiche la liste des organisations existantes - les recoit en props depuis `App` |

### Flux de creation d'une organisation

```
1. L'utilisateur remplit le formulaire (nom + logo)
2. Clic sur "Creer"
3. OrganizationForm fait un fetch("POST /api/organizations", { name, logo })
4. La requete passe par Nginx -> Backend
5. Le backend repond avec l'organisation creee
6. OrganizationForm appelle onCreated(data)
7. App ajoute la nouvelle org en tete de la liste
8. OrganizationList se re-rend avec la liste mise a jour
```

### Vite en mode dev

Vite sert les fichiers avec du Hot Module Replacement (HMR) : quand on modifie un fichier React, le navigateur se met a jour instantanement sans recharger la page. C'est pour cela que le support WebSocket est necessaire dans Nginx.

---

## 3. Backend - La logique metier et l'API

**Fichiers** : `backend/src/`

Un serveur **Express** (Node.js) qui expose une API REST. Il recoit les requetes du frontend (via Nginx), les valide, et interagit avec la base de donnees.

### Couches

```
Requete HTTP
    |
    v
+--------------+
|   Express     |  Serveur HTTP (index.js)
|   + CORS      |  Autorise les requetes cross-origin
|   + JSON      |  Parse le body JSON des requetes
+------+-------+
       |
       v
+------------------+
|  Routes           |  organizations.js
|  + Validation     |  express-validator verifie les donnees entrantes
+------+-----------+
       |
       v
+------------------+
|  Prisma Client    |  ORM - traduit les appels JS en requetes SQL
+------+-----------+
       |
       v
   PostgreSQL
```

### Endpoints

| Methode | URL | Ce qu'il fait |
|---|---|---|
| `POST` | `/api/organizations` | Valide les donnees (nom requis, logo URL valide) puis cree l'organisation en BDD |
| `GET` | `/api/organizations` | Retourne toutes les organisations triees par date de creation decroissante |

### Validation

**express-validator** verifie les donnees **avant** qu'elles atteignent la BDD :

- `name` : obligatoire, max 255 caracteres
- `logo` : optionnel, doit etre une URL valide si present

Si la validation echoue, le backend renvoie une erreur 400 avec les messages d'erreur, sans jamais toucher a la BDD.

---

## 4. Prisma - Le traducteur JS <-> SQL

**Fichiers** : `backend/prisma/schema.prisma`

Prisma est un **ORM** (Object-Relational Mapping). Il permet d'ecrire du JavaScript au lieu du SQL brut, et genere les migrations automatiquement.

### Schema

```
Organization
+-- id        -> UUID genere automatiquement
+-- name      -> Texte (nom de l'organisation)
+-- logo      -> Texte optionnel (URL)
+-- status    -> Enum : ACTIVE | SUSPENDED | ARCHIVED (defaut: ACTIVE)
+-- createdAt -> Date auto
+-- updatedAt -> Date auto (mise a jour a chaque modification)
```

### Exemples de traduction

| Code JS (Prisma) | SQL genere |
|---|---|
| `prisma.organization.create({ data: { name: "Mairie" } })` | `INSERT INTO organizations (id, name, status, created_at, updated_at) VALUES (uuid(), 'Mairie', 'ACTIVE', now(), now())` |
| `prisma.organization.findMany({ orderBy: { createdAt: "desc" } })` | `SELECT * FROM organizations ORDER BY created_at DESC` |

### Migrations

Quand on modifie le `schema.prisma` et qu'on lance `prisma migrate dev`, Prisma genere un fichier SQL de migration et l'applique a la BDD. Cela fournit un historique versionne des changements de schema.

---

## 5. PostgreSQL - La base de donnees

**Configuration** : dans `docker-compose.yml`

Une base de donnees relationnelle qui stocke les donnees de facon persistante.

### Pourquoi un volume Docker ?

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

Sans volume, les donnees seraient perdues a chaque `docker compose down`. Le volume `postgres_data` persiste les donnees sur le disque de la machine, independamment du cycle de vie du container.

### Acces

- **Depuis le backend** : via l'URL `postgresql://verivo:verivo_secret@postgres:5432/verivo`
  - `postgres` ici est le **nom du service Docker**, pas localhost. Docker resout ce nom vers l'IP interne du container.
- **Depuis la machine hote** (pour debug) : `localhost:5432` avec un outil comme pgAdmin ou DBeaver

---

## 6. Docker Compose - L'orchestrateur

**Fichier** : `docker-compose.yml`

Docker Compose definit et lance tous les containers ensemble. Un seul fichier decrit toute l'infrastructure.

### Reseau Docker interne

```
+---------------------------------------------+
|           Reseau Docker (verivo)            |
|                                             |
|  nginx <--> frontend    (via nom "frontend")|
|  nginx <--> backend     (via nom "backend") |
|  backend <-> postgres   (via nom "postgres")|
|                                             |
|  Chaque service se connait par son nom.     |
|  Pas besoin d'IP, Docker gere le DNS.       |
+---------------------------------------------+

Ports exposes a l'exterieur :
  - 80   -> nginx (redirige vers 443)
  - 443  -> nginx (HTTPS)
  - 5432 -> postgres (acces direct pour debug)
```

### Ordre de demarrage

`depends_on` definit l'ordre de demarrage :

```
postgres -> backend -> frontend -> nginx
```

---

## Resume du flux complet

```
1. L'utilisateur ouvre https://localhost
2. Le navigateur se connecte au port 443 (Nginx)
3. Nginx dechiffre le SSL et envoie la requete au frontend (Vite)
4. Vite renvoie le HTML + JS de l'app React
5. React se charge dans le navigateur et fait GET /api/organizations
6. La requete arrive a Nginx -> routee vers le backend Express
7. Express valide la requete, Prisma interroge PostgreSQL
8. PostgreSQL repond -> Prisma -> Express -> Nginx -> Navigateur
9. React affiche la liste des organisations
```

---

## Lancement

```bash
cd Verivo/

# Demarrer tous les services
docker compose up --build

# Lancer la migration Prisma (dans un autre terminal)
docker exec verivo-backend npx prisma migrate dev --name init
```

- **Application** : https://localhost
- **API** : https://localhost/api/organizations
- **PostgreSQL** (debug) : localhost:5432
