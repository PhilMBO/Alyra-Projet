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
        require(balanceOf(to) == 0, "Adresse possede deja un NFT de vote");
        _safeMint(to, _nextTokenId);
        _nextTokenId++;
    }
    /// @notice Bloque tout transfert — NFT soul-bound
    /// @dev _update est appelé par _safeMint ET transferFrom
    ///      Si from == address(0) → c'est un mint → on laisse passer
    ///      Sinon → c'est un transfert → on revert
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert("NFT soul-bound : transfert interdit");
        }
        return super._update(to, tokenId, auth);
    }
    // ====== Résolution du conflit ERC721 / AccessControl on utilise les deux fonctions supportsInterface== 
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
