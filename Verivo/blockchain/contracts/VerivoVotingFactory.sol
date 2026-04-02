  // SPDX-License-Identifier: MIT
  pragma solidity 0.8.28;

  import "./VerivoVoting.sol";
  import "@openzeppelin/contracts/access/Ownable.sol";

  /// @title VerivoVotingFactory — Déploie et référence les scrutins
  /// @notice Centralise la création des contrats VerivoVoting
  /// @dev Hérite de Ownable → seul Verivo (owner) peut créer des scrutins
  ///      Stocke les adresses de tous les scrutins déployés
  ///      Le factory devient le owner de chaque VerivoVoting créé
  contract VerivoVotingFactory is Ownable {

      /// @notice Liste des adresses de tous les scrutins créés
      /// @dev Tableau dynamique, consultable via getVotings()
      address[] private votings;

      /// @notice Événement émis lorsqu'un nouveau scrutin est créé
      /// @param votingAddress Adresse du contrat VerivoVoting déployé
      /// @param title Titre du scrutin
      event VotingCreated(address indexed votingAddress, string title);

      /// @notice Déploie le factory
      /// @dev msg.sender (Verivo) devient le owner via Ownable
      constructor() Ownable(msg.sender) {}

      /// @notice Crée un nouveau scrutin
      /// @param _votingNFT Adresse du contrat NFT soul-bound associé
      /// @param _organisationAdministrator Adresse de l'admin qui gèrera ce scrutin
      /// @param _title Titre du scrutin
      /// @param _choices Liste des choix proposés aux votants
      /// @dev Déploie un VerivoVoting via new → le factory est msg.sender donc owner
      ///      Stocke l'adresse du scrutin et émet VotingCreated
      function createVoting(
          address _votingNFT,
          address _organisationAdministrator,
          string memory _title,
          string[] memory _choices
      ) external onlyOwner {
          VerivoVoting voting = new VerivoVoting(
              _votingNFT,
              _organisationAdministrator,
              _title,
              _choices
          );
          votings.push(address(voting));
          emit VotingCreated(address(voting), _title);
      }

      /// @notice Retourne la liste des adresses de tous les scrutins créés
      /// @return Tableau d'adresses des contrats VerivoVoting
      /// @dev external view → lecture seule, pas de gas
      function getVotings() external view returns (address[] memory) {
          return votings;
      }
  }