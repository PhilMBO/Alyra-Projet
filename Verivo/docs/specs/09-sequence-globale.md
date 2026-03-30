# Diagramme de séquence global — Flux complet Verivo

## Vue d'ensemble du cycle de vie d'un scrutin

```
                    M. FédéX                Verivo (Backend)              Blockchain               Mme ClubY
                    ────────                ────────────────              ──────────               ──────────
  UC-1                │                           │                          │                         │
  Onboarding          │── register ──────────────>│                          │                         │
                      │                           │── create user ──────────>│ (wallet custodial)      │
                      │                           │── create org ───────────>│                         │
                      │                           │── create tenant schema──>│                         │
                      │<── JWT + dashboard ───────│                          │                         │
                      │                           │                          │                         │
  UC-2                │                           │                          │                         │
  Configuration       │── create election ───────>│                          │                         │
                      │── add choices ───────────>│                          │                         │
                      │── upload CSV ────────────>│                          │                         │
                      │                           │── parse & validate ─────>│                         │
                      │                           │── create voter accounts─>│                         │
                      │                           │── populate registry ────>│                         │
                      │<── election (draft) ──────│                          │                         │
                      │                           │                          │                         │
  UC-3                │                           │                          │                         │
  Déploiement         │── deploy ────────────────>│                          │                         │
                      │                           │── deploy VerivoElection─────────────>│             │
                      │                           │── deploy VerivoVotingNFT────────────>│             │
                      │                           │── batchMint NFTs ──────────────────>│             │
                      │                           │── update DB (open) ────>│             │             │
                      │<── contract addresses ────│                          │             │             │
                      │                           │                          │             │             │
  UC-4                │                           │                          │             │             │
  Vérification        │                           │                          │             │             │
                      │                           │                          │             │── login ───>│
                      │                           │<────────── GET /me/elections ─────────────────────│
                      │                           │── query voter_registry──>│             │             │
                      │                           │── balanceOf(wallet) ────────────────>│             │
                      │                           │──────────── elections + NFT status ──────────────>│
                      │                           │                          │             │             │
  UC-5                │                           │                          │             │             │
  Vote                │                           │                          │      ┌──────┤             │
                      │                           │                          │      │  Wallet           │
                      │                           │                          │      │  (MetaMask)       │
                      │                           │                          │<─── vote(choiceIndex) ──│
                      │                           │                          │── verify NFT            │
                      │                           │                          │── record vote            │
                      │                           │                          │── emit VoteCast          │
                      │                           │<── event VoteCast ──────│                         │
                      │                           │── update participation──>│                         │
                      │                           │                          │── tx confirmation ─────>│
                      │                           │                          │                         │
  UC-6                │                           │                          │                         │
  Décompte            │── close ─────────────────>│                          │                         │
                      │                           │── close() ─────────────────────────>│             │
                      │── tally ─────────────────>│                          │             │             │
                      │                           │── tally() ─────────────────────────>│             │
                      │                           │── getResults() ─────────────────────>│             │
                      │                           │── save results in DB ──>│             │             │
                      │<── results ───────────────│                          │             │             │
                      │                           │                          │             │             │
  UC-7                │                           │                          │             │             │
  Vérification        │     ┌── Any user ─────────────────────────────────────────────────┤             │
  universelle         │     │                     │                          │             │             │
                      │     │── GET /public/results ──────>│                 │             │             │
                      │     │                     │── getResults() on-chain──────────────>│             │
                      │     │                     │── compare DB vs chain ──>│             │             │
                      │     │<── public results ──│                          │             │             │
                      │     │                     │                          │             │             │
                      │     │── (optionnel) read contract directly ─────────────────────>│             │
                      │     │<── on-chain results ─────────────────────────────────────────│             │
                      │                           │                          │             │             │
  UC-8                │                           │                          │             │             │
  Badge NFT           │                           │── generate SVG badges ──>│             │             │
                      │                           │── upload to IPFS ───────>│             │             │
                      │                           │── batchMint badges ─────────────────>│             │
                      │                           │── update DB ───────────>│             │             │
                      │                           │                          │── badge ──────────────>│
                      │                           │                          │             │             │
```

---

## Transitions d'état du scrutin

```
  ┌─────────┐     deploy      ┌──────────┐     close      ┌──────────┐     tally      ┌──────────┐
  │  DRAFT  │────────────────>│   OPEN   │───────────────>│  CLOSED  │──────────────>│ TALLIED  │
  └─────────┘                 └──────────┘                └──────────┘               └────┬─────┘
       │                           │                                                      │
       │                           │ vote()                                                │ archive
       │                           │ (pendant open)                                        │
       │                           ▼                                                      ▼
       │                      votes enregistrés                                    ┌──────────┐
       │                      on-chain                                             │ ARCHIVED │
       │                                                                           └──────────┘
       │
  Modifications possibles :
  - Ajouter/modifier choix
  - Importer votants
  - Modifier dates/quorum
```

---

## Cycle de vie des NFTs

```
  NFT Droit de vote (Soul-bound)
  ──────────────────────────────

  UC-3: Mint ──> détenu par le votant ──> UC-5: Vote ──> (optionnel: burn)

  Status: pending → minted → burned


  NFT Badge de participation (Transférable)
  ──────────────────────────────────────────

  UC-8: Mint (après tally) ──> détenu par le votant ──> libre (transfert, vente, collection)

  Status: pending → minted
  Variantes: "A participé" (gold) | "N'a pas participé" (silver)
```

---

## Matrice Couche × Use Case

```
                  UC-1   UC-2   UC-3   UC-4   UC-5   UC-6   UC-7   UC-8
  ───────────────────────────────────────────────────────────────────────
  Frontend         ●      ●      ○      ●      ●      ○      ●      ●
  Backend API      ●      ●      ●      ●      ○*     ●      ●      ●
  PostgreSQL       ●      ●      ●      ●      ○      ●      ○      ●
  Smart Contract   ─      ─      ●      ○      ●      ●      ●      ●
  IPFS             ─      ─      ─      ─      ─      ─      ─      ●

  ● = couche principale
  ○ = couche secondaire
  ○* = uniquement pour custodial
  ─ = non impliqué
```
