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
  async function deployFreshVoting(title: string, choices: string[]) {
    const connection = await network.connect();
    const { viem } = connection;
    return await viem.deployContract("VerivoVoting", [
      votingNFT.address,
      minter.account.address,
      title,
      choices,
    ]);
  }

  /// Mint des NFT pour une liste d'adresses via safeMintBatch
  async function mintVotingRights(addresses: string[]) {
    await votingNFT.write.safeMintBatch([addresses], { account: minter.account });
  }

  /// Exécute le cycle complet : mint → open → votes → close → tally
  async function runFullVotingCycle(
    voters: { account: any; choiceIndex: bigint }[]
  ) {
    const addresses = voters.map((v) => v.account.address);
    await mintVotingRights(addresses);
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

    voting = await viem.deployContract("VerivoVoting", [
      votingNFT.address,
      minter.account.address,
      "Budget participatif 2026",
      ["Rénovation du parc", "Piste cyclable"],
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
      await mintVotingRights([voter1.account.address, voter2.account.address]);
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
  //   Seul l'organisationAdministrator peut fermer le scrutin
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

    it("devrait refuser si l'appelant n'est pas l'admin", async function () {
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
      await mintVotingRights([voter1.account.address]);
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
        voter1.account.address,
        voter2.account.address,
        voter3.account.address,
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
        votingDraft.write.tallyVotes({ account: minter.account })
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
});
