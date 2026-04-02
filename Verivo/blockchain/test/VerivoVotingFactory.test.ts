  import { describe, it, beforeEach } from "node:test";
  import assert from "node:assert/strict";
  import { network } from "hardhat";

  describe("VerivoVotingFactory", function () {
    let factory: any;
    let votingNFT: any;
    let owner: any;
    let organisationAdministrator: any;
    let voter1: any;

    beforeEach(async function () {
      const connection = await network.connect();
      const { viem } = connection;
      [owner, organisationAdministrator, voter1] = await viem.getWalletClients();

      votingNFT = await viem.deployContract("VerivoVotingNFT", [
        organisationAdministrator.account.address,
        10n,
      ]);

      factory = await viem.deployContract("VerivoVotingFactory");
    });

    // ============================================================
    // ÉTAPE 1 — Déploiement du Factory
    // ============================================================
    // Objectif : le factory se déploie et est prêt à créer des scrutins
    //
    // Concepts :
    //   Le factory est un contrat qui déploie d'autres contrats
    //   Pattern factory → centralise la création, facilite le suivi
    //   Le déployeur du factory est le owner (Verivo)
    // ============================================================
    describe("Déploiement", function () {
      it("devrait attribuer le owner au déployeur (Verivo)", async function () {
        const contractOwner = await factory.read.owner();
        assert.equal(
          contractOwner.toLowerCase(),
          owner.account.address.toLowerCase()
        );
      });
    });

    // ============================================================
    // ÉTAPE 2 — Création d'un scrutin
    // ============================================================
    // Objectif : le factory déploie un nouveau VerivoVoting
    //
    // Concepts :
    //   createVoting() → déploie un VerivoVoting et retourne son adresse
    //   Le factory stocke la liste des scrutins créés
    //   Événement VotingCreated → notifie le frontend
    //   Seul le owner (Verivo) peut créer des scrutins
    // ============================================================
    describe("Création d'un scrutin", function () {
      it("devrait créer un nouveau scrutin", async function () {
        await factory.write.createVoting([
          votingNFT.address,
          organisationAdministrator.account.address,
          "Budget participatif 2026",
          ["Rénovation du parc", "Piste cyclable"],
        ]);
        const votings = await factory.read.getVotings();
        assert.equal(votings.length, 1);
      });

      it("devrait émettre un événement VotingCreated", async function () {
        await factory.write.createVoting([
          votingNFT.address,
          organisationAdministrator.account.address,
          "Budget participatif 2026",
          ["Rénovation du parc", "Piste cyclable"],
        ]);
        const events = await factory.getEvents.VotingCreated();
        assert.equal(events.length >= 1, true);
      });

      it("devrait permettre de créer plusieurs scrutins", async function () {
        await factory.write.createVoting([
          votingNFT.address,
          organisationAdministrator.account.address,
          "Scrutin 1",
          ["Choix A", "Choix B"],
        ]);
        await factory.write.createVoting([
          votingNFT.address,
          organisationAdministrator.account.address,
          "Scrutin 2",
          ["Choix C", "Choix D"],
        ]);
        const votings = await factory.read.getVotings();
        assert.equal(votings.length, 2);
      });

      it("devrait refuser si l'appelant n'est pas le owner", async function () {
        await assert.rejects(
          factory.write.createVoting(
            [
              votingNFT.address,
              organisationAdministrator.account.address,
              "Budget participatif 2026",
              ["Rénovation du parc", "Piste cyclable"],
            ],
            { account: voter1.account }
          )
        );
      });
    });

    // ============================================================
    // ÉTAPE 3 — Le scrutin déployé est fonctionnel
    // ============================================================
    // Objectif : vérifier que le contrat créé par le factory fonctionne
    //
    // Concepts :
    //   Le factory est le msg.sender du VerivoVoting → il en est le owner
    //   L'organisationAdministrator peut gérer le scrutin normalement
    //   Le scrutin créé est un VerivoVoting standard
    // ============================================================
    describe("Scrutin fonctionnel", function () {
      it("devrait créer un scrutin avec les bons paramètres", async function () {
        await factory.write.createVoting([
          votingNFT.address,
          organisationAdministrator.account.address,
          "Budget participatif 2026",
          ["Rénovation du parc", "Piste cyclable"],
        ]);
        const votings = await factory.read.getVotings();
        const connection = await network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();

        // Lire le titre du scrutin déployé via son ABI
        const voting = await viem.getContractAt("VerivoVoting", votings[0]);
        const title = await voting.read.title();
        assert.equal(title, "Budget participatif 2026");

        const admin = await voting.read.organisationAdministrator();
        assert.equal(
          admin.toLowerCase(),
          organisationAdministrator.account.address.toLowerCase()
        );
      });

      it("devrait permettre à l'admin d'ouvrir le scrutin créé", async function () {
        await factory.write.createVoting([
          votingNFT.address,
          organisationAdministrator.account.address,
          "Budget participatif 2026",
          ["Rénovation du parc", "Piste cyclable"],
        ]);
        const votings = await factory.read.getVotings();
        const connection = await network.connect();
        const { viem } = connection;
        const voting = await viem.getContractAt("VerivoVoting", votings[0]);

        await voting.write.openVoting({ account: organisationAdministrator.account });
        const status = await voting.read.status();
        assert.equal(status, 1); // Open
      });
    });
  });