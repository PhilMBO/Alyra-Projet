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

beforeEach(async function () {
      const connection = await network.connect();
      const { viem } = connection;
      [owner, minter, voter1, voter2, voter3] = await viem.getWalletClients();

      votingNFT = await viem.deployContract("VerivoVotingNFT", 
        [ minter.account.address,5n,]);

      // 1 contrat = 1 scrutin, paramètres au déploiement
        voting = await viem.deployContract("VerivoVoting", [votingNFT.address,
        minter.account.address,"Budget participatif 2026",["Rénovation du parc", "Piste cyclable"],
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
  });