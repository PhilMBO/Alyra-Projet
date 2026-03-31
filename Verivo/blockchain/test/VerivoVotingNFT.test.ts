import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("VerivoVotingNFT", function () {
  let votingNFT: any;
  let owner: any;
  let minter: any;
  let voter1: any;
  let voter2: any;

  beforeEach(async function () {
    // ─── Setup ───────────────────────────────────────────────
    // getWalletClients() → wallets de test Hardhat
    // owner  = déployeur (DEFAULT_ADMIN_ROLE)
    // minter = celui qui mint/burn les NFT (MINTER_ROLE)
    const connection = await network.connect();
    const { viem } = connection;
    [owner, minter, voter1, voter2] = await viem.getWalletClients();
    votingNFT = await viem.deployContract("VerivoVotingNFT", [
      minter.account.address,
    ]);
  });

  // ============================================================
  // ÉTAPE 1 — Déploiement
  // ============================================================
  // Objectif : vérifier que le contrat se déploie avec
  //   - le bon nom et symbole ERC721
  //   - les bons rôles AccessControl
  //
  // Concepts :
  //   constructor() → appelé une seule fois au déploiement
  //   ERC721("nom", "symbole") → standard NFT
  //   AccessControl → gestion de rôles (MINTER, ADMIN)
  // ============================================================
  describe("Déploiement", function () {
    it("devrait se déployer avec le nom 'VerivoVotingNFT' et le symbole 'VVOTE'", async function () {
      // name() et symbol() → fonctions view héritées de ERC721
      const name = await votingNFT.read.name();
      const symbol = await votingNFT.read.symbol();
      assert.equal(name, "VerivoVotingNFT");
      assert.equal(symbol, "VVOTE");
    });

    it("devrait attribuer MINTER_ROLE à l'adresse fournie", async function () {
      // hasRole(bytes32 role, address account) → bool
      const MINTER_ROLE = await votingNFT.read.MINTER_ROLE();
      const hasMinterRole = await votingNFT.read.hasRole([
        MINTER_ROLE,
        minter.account.address,
      ]);
      assert.equal(hasMinterRole, true);
    });

    it("devrait attribuer DEFAULT_ADMIN_ROLE au déployeur", async function () {
      // DEFAULT_ADMIN_ROLE (0x00) → peut gérer tous les autres rôles
      const DEFAULT_ADMIN_ROLE = await votingNFT.read.DEFAULT_ADMIN_ROLE();
      const hasAdminRole = await votingNFT.read.hasRole([
        DEFAULT_ADMIN_ROLE,
        owner.account.address,
      ]);
      assert.equal(hasAdminRole, true);
    });
  });

    // ============================================================
    // ÉTAPE 2 — Mint
    // ============================================================
    // Objectif : vérifier que le MINTER peut créer un NFT de vote
    //
    // Concepts :
    //   safeMint(address to) → crée un NFT pour l'adresse donnée
    //   onlyRole(MINTER_ROLE) → seul le minter peut appeler
    //   balanceOf(address) → nombre de NFT possédés (hérité ERC721)
    //   ownerOf(tokenId) → propriétaire du NFT (hérité ERC721)
    // ============================================================
    describe("Mint", function () {
      it("devrait permettre au MINTER de mint un NFT pour un voter", async function () {
        // write.safeMint → appelle la fonction en transaction
        // account: minter.account → signe avec le wallet minter
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        // balanceOf → voter1 possède maintenant 1 NFT
        const balance = await votingNFT.read.balanceOf([
          voter1.account.address,
        ]);
        assert.equal(balance, 1n); // 1n = BigInt(1), Solidity renvoie uint256

        // ownerOf(tokenId 0) → le premier NFT minté a l'id 0
        const nftOwner = await votingNFT.read.ownerOf([0n]);
        assert.equal(
          nftOwner.toLowerCase(),
          voter1.account.address.toLowerCase()
        );
      });
    });
});
