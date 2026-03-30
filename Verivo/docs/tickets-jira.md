# Tickets Jira — Verivo

## S1 — Smart contracts + tests

**Epic** : Créer les programmes blockchain qui gèrent le vote et les droits de vote puis vérifier qu'ils fonctionnent. Charge : 12 pts.

| Tâche | Description |
|---|---|
| Initialiser l'environnement blockchain | Mettre en place les outils pour développer et tester les programmes blockchain. |
| Créer le NFT de droit de vote (non transférable) | Créer le jeton numérique représentant le droit de vote. Unique et impossible à revendre ou donner. |
| Créer le contrat de scrutin (vote, clôture, décompte) | Programme blockchain principal : enregistrer les candidats, voter, fermer le scrutin, compter les résultats. |
| Créer le badge de participation (transférable) | Jeton numérique remis après le scrutin attestant de la participation. Collectible conservable. |
| Tester le NFT de droit de vote | Vérifier que le NFT se crée, qu'il est impossible à transférer et que seul l'admin peut en émettre. |
| Tester le contrat de scrutin | Vérifier que le vote fonctionne, pas de double vote, seul l'admin clôture, résultats corrects. |
| Tester le badge de participation | Vérifier que le badge se crée, qu'il est transférable et que les infos de participation sont exactes. |

---

## S2 — Backend complet

**Epic** : Construire le serveur qui relie le site web, la base de données et la blockchain. Charge : 10 pts.

| Tâche | Description |
|---|---|
| Mettre à jour la base de données | Adapter la base pour gérer les utilisateurs (admin, organisateur, membre) et les deux modes de connexion. |
| Créer l'inscription et la connexion | Permettre de créer son compte (email ou wallet), renseigner son organisation et accéder à la plateforme. |
| Créer l'espace privé de chaque organisation | Générer automatiquement un espace isolé en base de données pour chaque organisation. |
| Gérer les scrutins (créer, modifier, lister) | Permettre aux admins de créer et gérer leurs scrutins : titre, candidats, dates, quorum. |
| Importer la liste électorale (CSV) | Uploader un fichier CSV de votants. Le système crée les comptes manquants et inscrit tout le monde. |
| Connecter le serveur à la blockchain | Permettre au serveur de déployer les contrats, distribuer les droits de vote et récupérer les résultats. |

---

## S3 — Frontend + déploiement Polygon Amoy

**Epic** : Pages du site web + mise en ligne des contrats sur la blockchain de test. Charge : 12 pts.

| Tâche | Description |
|---|---|
| Connecter le site aux wallets (MetaMask) | Permettre aux utilisateurs de connecter leur portefeuille crypto au site pour s'identifier et voter. |
| Pages d'inscription et de connexion | Créer un compte par email ou wallet, renseigner son organisation, se connecter. |
| Tableau de bord administrateur | Voir ses scrutins, en créer, ajouter des candidats, importer la liste des votants. |
| Page de vote | L'électeur voit les candidats, fait son choix et vote. Le vote est confirmé sur la blockchain. |
| Pages résultats publics et badges | Résultats accessibles par tous sans connexion avec preuves blockchain. Page de badges personnels. |
| Déployer les contrats sur la blockchain de test | Mettre en ligne les 3 contrats sur Polygon Amoy et vérifier qu'ils sont accessibles publiquement. |
| Vérifier les contrats et tester le parcours complet | Publier le code source des contrats. Tester le parcours complet : déploiement, vote, décompte, résultats. |

---

## S4 — Sécurité + CI + docs

**Epic** : Audit sécurité, automatisation, mise en ligne et soutenance. Charge : 6 pts.

| Tâche | Description |
|---|---|
| Audit de sécurité et tableau des attaques | Analyser les failles possibles. Documenter les attaques connues et les protections mises en place. |
| Automatiser les vérifications et mettre en ligne | Vérifications automatiques du code à chaque modification. Héberger le site sur une URL publique. |
| Finaliser la documentation et préparer la soutenance | Captures d'écran, adresses des contrats, présentation orale, démonstration en direct. |
