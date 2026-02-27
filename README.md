# Verivo

> Solution de vote décentralisée destinée aux entreprises, associations et institutions.

## Résumé du projet

Proposer une solution de vote avec les caractéristiques suivantes :

- **Inviolabilité** - Sécurité garantie par la blockchain
- **Auditabilité** - Transparence et vérifiabilité des résultats
- **Anonymat** - Protection de l'identité des votants
- **Accessibilité** - Interface intuitive pour le grand public

## Solution imaginée

> Il s'agit d'une solution large. Un premier périmètre raisonnable sera défini en groupe pour rentrer dans les contraintes de la certification Alyra.

### 1 - Blockchain & Backend

Techniques envisagées pour garantir les caractéristiques recherchées :

- Smart contracts et NFT pour l'identification des votants (quasi soul-bound)
- Utilisation de ZKP + MPC + chiffrement homomorphe pour l'anonymat du vote
- Rotation de wallet pour casser le lien entre les votes d'une même personne
- Smart contracts pour différents systèmes de vote (uninominal à x tours, jugement majoritaire, etc.)
- Transactions sans frais (la blockchain doit être invisible pour l'utilisateur)

### 2 - Wallet Mobile

Application mobile personnalisée avec une interface intuitive et grand public :

- Wallets non-custodials avec utilisation des enclaves sécurisées natives
- Parcours de vérification d'identité
- Parcours des votes accessibles à l'utilisateur
- Parcours de vote
- Consultation des résultats
- Vérification du résultat d'un vote (audit utilisateur)

### 3 - Interface Organisateur

Application web permettant d'organiser et de paramétrer un vote :

- Authentification par le wallet mobile
- Paramétrage et création d'un nouveau vote
- Actions d'administration d'un vote (MPC, compilation homomorphe, etc.)
- Consultation des votes ultérieurs

## Structure du projet

```
Verivo/
├── blockchain/
│   ├── contracts/      # Smart contracts Solidity
│   ├── scripts/        # Scripts de déploiement
│   └── tests/          # Tests des smart contracts
│       └── helpers/    # Utilitaires de test
├── docs/               # Documentation
└── frontend/           # Interface utilisateur
```

## Infos projet

| | |
|---|---|
| **Date de début** | 23/02/2026 |
| **Nom du projet** | TBD |

## Equipe

- Etienne Wallet
- Solène Mallié
- Arnaud Calvo
- Clément Conand
- Philippe Mbongue

## Choix technologiques

| Domaine | Choix |
|---|---|
| Blockchain | _A définir_ |
| Frontend | _A définir_ |
| Architecture | _A définir_ |

---

Projet réalisé dans le cadre de la formation [Alyra]
