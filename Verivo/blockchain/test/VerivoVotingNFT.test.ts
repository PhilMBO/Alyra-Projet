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
    // ============================================================
    // ÉTAPE 3 — Restrictions
    // ============================================================
    // Objectif : vérifier les gardes-fous du contrat
    //
    // Concepts :
    //   revert → la transaction échoue et annule tout changement
    //   soul-bound → NFT non-transférable (pas de transferFrom)
    //   1 NFT par adresse → empêche le double vote
    //   onlyRole → seul le MINTER peut mint, pas n'importe qui
    // ============================================================
    describe("Restrictions", function () {
      it("devrait empêcher un non-MINTER de mint", async function () {
        // voter1 n'a pas MINTER_ROLE → la transaction doit revert
        await assert.rejects(
          votingNFT.write.safeMint([voter1.account.address], {
            account: voter1.account,
          })
        );
      });

      it("devrait empêcher de mint un 2e NFT pour la même adresse", async function () {
        // Premier mint → OK
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        // Deuxième mint pour la même adresse → doit revert
        await assert.rejects(
          votingNFT.write.safeMint([voter1.account.address], {
            account: minter.account,
          })
        );
      });

      it("devrait empêcher le transfert du NFT (soul-bound)", async function () {
        // Mint un NFT pour voter1
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        // voter1 tente de transférer son NFT à voter2 → doit revert
        await assert.rejects(
          votingNFT.write.transferFrom(
            [voter1.account.address, voter2.account.address, 0n],
            { account: voter1.account }
          )
        );
      });
    });
    // ============================================================
    // ÉTAPE 4 — Burn (révocation du droit de vote)
    // ============================================================
    // Objectif : vérifier que le MINTER peut brûler un NFT
    //
    // Concepts :
    //   burn(tokenId) → détruit le NFT, le retire de la circulation
    //   balanceOf revient à 0 après un burn
    //   ownerOf sur un token brûlé → revert (le token n'existe plus)
    //   seul le MINTER peut burn, pas le propriétaire du NFT
    // ============================================================
    describe("Burn", function () {
      it("devrait permettre au MINTER de burn un NFT", async function () {
        // Mint puis burn
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        await votingNFT.write.burn([0n], {
          account: minter.account,
        });

        // balanceOf → retombe à 0
        const balance = await votingNFT.read.balanceOf([
          voter1.account.address,
        ]);
        assert.equal(balance, 0n);

        // ownerOf → revert car le token n'existe plus
        await assert.rejects(
          votingNFT.read.ownerOf([0n])
        );
      });

      it("devrait empêcher un non-MINTER de burn", async function () {
        // Mint un NFT pour voter1
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        // voter1 tente de burn son propre NFT → revert
        await assert.rejects(
          votingNFT.write.burn([0n], {
            account: voter1.account,
          })
        );
      });
    });
    // ============================================================
    // ÉTAPE 5 — Lecture (hasVotingRight)
    // ============================================================
    // Objectif : fournir une fonction simple pour vérifier
    //   si une adresse possède un droit de vote
    //
    // Concepts :
    //   view function → lecture seule, pas de gas en appel externe
    //   balanceOf > 0 → possède au moins un NFT = a le droit de vote
    //   Cette fonction sera appelée par le contrat de voting
    // ============================================================
    describe("Lecture", function () {
      it("devrait retourner true si l'adresse possède un NFT de vote", async function () {
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        const hasRight = await votingNFT.read.hasVotingRight([
          voter1.account.address,
        ]);
        assert.equal(hasRight, true);
      });

      it("devrait retourner false si l'adresse ne possède pas de NFT", async function () {
        const hasRight = await votingNFT.read.hasVotingRight([
          voter2.account.address,
        ]);
        assert.equal(hasRight, false);
      });

      it("devrait retourner false après un burn", async function () {
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        await votingNFT.write.burn([0n], {
          account: minter.account,
        });
        const hasRight = await votingNFT.read.hasVotingRight([
          voter1.account.address,
        ]);
        assert.equal(hasRight, false);
      });
    });
      // ============================================================
    // ÉTAPE 6 — Gestion des rôles (Admin)
    // ============================================================
    // Objectif : vérifier que l'admin peut gérer les minters
    //
    // Concepts :
    //   grantRole(role, account) → donne un rôle (hérité AccessControl)
    //   revokeRole(role, account) → retire un rôle
    //   DEFAULT_ADMIN_ROLE → seul rôle autorisé à grant/revoke
    //   Un non-admin ne peut pas gérer les rôles
    // ============================================================
    describe("Gestion des rôles", function () {
      it("devrait permettre à l'admin d'ajouter un nouveau minter", async function () {
        const MINTER_ROLE = await votingNFT.read.MINTER_ROLE();
        // owner (admin) donne le rôle minter à voter1
        await votingNFT.write.grantRole([MINTER_ROLE, voter1.account.address], {
          account: owner.account,
        });
        const hasRole = await votingNFT.read.hasRole([
          MINTER_ROLE,
          voter1.account.address,
        ]);
        assert.equal(hasRole, true);
      });

      it("devrait permettre à l'admin de retirer le rôle minter", async function () {
        const MINTER_ROLE = await votingNFT.read.MINTER_ROLE();
        // owner retire le rôle minter
        await votingNFT.write.revokeRole([MINTER_ROLE, minter.account.address], {
          account: owner.account,
        });
        const hasRole = await votingNFT.read.hasRole([
          MINTER_ROLE,
          minter.account.address,
        ]);
        assert.equal(hasRole, false);
      });

      it("devrait empêcher un non-admin de gérer les rôles", async function () {
        const MINTER_ROLE = await votingNFT.read.MINTER_ROLE();
        // voter1 (non-admin) tente de se donner le rôle minter → revert
        await assert.rejects(
          votingNFT.write.grantRole([MINTER_ROLE, voter1.account.address], {
            account: voter1.account,
          })
        );
      });
    });
        // ============================================================
    // ÉTAPE 7 — Edge cases
    // ============================================================
    // Objectif : couvrir les cas limites du soul-bound
    //
    // Concepts :
    //   re-mint → est-ce qu'on peut redonner un droit de vote ?
    //   safeTransferFrom → 2e méthode de transfert ERC721
    //   approve → mécanisme de délégation ERC721 (interdit ici)
    // ============================================================
    describe("Edge cases", function () {
      it("devrait permettre de re-mint après un burn", async function () {
        // Mint → burn → re-mint
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        await votingNFT.write.burn([0n], { account: minter.account });

        // Re-mint → doit fonctionner, le voter retrouve son droit
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        const hasRight = await votingNFT.read.hasVotingRight([
          voter1.account.address,
        ]);
        assert.equal(hasRight, true);
      });

      it("devrait empêcher safeTransferFrom (soul-bound)", async function () {
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        await assert.rejects(
          votingNFT.write.safeTransferFrom(
            [voter1.account.address, voter2.account.address, 0n],
            { account: voter1.account }
          )
        );
      });

      it("devrait empêcher approve (soul-bound)", async function () {
        await votingNFT.write.safeMint([voter1.account.address], {
          account: minter.account,
        });
        await assert.rejects(
          votingNFT.write.approve([voter2.account.address, 0n], {
            account: voter1.account,
          })
        );
      });

      it("devrait revert si on burn un tokenId inexistant", async function () {
        await assert.rejects(
          votingNFT.write.burn([999n], { account: minter.account })
        );
      });
    });
});
