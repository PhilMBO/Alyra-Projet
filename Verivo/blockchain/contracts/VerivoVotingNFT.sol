// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title VerivoVotingNFT — NFT soul-bound matérialisant un droit de vote
/// @notice Chaque NFT = 1 droit de vote pour 1 adresse. Non-transférable.
/// @dev Hérite de ERC721 (standard NFT) et AccessControl (gestion des rôles)
///      Soul-bound = les transferts et les approvals sont bloqués
contract VerivoVotingNFT is ERC721, AccessControl {

    // ====================================================================
    // Rôles
    // ====================================================================
    // MINTER_ROLE  → l'admin de l'organisation, peut mint et burn les NFT
    // DEFAULT_ADMIN_ROLE → l'adresse Verivo, peut gérer les rôles
    // ====================================================================

    /// @notice Rôle autorisant le mint et le burn des NFT de vote
    /// @dev keccak256 produit un hash unique à partir du string "MINTER_ROLE"
    ///      → utilisé comme identifiant de rôle par AccessControl
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Compteur auto-incrémenté pour attribuer un tokenId unique à chaque NFT
    ///      Ne décrémente jamais, même après un burn → garantit l'unicité des IDs
    uint256 private _nextTokenId;

    /// @notice Taille maximale d'un batch de mint en une transaction
    /// @dev Limite le gas consommé pour éviter de dépasser le block gas limit
    uint256 public constant MAX_BATCH_SIZE = 200;

    /// @notice Nombre maximum de votants autorisés pour ce scrutin
    /// @dev Fixé au déploiement, empêche l'admin de minter au-delà du plafond
    uint256 public maximumVoters;

    /// @dev Compteur de NFT actuellement en circulation (mint - burn)
    ///      Utilisé pour vérifier le plafond maximumVoters
    uint256 private _activeTokenCount;

    /// @notice Déploie le contrat NFT de vote
    /// @param minter Adresse qui recevra le MINTER_ROLE (admin organisation)
    /// @param _maximumVoters Nombre maximum de NFT mintables (plafond de votants)
    /// @dev msg.sender reçoit DEFAULT_ADMIN_ROLE → peut gérer tous les rôles
    ///      ERC721("VerivoVotingNFT", "VVOTE") → nom et symbole du token
    constructor(address minter, uint256 _maximumVoters) ERC721("VerivoVotingNFT", "VVOTE") {
       _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
       _grantRole(MINTER_ROLE, minter);
       maximumVoters = _maximumVoters;
    }

    /// @notice Mint un NFT de vote pour une adresse
    /// @param to Adresse qui recevra le NFT
    /// @dev internal → appelée uniquement par safeMintBatch, pas directement par l'extérieur
    ///      Vérifie que l'adresse n'a pas déjà un NFT (1 NFT = 1 vote)
    ///      _safeMint (ERC721) vérifie que le destinataire peut recevoir un ERC721
    function _mintVotingNFT(address to) internal {
        require(balanceOf(to) == 0, "Adresse possede deja un NFT de vote");
        _safeMint(to, _nextTokenId);
        _activeTokenCount++;
        _nextTokenId++;
    }

    /// @notice Mint un NFT de vote pour chaque adresse du tableau
    /// @param recipients Liste des adresses qui recevront un NFT
    /// @dev Seul point d'entrée public pour le mint
    ///      Vérifie la taille du batch, le plafond global, puis délègue à _mintVotingNFT
    ///      Atomique : si une adresse échoue, tout le batch revert
    ///      Pour un mint individuel → passer un tableau d'une seule adresse
    function safeMintBatch(address[] calldata recipients) external onlyRole(MINTER_ROLE) {
        require(recipients.length <= MAX_BATCH_SIZE, "Batch trop grand");
        require(_activeTokenCount + recipients.length <= maximumVoters, "Nombre maximum de votants atteint");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mintVotingNFT(recipients[i]);
        }
    }

    /// @notice Brûle un NFT de vote — révoque le droit de vote
    /// @param tokenId L'id du NFT à brûler
    /// @dev Décrémente _activeTokenCount → libère une place sous le plafond
    ///      Permet de re-minter pour une autre adresse ensuite
    function burn(uint256 tokenId) external onlyRole(MINTER_ROLE) {
        _burn(tokenId);
        _activeTokenCount--;
    }

    /// @notice Vérifie si une adresse possède un droit de vote
    /// @param account L'adresse à vérifier
    /// @return true si l'adresse possède au moins un NFT de vote
    /// @dev Appelée par le contrat VerivoVoting pour valider un votant
    function hasVotingRight(address account) external view returns (bool) {
        return balanceOf(account) > 0;
    }

    /// @notice Bloque tout transfert — NFT soul-bound
    /// @param to Adresse destinataire
    /// @param tokenId ID du token concerné
    /// @param auth Adresse autorisée (utilisée par ERC721 en interne)
    /// @return L'adresse précédente du propriétaire (retour requis par ERC721)
    /// @dev _update est le hook interne appelé par _safeMint ET transferFrom
    ///      from == address(0) → c'est un mint → on laisse passer
    ///      to == address(0) → c'est un burn → on laisse passer
    ///      Sinon → c'est un transfert → on revert
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("NFT soul-bound : transfert interdit");
        }
        return super._update(to, tokenId, auth);
    }

    /// @notice Bloque approve — NFT soul-bound, pas de délégation
    /// @dev approve permettrait à un tiers de transférer le NFT → interdit
    function approve(address, uint256) public pure override {
        revert("NFT soul-bound : approve interdit");
    }

    /// @notice Bloque setApprovalForAll — NFT soul-bound
    /// @dev setApprovalForAll permettrait à un opérateur de gérer tous les NFT → interdit
    function setApprovalForAll(address, bool) public pure override {
        revert("NFT soul-bound : approve interdit");
    }

    /// @notice Résout le conflit d'héritage entre ERC721 et AccessControl
    /// @param interfaceId L'identifiant de l'interface à vérifier (ERC165)
    /// @return true si le contrat implémente l'interface demandée
    /// @dev Les deux parents (ERC721, AccessControl) implémentent supportsInterface
    ///      Solidity exige un override explicite quand deux parents ont la même fonction
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
