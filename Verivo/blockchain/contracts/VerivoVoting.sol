  // SPDX-License-Identifier: MIT
  pragma solidity 0.8.28;

  import "./VerivoVotingNFT.sol";

  /// @title VerivoVoting — Contrat de vote utilisant les NFT soul-bound
  /// @notice Gère la création d'élections et le processus de vote
  contract VerivoVoting {
      VerivoVotingNFT public votingNFT;

      constructor(address _votingNFT) {
          votingNFT = VerivoVotingNFT(_votingNFT);
      }
  }