# Verivo - Modele de Donnees

## Vue d'ensemble

Le systeme Verivo est organise en **deux grandes zones** :

```
+=====================================================================+
|                                                                     |
|   ZONE GLOBALE (partagee entre toutes les organisations)            |
|                                                                     |
|   +------------------+    +------------------+                      |
|   |  Organisations   |    |   Utilisateurs   |                      |
|   +------------------+    +------------------+                      |
|              \                    /                                  |
|               \                  /                                   |
|            +------------------------+                               |
|            |  Membres Organisation  |                               |
|            +------------------------+                               |
|                                                                     |
+=====================================================================+

         |                    |                    |
         v                    v                    v

+================+   +================+   +================+
| ESPACE Org. A  |   | ESPACE Org. B  |   | ESPACE Org. C  |
|                |   |                |   |                |
| - Elections    |   | - Elections    |   | - Elections    |
| - Choix       |   | - Choix       |   | - Choix       |
| - Votants     |   | - Votants     |   | - Votants     |
| - NFTs        |   | - NFTs        |   | - NFTs        |
| - Resultats   |   | - Resultats   |   | - Resultats   |
+================+   +================+   +================+
```

---

## ZONE GLOBALE - Les donnees partagees

### 1. Organisation

> Une **organisation** represente une entite (entreprise, association, collectivite...)
> qui utilise Verivo pour organiser ses votes.

```
+---------------------------------------------------------------+
|                       ORGANISATION                            |
+---------------------------------------------------------------+
|                                                               |
|   Nom .............. "Mairie de Paris"                        |
|   Logo ............. [image]                                  |
|   Statut ........... Active | Suspendue | Archivee           |
|   Date de creation . 01/03/2026                              |
|                                                               |
+---------------------------------------------------------------+
```

**Statuts possibles :**

```
  Active ---------> Suspendue ---------> Archivee
  (en service)     (temporairement      (definitivement
                    desactivee)          fermee)
```

---

### 2. Utilisateur

> Un **utilisateur** est une personne inscrite sur Verivo.
> Il peut se connecter de deux facons : par portefeuille crypto (wallet) ou par email.

```
+---------------------------------------------------------------+
|                       UTILISATEUR                             |
+---------------------------------------------------------------+
|                                                               |
|   Methode de connexion :                                      |
|                                                               |
|     OPTION A : Wallet (portefeuille crypto)                   |
|     +--------------------------------------------+            |
|     | Adresse wallet : 0xAbC...123               |            |
|     | L'utilisateur gere lui-meme son wallet     |            |
|     +--------------------------------------------+            |
|                                                               |
|     OPTION B : Email                                          |
|     +--------------------------------------------+            |
|     | Email : jean.dupont@mail.com               |            |
|     | Mot de passe : ********                    |            |
|     | Un wallet est cree automatiquement         |            |
|     | (wallet "custodial" = gere par Verivo)     |            |
|     +--------------------------------------------+            |
|                                                               |
|   Nom affiche ....... "Jean Dupont"                          |
|   Identite verifiee . Oui / Non                              |
|                                                               |
+---------------------------------------------------------------+
```

---

### 3. Membre d'une Organisation

> Un utilisateur peut rejoindre une ou plusieurs organisations avec un **role** different dans chacune.

```
  +----------------+                      +----------------+
  |  Utilisateur   | ---- est membre ---> | Organisation   |
  |  Jean Dupont   |     avec un role     | Mairie Paris   |
  +----------------+                      +----------------+

  Roles possibles :

  +-------------------+---------------------------------------------------+
  | Role              | Ce qu'il peut faire                               |
  +-------------------+---------------------------------------------------+
  | Admin             | Gerer l'organisation, les membres, tout           |
  | Organisateur      | Creer et gerer des elections / votes              |
  | Membre            | Voter et consulter les resultats                  |
  +-------------------+---------------------------------------------------+
```

---

## ESPACE ORGANISATION - Les donnees de chaque organisation

> Chaque organisation dispose de son propre espace isole. Les donnees d'une
> organisation ne sont jamais visibles par une autre.

---

### 4. Election (ou Vote)

> Une **election** est un evenement de vote cree par un organisateur.

```
+---------------------------------------------------------------+
|                         ELECTION                              |
+---------------------------------------------------------------+
|                                                               |
|   Titre ........... "Election du delegue 2026"               |
|   Description ..... "Choisissez votre delegue..."            |
|                                                               |
|   Mode de scrutin :                                          |
|   +-----------------------------------------------------+    |
|   | - Uninominal 1 tour (1 choix, 1 tour)               |    |
|   | - Uninominal 2 tours (1 choix, jusqu'a 2 tours)     |    |
|   | - Jugement majoritaire (noter chaque choix)         |    |
|   | - Approbation (approuver plusieurs choix)           |    |
|   +-----------------------------------------------------+    |
|                                                               |
|   Type de choix :                                            |
|   - Candidat (des personnes)                                 |
|   - Proposition (des idees / textes)                         |
|                                                               |
|   Dates :                                                    |
|   [Debut : 15/03/2026 8h] ---------> [Fin : 20/03/2026 20h] |
|                                                               |
|   Quorum ........... 50 (nb minimum de votants requis)       |
|   Contrat blockchain 0xDef...789                             |
|   Cree par ......... Jean Dupont                             |
|                                                               |
+---------------------------------------------------------------+
```

**Cycle de vie d'une election :**

```
  Brouillon -----> Ouverte -----> Fermee -----> Depouillee -----> Archivee
  (en preparation)  (les votes    (plus de     (resultats        (terminee,
                     sont ouverts) nouveaux     calcules)         conservee)
                                   votes)
```

---

### 5. Choix (Candidat ou Proposition)

> Les **choix** sont les options parmi lesquelles les votants peuvent choisir.

```
  Election : "Election du delegue 2026"

  +--------+---------------------+----------------------------------+
  | Ordre  | Nom                 | Description                      |
  +--------+---------------------+----------------------------------+
  |   1    | Alice Martin        | "Candidate au poste de..."       |
  |   2    | Bob Leroy           | "Je propose de..."               |
  |   3    | Claire Duval        | "Mon programme est..."           |
  +--------+---------------------+----------------------------------+
```

---

### 6. Registre des Votants

> Le **registre** liste les personnes autorisees a voter pour une election donnee.

```
  Election : "Election du delegue 2026"

  +---------------------+-------------+---------------------+
  | Votant              | Eligible ?  | Inscrit le          |
  +---------------------+-------------+---------------------+
  | Jean Dupont         |     Oui     | 10/03/2026          |
  | Marie Curie         |     Oui     | 11/03/2026          |
  | Paul Rimbaud        |     Non     | 12/03/2026          |
  +---------------------+-------------+---------------------+
```

---

### 7. NFTs du Votant (Jetons Blockchain)

> Chaque votant recoit des **jetons numeriques (NFTs)** qui servent de preuve sur la blockchain.

```
  DEUX TYPES DE NFT :

  +------------------------------------------------------------------+
  |                                                                  |
  |  1. DROIT DE VOTE (voting_right)                                |
  |  +------------------------------------------------------------+ |
  |  |  - Remis a l'inscription au vote                           | |
  |  |  - Sert de "carte d'electeur numerique"                    | |
  |  |  - DETRUIT apres le vote (pour eviter de voter 2 fois)     | |
  |  |  - Non transferable (lie a l'identite = "soul-bound")      | |
  |  +------------------------------------------------------------+ |
  |                                                                  |
  |  2. PREUVE DE PARTICIPATION (participation_proof)               |
  |  +------------------------------------------------------------+ |
  |  |  - Remis APRES avoir vote                                  | |
  |  |  - Sert d'attestation "j'ai participe"                     | |
  |  |  - Conserve indefiniment                                    | |
  |  +------------------------------------------------------------+ |
  |                                                                  |
  +------------------------------------------------------------------+

  Cycle de vie du NFT Droit de Vote :

  En attente -----> Cree (mint) -----> Detruit (burn)
  (preparation)    (le votant peut     (le votant a vote,
                    maintenant voter)   le jeton est brule)
```

---

### 8. Journal de Participation

> Le **journal** enregistre QUI a vote, mais PAS POUR QUI (pour garantir l'anonymat).

```
  Election : "Election du delegue 2026"

  +---------------------+-----------+---------------------+--------------+
  | Votant              | A vote ?  | Date du vote        | Preuve       |
  |                     |           |                     | blockchain   |
  +---------------------+-----------+---------------------+--------------+
  | Jean Dupont         |    Oui    | 16/03/2026 14h30    | 0xAbc...     |
  | Marie Curie         |    Oui    | 17/03/2026 09h15    | 0xDef...     |
  | Paul Rimbaud        |    Non    |         -           |      -       |
  +---------------------+-----------+---------------------+--------------+

      Le contenu du vote (pour qui ?) est chiffre
      et stocke uniquement sur la blockchain.
      La base de donnees ne connait PAS le choix du votant.
```

---

### 9. Resultats de l'Election

> Les **resultats** sont calcules apres la fermeture du vote.

```
  Election : "Election du delegue 2026"    Depouille le : 20/03/2026 21h00

  +-------+---------------------+--------+---------------+
  | Place | Choix               | Votes  | Pourcentage   |
  +-------+---------------------+--------+---------------+
  |   1   | Alice Martin        |   45   |    45.00 %    |
  |   2   | Claire Duval        |   35   |    35.00 %    |
  |   3   | Bob Leroy           |   20   |    20.00 %    |
  +-------+---------------------+--------+---------------+
                                   100        100.00 %
```

---

## Resume des Relations

```
                          ZONE GLOBALE
  +----------------+                      +------------------+
  |                |   appartient a       |                  |
  | UTILISATEUR    |--------------------->| ORGANISATION     |
  |                |   (avec un role)     |                  |
  +----------------+                      +------------------+
         |                                        |
         |                                        |
         | participe a              organise       |
         |                                        |
         v                                        v
  +---------------------------------------------------------------+
  |                    ESPACE ORGANISATION                        |
  |                                                               |
  |   ELECTION                                                    |
  |      |                                                        |
  |      |--- contient des ---> CHOIX (candidats/propositions)    |
  |      |                                                        |
  |      |--- a un -----------> REGISTRE DES VOTANTS              |
  |      |                          |                             |
  |      |                          |--- recoit des --> NFTs      |
  |      |                                                        |
  |      |--- produit un -----> JOURNAL DE PARTICIPATION          |
  |      |                                                        |
  |      |--- genere des -----> RESULTATS                         |
  |                                                               |
  +---------------------------------------------------------------+
```

---

## Securite et Confidentialite - Points Cles

```
  +------------------------------------------------------------------+
  |                                                                  |
  |  ANONYMAT         Le systeme sait QUI a vote,                   |
  |                    mais PAS POUR QUI.                            |
  |                    Le choix est chiffre sur la blockchain.        |
  |                                                                  |
  |  INVIOLABILITE     Chaque vote est enregistre sur la blockchain. |
  |                    Impossible de le modifier apres coup.         |
  |                                                                  |
  |  ISOLATION         Les donnees de chaque organisation sont       |
  |                    completement separees les unes des autres.    |
  |                                                                  |
  |  NFT SOUL-BOUND    Le droit de vote ne peut pas etre transfere   |
  |                    a quelqu'un d'autre.                          |
  |                                                                  |
  +------------------------------------------------------------------+
```
