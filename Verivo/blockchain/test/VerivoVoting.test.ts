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

      // Déploie le NFT (pré-requis)
      votingNFT = await viem.deployContract("VerivoVotingNFT", [
        minter.account.address,
      ]);

      // Déploie le contrat de Voting en lui passant l'adresse du NFT
      voting = await viem.deployContract("VerivoVoting", [
        votingNFT.address,
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
  });