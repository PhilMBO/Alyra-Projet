import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("VerivoVotingNFT", function () {
  let votingNFT: any;
  let owner: any;
  let minter: any;
  let voter1: any;
  let voter2: any;

  // Helper pour mint un NFT rapidement — passe par safeMintBatch avec un VoterConfig
  // Le struct lie l'adresse et le poids dans un seul objet
  // → impossible de désynchroniser les deux tableaux
  async function mintTo(voter: { recipient: string; weight: bigint }) {
    await votingNFT.write.safeMintBatch(
      [[voter]],
      { account: minter.account }
    );
  }

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
      5n,  // maximumVoters
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
  //   safeMintBatch([VoterConfig]) → seul point d'entrée pour le mint
  //   VoterConfig = { recipient: address, weight: uint256 }
  //   Pour un mint individuel → passer un tableau d'un seul VoterConfig
  //   onlyRole(MINTER_ROLE) → seul le minter peut appeler
  //   balanceOf(address) → nombre de NFT possédés (hérité ERC721)
  //   ownerOf(tokenId) → propriétaire du NFT (hérité ERC721)
  // ============================================================
  describe("Mint", function () {
    it("devrait permettre au MINTER de mint un NFT pour un voter", async function () {
      // safeMintBatch avec un VoterConfig → mint individuel
      // account: minter.account → signe avec le wallet minter
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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
        votingNFT.write.safeMintBatch(
          [[{ recipient: voter1.account.address, weight: 1n }]],
          { account: voter1.account }
        )
      );
    });

    it("devrait empêcher de mint un 2e NFT pour la même adresse", async function () {
      // Premier mint → OK
      await mintTo({ recipient: voter1.account.address, weight: 1n });
      // Deuxième mint pour la même adresse → doit revert
      await assert.rejects(
        votingNFT.write.safeMintBatch(
          [[{ recipient: voter1.account.address, weight: 1n }]],
          { account: minter.account }
        )
      );
    });

    it("devrait empêcher le transfert du NFT (soul-bound)", async function () {
      // Mint un NFT pour voter1
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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
      await mintTo({ recipient: voter1.account.address, weight: 1n });
      await votingNFT.write.burn([0n], { account: minter.account });

      // Re-mint → doit fonctionner, le voter retrouve son droit
      await mintTo({ recipient: voter1.account.address, weight: 1n });
      const hasRight = await votingNFT.read.hasVotingRight([
        voter1.account.address,
      ]);
      assert.equal(hasRight, true);
    });

    it("devrait empêcher safeTransferFrom (soul-bound)", async function () {
      await mintTo({ recipient: voter1.account.address, weight: 1n });
      await assert.rejects(
        votingNFT.write.safeTransferFrom(
          [voter1.account.address, voter2.account.address, 0n],
          { account: voter1.account }
        )
      );
    });

    it("devrait empêcher approve (soul-bound)", async function () {
      await mintTo({ recipient: voter1.account.address, weight: 1n });
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

  // ============================================================
  // ÉTAPE 8 — Mint en batch
  // ============================================================
  // Objectif : le minter peut mint plusieurs NFT en une transaction
  //
  // Concepts :
  //   safeMintBatch(VoterConfig[]) → mint un NFT pour chaque VoterConfig
  //   VoterConfig = { recipient: address, weight: uint256 }
  //   gas optimization → 1 transaction au lieu de N
  //   les mêmes règles s'appliquent (pas de doublon, onlyRole)
  // ============================================================
  describe("Mint batch", function () {
    it("devrait permettre au MINTER de mint en batch", async function () {
      await votingNFT.write.safeMintBatch(
        [[
          { recipient: voter1.account.address, weight: 1n },
          { recipient: voter2.account.address, weight: 1n },
        ]],
        { account: minter.account }
      );

      const balance1 = await votingNFT.read.balanceOf([voter1.account.address]);
      const balance2 = await votingNFT.read.balanceOf([voter2.account.address]);
      assert.equal(balance1, 1n);
      assert.equal(balance2, 1n);
    });

    it("devrait revert si une adresse du batch possède déjà un NFT", async function () {
      await mintTo({ recipient: voter1.account.address, weight: 1n });
      // voter1 a déjà un NFT → tout le batch doit revert
      await assert.rejects(
        votingNFT.write.safeMintBatch(
          [[
            { recipient: voter1.account.address, weight: 1n },
            { recipient: voter2.account.address, weight: 1n },
          ]],
          { account: minter.account }
        )
      );
    });

    it("devrait empêcher un non-MINTER de mint en batch", async function () {
      await assert.rejects(
        votingNFT.write.safeMintBatch(
          [[
            { recipient: voter1.account.address, weight: 1n },
            { recipient: voter2.account.address, weight: 1n },
          ]],
          { account: voter1.account }
        )
      );
    });

    it("devrait revert si le batch dépasse MAX_BATCH_SIZE", async function () {
      // Crée un tableau de 201 VoterConfig (au-dessus de la limite)
      const tooMany = Array.from({ length: 201 }, (_, i) => ({
        recipient: `0x${(i + 1).toString(16).padStart(40, "0")}`,
        weight: 1n,
      }));
      await assert.rejects(
        votingNFT.write.safeMintBatch([tooMany], {
          account: minter.account,
        })
      );
    });
  });

  // ============================================================
  // ÉTAPE 9 — Plafond de votants (maximumVoters)
  // ============================================================
  // Objectif : limiter le nombre de NFT mintables
  //
  // Concepts :
  //   maximumVoters → passé au constructor, fixe le plafond
  //   Le mint (simple et batch) doit refuser si le plafond est atteint
  //   _nextTokenId sert de compteur de NFT mintés (inclut les burn)
  //   → on a besoin d'un compteur de NFT actifs (non-burn)
  // ============================================================
  describe("Plafond de votants", function () {
    it("devrait stocker le nombre maximum de votants", async function () {
      const maximumVoters = await votingNFT.read.maximumVoters();
      assert.equal(maximumVoters, 5n);
    });

    it("devrait refuser le mint si le plafond est atteint", async function () {
      // On a déployé avec maximumVoters = 5
      // On mint 5 NFT (il faut 5 adresses distinctes)
      const connection = await network.connect();
      const { viem } = connection;
      const wallets = await viem.getWalletClients();
      for (let i = 0; i < 5; i++) {
        await mintTo({ recipient: wallets[i].account.address, weight: 1n });
      }
      // Le 6e doit revert
      await assert.rejects(
        votingNFT.write.safeMintBatch(
          [[{ recipient: wallets[5].account.address, weight: 1n }]],
          { account: minter.account }
        ),
        (error: any) => error.message.includes("Nombre maximum de votants atteint")
      );
    });

    it("devrait refuser le mint batch si le plafond serait dépassé", async function () {
      const connection = await network.connect();
      const { viem } = connection;
      const wallets = await viem.getWalletClients();
      // Mint 4 individuellement
      for (let i = 0; i < 4; i++) {
        await mintTo({ recipient: wallets[i].account.address, weight: 1n });
      }
      // Batch de 2 → dépasserait le plafond de 5
      await assert.rejects(
        votingNFT.write.safeMintBatch(
          [[
            { recipient: wallets[4].account.address, weight: 1n },
            { recipient: wallets[5].account.address, weight: 1n },
          ]],
          { account: minter.account }
        ),
        (error: any) => error.message.includes("Nombre maximum de votants atteint")
      );
    });

    it("devrait permettre de re-mint après un burn sans dépasser le plafond", async function () {
      const connection = await network.connect();
      const { viem } = connection;
      const wallets = await viem.getWalletClients();
      // Mint 5 NFT (plafond atteint)
      for (let i = 0; i < 5; i++) {
        await mintTo({ recipient: wallets[i].account.address, weight: 1n });
      }
      // Burn 1
      await votingNFT.write.burn([0n], { account: minter.account });
      // Re-mint → doit passer car on est redescendu à 4 actifs
      await mintTo({ recipient: wallets[5].account.address, weight: 1n });
      const hasRight = await votingNFT.read.hasVotingRight([wallets[5].account.address]);
      assert.equal(hasRight, true);
    });
  });

  // ============================================================
  // ÉTAPE 10 — Vote pondéré (poids du NFT)
  // ============================================================
  // Objectif : chaque NFT porte un poids de vote fixé au mint
  //
  // Concepts :
  //   VoterConfig = { recipient: address, weight: uint256 }
  //   _tokenWeight mapping → stocke le poids de chaque tokenId
  //   getVotingWeight(address) → retourne le poids du NFT d'un votant
  //   Le poids est >= 1 (un vote vaut au minimum 1)
  //   Le poids est immutable après le mint
  // ============================================================
  describe("Vote pondéré", function () {
    it("devrait stocker le poids du NFT au mint", async function () {
      // Mint un NFT de poids 3 pour voter1
      await mintTo({ recipient: voter1.account.address, weight: 3n });
      const weight = await votingNFT.read.getVotingWeight([
        voter1.account.address,
      ]);
      assert.equal(weight, 3n);
    });

    it("devrait retourner un poids de 1 pour un mint avec weight = 1", async function () {
      await mintTo({ recipient: voter1.account.address, weight: 1n });
      const weight = await votingNFT.read.getVotingWeight([
        voter1.account.address,
      ]);
      assert.equal(weight, 1n);
    });

    it("devrait retourner 0 pour une adresse sans NFT", async function () {
      const weight = await votingNFT.read.getVotingWeight([
        voter2.account.address,
      ]);
      assert.equal(weight, 0n);
    });

    it("devrait retourner 0 après un burn", async function () {
      await mintTo({ recipient: voter1.account.address, weight: 5n });
      await votingNFT.write.burn([0n], { account: minter.account });
      const weight = await votingNFT.read.getVotingWeight([
        voter1.account.address,
      ]);
      assert.equal(weight, 0n);
    });

    it("devrait revert si le poids est 0", async function () {
      // Un poids de 0 n'a pas de sens → revert
      await assert.rejects(
        votingNFT.write.safeMintBatch(
          [[{ recipient: voter1.account.address, weight: 0n }]],
          { account: minter.account }
        )
      );
    });

    it("devrait supporter des poids différents en batch", async function () {
      // voter1 → poids 2, voter2 → poids 5
      await votingNFT.write.safeMintBatch(
        [[
          { recipient: voter1.account.address, weight: 2n },
          { recipient: voter2.account.address, weight: 5n },
        ]],
        { account: minter.account }
      );
      const weight1 = await votingNFT.read.getVotingWeight([
        voter1.account.address,
      ]);
      const weight2 = await votingNFT.read.getVotingWeight([
        voter2.account.address,
      ]);
      assert.equal(weight1, 2n);
      assert.equal(weight2, 5n);
    });
  });
});