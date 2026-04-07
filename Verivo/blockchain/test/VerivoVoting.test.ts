import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("VerivoVoting", function () {
  let voting: any;
  let votingNFT: any;
  let owner: any;
  let minter: any;
  let voter1: any;
  let voter2: any;
  let voter3: any;

  // ─── Helpers ────────────────────────────────────────────────
  // Factorisent les opérations répétitives pour garder les tests lisibles

  /// Déploie un nouveau contrat VerivoVoting avec des paramètres par défaut
  /// duration → durée du scrutin en secondes (défaut : 7 heures = 25200s)
  async function deployFreshVoting(title: string, choices: string[], duration: bigint = 25200n) {
    const connection = await network.connect();
    const { viem } = connection;
    return await viem.deployContract("VerivoVoting", [
      votingNFT.address,
      minter.account.address,
      title,
      choices,
      duration,
    ]);
  }

  /// Mint des NFT pour une liste de VoterConfig via safeMintBatch
  /// VoterConfig = { recipient: address, weight: uint256 }
  /// → les données adresse/poids sont toujours liées dans un seul objet
  async function mintVotingRights(voters: { recipient: string; weight: bigint }[]) {
    await votingNFT.write.safeMintBatch([voters], { account: minter.account });
  }

  /// Exécute le cycle complet : mint → open → votes → close → tally
  /// Chaque votant porte son poids (weight) et son choix (choiceIndex)
  /// weight est optionnel, défaut = 1n (vote simple)
  async function runFullVotingCycle(
    voters: { account: any; choiceIndex: bigint; weight?: bigint }[]
  ) {
    const voterConfigs = voters.map((v) => ({
      recipient: v.account.address,
      weight: v.weight || 1n,
    }));
    await mintVotingRights(voterConfigs);
    await voting.write.openVoting({ account: minter.account });
    for (const v of voters) {
      await voting.write.castVote([v.choiceIndex], { account: v.account });
    }
    await voting.write.closeVoting({ account: minter.account });
    await voting.write.tallyVotes({ account: minter.account });
  }

  // ─── Setup ─────────────────────────────────────────────────
  beforeEach(async function () {
    const connection = await network.connect();
    const { viem } = connection;
    [owner, minter, voter1, voter2, voter3] = await viem.getWalletClients();

    votingNFT = await viem.deployContract("VerivoVotingNFT", [
      minter.account.address,
      5n,
    ]);

    // Le constructor prend une durée en secondes
    // 25200n = 7 jours (7 * 60 * 60)
    voting = await viem.deployContract("VerivoVoting", [
      votingNFT.address,
      minter.account.address,
      "Budget participatif 2026",
      ["Rénovation du parc", "Piste cyclable"],
      25200n,
    ]);
  });

  // ============================================================
  // ÉTAPE 1 — Déploiement
  // ============================================================
  // Objectif : le contrat de Voting connaît le contrat NFT
  //
  // Concepts :
  //   Le Voting dépend du NFT pour vérifier les droits de vote
  //   On passe l'adresse du NFT au constructor → couplage loose
  // ============================================================
  describe("Déploiement", function () {
    it("devrait stocker l'adresse du contrat NFT", async function () {
      const nftAddress = await voting.read.votingNFT();
      assert.equal(
        nftAddress.toLowerCase(),
        votingNFT.address.toLowerCase()
      );
    });
  });

  // ============================================================
  // ÉTAPE 2 — Paramètres du scrutin
  // ============================================================
  // Objectif : le contrat est déployé avec un titre et des choix
  //
  // Concepts :
  //   1 contrat = 1 scrutin (déployé par le backend pour chaque vote)
  //   Les paramètres sont fixés au constructor → immutables
  //   enum Status → Draft, Open, Closed, Tallied
  // ============================================================
  describe("Paramètres du scrutin", function () {
    it("devrait stocker le titre du scrutin", async function () {
      const title = await voting.read.title();
      assert.equal(title, "Budget participatif 2026");
    });

    it("devrait stocker les choix", async function () {
      const choices = await voting.read.getChoices();
      assert.equal(choices.length, 2);
      assert.equal(choices[0], "Rénovation du parc");
      assert.equal(choices[1], "Piste cyclable");
    });

    it("devrait avoir le statut Draft au déploiement", async function () {
      const status = await voting.read.status();
      assert.equal(status, 0); // 0 = Draft
    });
  });

  // ============================================================
  // ÉTAPE 3 — Rôles
  // ============================================================
  // Objectif : distinguer le déployeur (Verivo) et l'admin org
  //
  // Concepts :
  //   Ownable → le déployeur (Verivo) est owner
  //   organisationAdministrator → l'admin de l'organisation, passé au constructor
  //   C'est l'organisationAdministrator qui gère le scrutin (open, close, tally)
  //   Le owner (Verivo) déploie et peut intervenir si nécessaire
  // ============================================================
  describe("Rôles", function () {
    it("devrait attribuer le owner au déployeur (Verivo)", async function () {
      const contractOwner = await voting.read.owner();
      assert.equal(
        contractOwner.toLowerCase(),
        owner.account.address.toLowerCase()
      );
    });

    it("devrait stocker l'adresse de l'admin organisation", async function () {
      const admin = await voting.read.organisationAdministrator();
      assert.equal(
        admin.toLowerCase(),
        minter.account.address.toLowerCase()
      );
    });
  });

  // ============================================================
  // ÉTAPE 4 — Ouverture du scrutin
  // ============================================================
  // Objectif : passer le statut de Draft à Open
  //
  // Concepts :
  //   Seul l'organisationAdministrator peut ouvrir le scrutin
  //   Le scrutin doit être en Draft pour être ouvert
  //   On émet un événement pour notifier le frontend
  //   modifier onlyOrganisationAdministrator → contrôle d'accès custom
  //   block.timestamp est enregistré → sert de référence pour le délai
  // ============================================================
  describe("Ouverture du scrutin", function () {
    it("devrait passer le statut de Draft à Open", async function () {
      await voting.write.openVoting({ account: minter.account });
      const status = await voting.read.status();
      assert.equal(status, 1); // 1 = Open
    });

    it("devrait émettre un événement VotingOpened", async function () {
      await voting.write.openVoting({ account: minter.account });
      const events = await voting.getEvents.VotingOpened();
      assert.equal(events.length >= 1, true);
    });

    it("devrait refuser si l'appelant n'est pas l'admin", async function () {
      await assert.rejects(
        voting.write.openVoting({ account: voter1.account })
      );
    });

    it("devrait refuser si le scrutin n'est pas en Draft", async function () {
      await voting.write.openVoting({ account: minter.account });
      await assert.rejects(
        voting.write.openVoting({ account: minter.account })
      );
    });
  });

  // ============================================================
  // ÉTAPE 5 — Vote
  // ============================================================
  // Objectif : un détenteur de NFT peut voter pour un choix
  //
  // Concepts :
  //   Le scrutin doit être Open pour voter
  //   Le votant doit posséder un NFT (vérifié via hasVotingRight)
  //   Un votant ne peut voter qu'une seule fois
  //   mapping(address => bool) hasVoted → empêche le double vote
  //   mapping(uint256 => uint256) votesPerChoice → compteur par choix
  //   L'index du choix est passé en paramètre (0, 1, 2...)
  // ============================================================
  describe("Vote", function () {
    beforeEach(async function () {
      await mintVotingRights([
        { recipient: voter1.account.address, weight: 1n },
        { recipient: voter2.account.address, weight: 1n },
      ]);
      await voting.write.openVoting({ account: minter.account });
    });

    it("devrait permettre à un détenteur de NFT de voter", async function () {
      await voting.write.castVote([0n], { account: voter1.account });
      const hasVoted = await voting.read.hasVoted([voter1.account.address]);
      assert.equal(hasVoted, true);
    });

    it("devrait incrémenter le compteur du choix voté", async function () {
      await voting.write.castVote([0n], { account: voter1.account });
      const votes = await voting.read.votesPerChoice([0n]);
      assert.equal(votes, 1n);
    });

    it("devrait émettre un événement VoteCast", async function () {
      await voting.write.castVote([1n], { account: voter1.account });
      const events = await voting.getEvents.VoteCast();
      assert.equal(events.length >= 1, true);
    });

    it("devrait refuser si le votant a déjà voté", async function () {
      await voting.write.castVote([0n], { account: voter1.account });
      await assert.rejects(
        voting.write.castVote([1n], { account: voter1.account })
      );
    });

    it("devrait refuser si le votant ne possède pas de NFT", async function () {
      await assert.rejects(
        voting.write.castVote([0n], { account: voter3.account })
      );
    });

    it("devrait refuser si le scrutin n'est pas ouvert", async function () {
      const votingDraft = await deployFreshVoting("Scrutin fermé", ["Choix A"]);
      await assert.rejects(
        votingDraft.write.castVote([0n], { account: voter1.account })
      );
    });

    it("devrait refuser si l'index du choix est invalide", async function () {
      await assert.rejects(
        voting.write.castVote([99n], { account: voter1.account })
      );
    });
  });

  // ============================================================
  // ÉTAPE 6 — Fermeture du scrutin
  // ============================================================
  // Objectif : passer le statut de Open à Closed
  //
  // Concepts :
  //   Seul l'organisationAdministrator peut fermer le scrutin (avant le délai)
  //   Le scrutin doit être Open pour être fermé
  //   Une fois fermé, plus personne ne peut voter
  //   On émet un événement VotingClosed
  // ============================================================
  describe("Fermeture du scrutin", function () {
    beforeEach(async function () {
      await voting.write.openVoting({ account: minter.account });
    });

    it("devrait passer le statut de Open à Closed", async function () {
      await voting.write.closeVoting({ account: minter.account });
      const status = await voting.read.status();
      assert.equal(status, 2); // 2 = Closed
    });

    it("devrait émettre un événement VotingClosed", async function () {
      await voting.write.closeVoting({ account: minter.account });
      const events = await voting.getEvents.VotingClosed();
      assert.equal(events.length >= 1, true);
    });

    it("devrait refuser si l'appelant n'est pas l'admin (avant le délai)", async function () {
      // voter1 n'est pas admin et le délai n'est pas expiré → revert
      await assert.rejects(
        voting.write.closeVoting({ account: voter1.account })
      );
    });

    it("devrait refuser si le scrutin n'est pas ouvert", async function () {
      await voting.write.closeVoting({ account: minter.account });
      await assert.rejects(
        voting.write.closeVoting({ account: minter.account })
      );
    });

    it("devrait empêcher de voter après la fermeture", async function () {
      await mintVotingRights([
        { recipient: voter1.account.address, weight: 1n },
      ]);
      await voting.write.closeVoting({ account: minter.account });
      await assert.rejects(
        voting.write.castVote([0n], { account: voter1.account })
      );
    });
  });

  // ============================================================
  // ÉTAPE 7 — Dépouillement (Tally)
  // ============================================================
  // Objectif : déterminer le choix gagnant après la fermeture
  //
  // Concepts :
  //   Seul l'organisationAdministrator peut dépouiller
  //   Le scrutin doit être Closed pour être dépouillé
  //   On parcourt votesPerChoice pour trouver l'index avec le plus de votes
  //   winningChoiceIndex → stocké on-chain après le tally
  //   On émet un événement VotingTallied avec l'index gagnant
  // ============================================================
  describe("Dépouillement", function () {
    beforeEach(async function () {
      await mintVotingRights([
        { recipient: voter1.account.address, weight: 1n },
        { recipient: voter2.account.address, weight: 1n },
        { recipient: voter3.account.address, weight: 1n },
      ]);
      await voting.write.openVoting({ account: minter.account });
      // voter1 et voter3 → choix 1, voter2 → choix 0
      await voting.write.castVote([1n], { account: voter1.account });
      await voting.write.castVote([0n], { account: voter2.account });
      await voting.write.castVote([1n], { account: voter3.account });
      await voting.write.closeVoting({ account: minter.account });
    });

    it("devrait passer le statut de Closed à Tallied", async function () {
      await voting.write.tallyVotes({ account: minter.account });
      const status = await voting.read.status();
      assert.equal(status, 3); // 3 = Tallied
    });

    it("devrait déterminer le choix gagnant", async function () {
      await voting.write.tallyVotes({ account: minter.account });
      const winningChoiceIndex = await voting.read.winningChoiceIndex();
      assert.equal(winningChoiceIndex, 1n); // "Piste cyclable" avec 2 votes
    });

    it("devrait émettre un événement VotingTallied", async function () {
      await voting.write.tallyVotes({ account: minter.account });
      const events = await voting.getEvents.VotingTallied();
      assert.equal(events.length >= 1, true);
    });

    it("devrait refuser si l'appelant n'est pas l'admin", async function () {
      await assert.rejects(
        voting.write.tallyVotes({ account: voter1.account })
      );
    });

    it("devrait refuser si le scrutin n'est pas fermé", async function () {
      const votingDraft = await deployFreshVoting("Autre scrutin", ["Choix A"]);
      await assert.rejects(
        votingDraft.write.tallyVotes({account: minter.account })
      );
    });
  });

  // ============================================================
  // ÉTAPE 8 — Consultation des résultats
  // ============================================================
  // Objectif : lire les résultats du scrutin après le dépouillement
  //
  // Concepts :
  //   getWinningChoice() → retourne le nom du choix gagnant (string)
  //   getResults() → retourne le nombre de votes pour chaque choix
  //   Ces fonctions ne sont lisibles qu'après le tally (status == Tallied)
  //   view functions → lecture seule, pas de gas
  // ============================================================
  describe("Consultation des résultats", function () {
    beforeEach(async function () {
      await runFullVotingCycle([
        { account: voter1.account, choiceIndex: 1n },
        { account: voter2.account, choiceIndex: 0n },
        { account: voter3.account, choiceIndex: 1n },
      ]);
    });

    it("devrait retourner le nom du choix gagnant", async function () {
      const winningChoice = await voting.read.getWinningChoice();
      assert.equal(winningChoice, "Piste cyclable");
    });

    it("devrait retourner les scores de tous les choix", async function () {
      const results = await voting.read.getResults();
      assert.equal(results.length, 2);
      assert.equal(results[0], 1n); // "Rénovation du parc" → 1 vote
      assert.equal(results[1], 2n); // "Piste cyclable" → 2 votes
    });

    it("devrait refuser getWinningChoice si le scrutin n'est pas dépouillé", async function () {
      const votingDraft = await deployFreshVoting("Autre scrutin", ["Choix A"]);
      await assert.rejects(votingDraft.read.getWinningChoice());
    });

    it("devrait refuser getResults si le scrutin n'est pas dépouillé", async function () {
      const votingDraft = await deployFreshVoting("Autre scrutin", ["Choix A"]);
      await assert.rejects(votingDraft.read.getResults());
    });
  });

  // ============================================================
  // ÉTAPE 9 — Edge cases du cycle de vie
  // ============================================================
  // Objectif : vérifier que les transitions d'état interdites revert
  //
  // Concepts :
  //   Le cycle est linéaire : Draft → Open → Closed → Tallied
  //   On ne peut pas sauter d'étape ni revenir en arrière
  //   Un scrutin sans votes peut quand même être dépouillé
  //   Le owner (Verivo) n'a pas les droits de l'admin organisation
  // ============================================================
  describe("Edge cases", function () {
    it("devrait refuser de fermer un scrutin en Draft", async function () {
      await assert.rejects(
        voting.write.closeVoting({ account: minter.account })
      );
    });

    it("devrait refuser de dépouiller un scrutin en Open", async function () {
      await voting.write.openVoting({ account: minter.account });
      await assert.rejects(
        voting.write.tallyVotes({ account: minter.account })
      );
    });

    it("devrait refuser de rouvrir un scrutin fermé", async function () {
      await voting.write.openVoting({ account: minter.account });
      await voting.write.closeVoting({ account: minter.account });
      await assert.rejects(
        voting.write.openVoting({ account: minter.account })
      );
    });

    it("devrait refuser de rouvrir un scrutin dépouillé", async function () {
      await voting.write.openVoting({ account: minter.account });
      await voting.write.closeVoting({ account: minter.account });
      await voting.write.tallyVotes({ account: minter.account });
      await assert.rejects(
        voting.write.openVoting({ account: minter.account })
      );
    });

    it("devrait permettre de dépouiller un scrutin sans votes", async function () {
      await voting.write.openVoting({ account: minter.account });
      await voting.write.closeVoting({ account: minter.account });
      await voting.write.tallyVotes({ account: minter.account });
      const status = await voting.read.status();
      assert.equal(status, 3); // Tallied
      const winningChoiceIndex = await voting.read.winningChoiceIndex();
      assert.equal(winningChoiceIndex, 0n); // Premier choix par défaut (0 votes partout)
    });

    it("devrait refuser au owner (Verivo) d'ouvrir le scrutin", async function () {
      await assert.rejects(
        voting.write.openVoting({ account: owner.account })
      );
    });

    it("devrait refuser de dépouiller deux fois", async function () {
      await voting.write.openVoting({ account: minter.account });
      await voting.write.closeVoting({ account: minter.account });
      await voting.write.tallyVotes({ account: minter.account });
      await assert.rejects(
        voting.write.tallyVotes({ account: minter.account })
      );
    });
  });

  // ============================================================
  // ÉTAPE 10 — Vote pondéré
  // ============================================================
  // Objectif : le poids du NFT influence le décompte des votes
  //
  // Concepts :
  //   castVote appelle getVotingWeight() sur le contrat NFT
  //   votesPerChoice[choix] += weight (au lieu de +1)
  //   Le résultat du tally reflète les poids
  //   Ex: 1 votant de poids 5 bat 2 votants de poids 1
  // ============================================================
  describe("Vote pondéré", function () {
    it("devrait compter le vote avec le poids du NFT", async function () {
      // voter1 a un poids de 3 → son vote compte triple
      await mintVotingRights([
        { recipient: voter1.account.address, weight: 3n },
      ]);
      await voting.write.openVoting({ account: minter.account });

      await voting.write.castVote([0n], { account: voter1.account });
      const votes = await voting.read.votesPerChoice([0n]);
      // Le choix 0 a reçu 3 votes (pas 1)
      assert.equal(votes, 3n);
    });

    it("devrait faire gagner le votant avec le plus gros poids", async function () {
      // voter1 → poids 1, vote choix 0 (1 point pour choix 0)
      // voter2 → poids 5, vote choix 1 (5 points pour choix 1)
      // → choix 1 gagne (5 > 1)
      await mintVotingRights([
        { recipient: voter1.account.address, weight: 1n },
        { recipient: voter2.account.address, weight: 5n },
      ]);
      await voting.write.openVoting({ account: minter.account });
      await voting.write.castVote([0n], { account: voter1.account });
      await voting.write.castVote([1n], { account: voter2.account });
      await voting.write.closeVoting({ account: minter.account });
      await voting.write.tallyVotes({ account: minter.account });

      const winningChoice = await voting.read.getWinningChoice();
      assert.equal(winningChoice, "Piste cyclable"); // choix 1
    });

    it("devrait retourner les scores pondérés dans getResults", async function () {
      // voter1 → poids 2, vote choix 0
      // voter2 → poids 3, vote choix 1
      // voter3 → poids 1, vote choix 0
      // Résultat : choix 0 = 2+1 = 3, choix 1 = 3
      await runFullVotingCycle([
        { account: voter1.account, choiceIndex: 0n, weight: 2n },
        { account: voter2.account, choiceIndex: 1n, weight: 3n },
        { account: voter3.account, choiceIndex: 0n, weight: 1n },
      ]);

      const results = await voting.read.getResults();
      assert.equal(results[0], 3n); // Choix 0 : 2 + 1
      assert.equal(results[1], 3n); // Choix 1 : 3
    });
  });

  // ============================================================
  // ÉTAPE 11 — Délai automatique
  // ============================================================
  // Objectif : le scrutin peut être fermé par n'importe qui après le délai
  //
  // Concepts :
  //   votingDuration → durée en secondes, fixée au constructor
  //   votingStartTime → block.timestamp enregistré à l'ouverture
  //   block.timestamp >= votingStartTime + votingDuration → expiré
  //   L'admin peut fermer à tout moment (même avant le délai)
  //   N'importe qui peut fermer après le délai
  //   evm_increaseTime → avance le temps dans les tests Hardhat
  //     → décale l'horloge interne de la blockchain de test
  //   evm_mine → mine un bloc pour appliquer le nouveau timestamp
  //     → sans mine, le block.timestamp n'est pas mis à jour
  // ============================================================
  describe("Délai automatique", function () {
    it("devrait stocker la durée du scrutin", async function () {
      // votingDuration est fixé au constructor → 25200 = 7 heures
      const duration = await voting.read.votingDuration();
      assert.equal(duration, 25200n);
    });

    it("devrait enregistrer le timestamp à l'ouverture", async function () {
      // Avant l'ouverture, votingStartTime = 0
      await voting.write.openVoting({ account: minter.account });
      const startTime = await voting.read.votingStartTime();
      // startTime > 0 → le timestamp a été enregistré par openVoting
      assert.ok(startTime > 0n);
    });

    it("devrait permettre à l'admin de fermer avant le délai", async function () {
      // L'admin peut fermer quand il veut, pas besoin d'attendre
      await voting.write.openVoting({ account: minter.account });
      await voting.write.closeVoting({ account: minter.account });
      const status = await voting.read.status();
      assert.equal(status, 2); // Closed
    });

    it("devrait refuser à un non-admin de fermer avant le délai", async function () {
      // voter1 n'est pas admin ET le délai n'est pas expiré
      // → les deux conditions sont fausses → revert
      await voting.write.openVoting({ account: minter.account });
      await assert.rejects(
        voting.write.closeVoting({ account: voter1.account })
      );
    });

  it("devrait permettre à n'importe qui de fermer après le délai", async function () {
      await voting.write.openVoting({ account: minter.account });
      // networkHelpers.time.increase → avance le temps ET mine un bloc
      // time.duration.hours(7) → 25200 secondes
      // +1 → juste après l'expiration
      const connection = await network.connect();
      const { networkHelpers } = connection;
      await networkHelpers.time.increase(networkHelpers.time.duration.days(7) + 1);

      // gas: 200000n → bypasse l'estimation automatique de gas
      // L'estimation simule la transaction avec un timestamp décalé (bug Hardhat v3)
      // En fournissant le gas manuellement, on saute cette étape
      await voting.write.closeVoting({
          account: voter1.account,
          gas: 200000n,
      });
      const status = await voting.read.status();
      assert.equal(status, 2); // Closed
  });

    it("devrait refuser une durée de 0 au déploiement", async function () {
      // Une durée de 0 n'a pas de sens → le scrutin serait immédiatement fermable
      await assert.rejects(
        deployFreshVoting("Scrutin sans durée", ["Choix A"], 0n)
      );
    });
  });
});
