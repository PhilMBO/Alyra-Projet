// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./VerivoVotingNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title VerivoVoting — Un contrat par scrutin
/// @notice Gère un vote utilisant les NFT soul-bound
/// @dev Hérite de Ownable (le déployeur Verivo est owner)
///      1 contrat = 1 scrutin, déployé par le backend pour chaque vote
///      L'organisationAdministrator gère le cycle de vie (open, close, tally)
contract VerivoVoting is Ownable {

    /// @notice Les états possibles du scrutin
    /// @dev Draft=0, Open=1, Closed=2, Tallied=3
    ///      Le cycle de vie est linéaire : Draft → Open → Closed → Tallied
    enum Status { Draft, Open, Closed, Tallied }

    /// @notice Référence vers le contrat NFT soul-bound
    /// @dev Permet de vérifier qui possède un droit de vote via hasVotingRight()
    VerivoVotingNFT public votingNFT;

    /// @notice Adresse de l'administrateur de l'organisation
    /// @dev C'est lui qui gère le scrutin (ouvrir, fermer, dépouiller)
    ///      Distinct du owner (Verivo) qui déploie le contrat
    address public organisationAdministrator;

    /// @notice Titre du scrutin (ex: "Budget participatif 2026")
    string public title;

    /// @dev Liste des choix possibles — private car les tableaux dynamiques
    ///      n'ont pas de getter automatique, on expose via getChoices()
    string[] private choices;

    /// @notice Statut courant du scrutin
    /// @dev Initialisé à Draft au déploiement
    Status public status;

    /// @notice Événement émis lorsque le scrutin est ouvert
    /// @dev Le frontend écoute cet event pour mettre à jour l'interface
    event VotingOpened();

    /// @notice Vérifie que l'appelant est l'administrateur de l'organisation
    /// @dev Modifier custom réutilisable sur openVoting, closeVoting, tally...
    ///      Le "_;" indique où le corps de la fonction décorée s'exécute
    modifier onlyOrganisationAdministrator() {
        require(msg.sender == organisationAdministrator, "Seul l'administrateur de l'organisation peut effectuer cette action");
        _;
    }

    /// @notice Déploie un nouveau scrutin
    /// @param _votingNFT Adresse du contrat NFT soul-bound associé
    /// @param _organisationAdministrator Adresse de l'admin qui gèrera ce scrutin
    /// @param _title Titre du scrutin
    /// @param _choices Liste des choix proposés aux votants
    /// @dev Ownable(msg.sender) → le déployeur (Verivo) devient owner
    ///      Les paramètres sont fixés au constructor → immutables après déploiement
    constructor(
        address _votingNFT,
        address _organisationAdministrator,
        string memory _title,
        string[] memory _choices
    ) Ownable(msg.sender) {
        require(_choices.length >= 1, "Minimum 1 choix requis");
        votingNFT = VerivoVotingNFT(_votingNFT);
        organisationAdministrator = _organisationAdministrator;
        title = _title;
        choices = _choices;
        status = Status.Draft;
    }

    /// @notice Ouvre le scrutin — passe le statut de Draft à Open
    /// @dev Seul l'organisationAdministrator peut appeler (modifier)
    ///      Le scrutin doit être en Draft sinon revert
    ///      Émet VotingOpened pour notifier les listeners (frontend, indexeur)
    function openVoting() external onlyOrganisationAdministrator {
        require(status == Status.Draft, "Le scrutin n'est pas en brouillon");
        status = Status.Open;
        emit VotingOpened();
    }

    /// @notice Retourne la liste des choix du scrutin
    /// @return La liste des choix sous forme de tableau de strings en mémoire
    /// @dev external view → lecture seule, pas de gas en appel externe
    ///      Nécessaire car Solidity ne génère pas de getter pour les tableaux dynamiques
    function getChoices() external view returns (string[] memory) {
        return choices;
    }
}
