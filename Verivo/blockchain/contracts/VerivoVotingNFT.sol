// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
/// @title VerivoVotingNFT — NFT soul-bound matérialisant un droit de vote
/// @notice Chaque NFT = 1 droit de vote pour 1 adresse. Non-transférable.
contract VerivoVotingNFT is ERC721, AccessControl {
    //================Rôles ===========================
    // ------------ MINTER_ROLE : admin organisation -------
    // ----------- DEFAULT_ADMIN_ROLE : addresse Verivo admin -----
    // ====================================================================
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId;
    constructor(address minter) ERC721("VerivoVotingNFT", "VVOTE") {
       _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
       _grantRole(MINTER_ROLE, minter);
    }
    /// @notice Mint un NFT de vote pour une adresse
    /// @param to Adresse qui recevra le NFT
    function safeMint(address to) external onlyRole(MINTER_ROLE) {
        _safeMint(to, _nextTokenId);
        _nextTokenId++;
    }
    // ====== Résolution du conflit ERC721 / AccessControl on utilise les deux fonctions supportsInterface== 
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
