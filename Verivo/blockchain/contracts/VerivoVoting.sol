// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./VerivoVotingNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title VerivoVoting — Un contrat par scrutin
/// @notice Gère un vote pondéré avec délai automatique utilisant les NFT soul-bound
/// @dev Hérite de Ownable (le déployeur Verivo est owner)
///      1 contrat = 1 scrutin, déployé par le backend pour chaque vote
///      L'organisationAdministrator gère le cycle de vie (open, close, tally)
///      Le délai automatique permet à n'importe qui de fermer après expiration
contract VerivoVoting is Ownable {

    /// @notice Les états possibles du scrutin
    /// @dev Draft=0, Open=1, Closed=2, Tallied=3
    ///      Le cycle de vie est linéaire : Draft → Open → Closed → Tallied
    enum Status { Draft, Open, Closed, Tallied }

    /// @notice Référence vers le contrat NFT soul-bound
    /// @dev Permet de vérifier qui possède un droit de vote via hasVotingRight()
    ///      et de récupérer le poids du vote via getVotingWeight()
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

    /// @notice Durée du scrutin en secondes (fixée au déploiement)
    /// @dev Ex: 7 heures = 7  * 60 * 60 = 25200
    ///      Passée au constructor, ne peut plus être modifiée
    uint256 public votingDuration;

    /// @notice Timestamp de l'ouverture du scrutin
    /// @dev Enregistré par openVoting() via block.timestamp
    ///      block.timestamp = horodatage du bloc courant (en secondes Unix)
    ///      Vaut 0 tant que le scrutin n'est pas ouvert
    uint256 public votingStartTime;

    /// @notice Événement émis lorsque le scrutin est ouvert
    /// @dev Le frontend écoute cet event pour mettre à jour l'interface
    event VotingOpened();

    /// @notice Indique si une adresse a déjà voté
    /// @dev mapping(adresse du votant => true s'il a voté)
    mapping(address => bool) public hasVoted;

    /// @notice Nombre de votes reçus par chaque choix
    /// @dev mapping(index du choix => nombre de votes)
    ///      Les votes sont pondérés : un vote de poids 3 ajoute 3 au compteur
    mapping(uint256 => uint256) public votesPerChoice;

    /// @notice Événement émis lorsqu'un vote est enregistré
    /// @param voter Adresse du votant
    /// @param choiceIndex Index du choix voté
    event VoteCast(address indexed voter, uint256 choiceIndex);

    /// @notice Événement émis lorsque le scrutin est fermé
    /// @dev Le frontend écoute cet event pour bloquer l'interface de vote
    event VotingClosed();

    /// @notice Index du choix gagnant après le dépouillement
    /// @dev N'a de valeur significative qu'après le tally (status == Tallied)
    uint256 public winningChoiceIndex;

    /// @notice Événement émis lorsque le scrutin est dépouillé
    /// @param winningChoiceIndex Index du choix gagnant
    event VotingTallied(uint256 winningChoiceIndex);


    /// @notice Vérifie que l'appelant est l'administrateur de l'organisation
    /// @dev Modifier custom réutilisable sur openVoting, tally...
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
    /// @param _votingDuration Durée du scrutin en secondes (ex: 25200 = 7 heures)
    /// @dev Ownable(msg.sender) → le déployeur (Verivo) devient owner
    ///      Les paramètres sont fixés au constructor → immutables après déploiement
    ///      La durée doit être > 0 sinon le scrutin serait immédiatement fermable
    constructor(
        address _votingNFT,
        address _organisationAdministrator,
        string memory _title,
        string[] memory _choices,
        uint256 _votingDuration
    ) Ownable(msg.sender) {
        require(_choices.length >= 1, "Minimum 1 choix requis");
        require(_votingDuration > 0, "La duree doit etre superieure a 0");
        votingNFT = VerivoVotingNFT(_votingNFT);
        organisationAdministrator = _organisationAdministrator;
        title = _title;
        choices = _choices;
        votingDuration = _votingDuration;
        status = Status.Draft;
    }

    /// @notice Ouvre le scrutin — passe le statut de Draft à Open
    /// @dev Seul l'organisationAdministrator peut appeler (modifier)
    ///      Le scrutin doit être en Draft sinon revert
    ///      Enregistre block.timestamp → sert de référence pour le délai
    ///      Émet VotingOpened pour notifier les listeners (frontend, indexeur)
    function openVoting() external onlyOrganisationAdministrator {
        require(status == Status.Draft, "Le scrutin n'est pas en brouillon");
        status = Status.Open;
        votingStartTime = block.timestamp;
        emit VotingOpened();
    }

    /// @notice Enregistre un vote pondéré pour un choix
    /// @param _choiceIndex Index du choix dans le tableau choices (0, 1, 2...)
    /// @dev Vérifie dans l'ordre :
    ///      1. Le scrutin est ouvert (status == Open)
    ///      2. Le votant possède un NFT (via hasVotingRight sur le contrat NFT)
    ///      3. Le votant n'a pas déjà voté (hasVoted == false)
    ///      4. L'index du choix est valide (< choices.length)
    ///      Le vote compte pour le poids du NFT du votant
    ///      Ex: NFT de poids 3 → votesPerChoice[choix] += 3
    ///      Émet VoteCast pour notifier les listeners
    function castVote(uint256 _choiceIndex) external {
        require(status == Status.Open, "Le scrutin n'est pas ouvert");
        require(votingNFT.hasVotingRight(msg.sender), "Vous n'avez pas le droit de vote");
        require(!hasVoted[msg.sender], "Vous avez deja vote");
        require(_choiceIndex < choices.length, "Choix invalide");
        hasVoted[msg.sender] = true;
        uint256 weight = votingNFT.getVotingWeight(msg.sender);
        votesPerChoice[_choiceIndex] += weight;
        emit VoteCast(msg.sender, _choiceIndex);
    }

    /// @notice Ferme le scrutin — soit par l'admin, soit par n'importe qui après le délai
    /// @dev Deux cas possibles :
    ///      1. L'admin org ferme quand il veut (même avant le délai)
    ///      2. N'importe qui peut fermer si le délai est expiré
    ///      → garantit que le scrutin ne reste pas ouvert indéfiniment
    ///      isAdmin → true si msg.sender est l'organisationAdministrator
    ///      isExpired → true si block.timestamp >= votingStartTime + votingDuration
    ///      Le require exige que l'un des deux soit vrai (|| = OU logique)
    ///      Émet VotingClosed pour notifier les listeners
    function closeVoting() external {
        require(status == Status.Open, "Le scrutin n'est pas ouvert");
        bool isAdmin = msg.sender == organisationAdministrator;
        bool isExpired = block.timestamp >= votingStartTime + votingDuration;
        require(isAdmin || isExpired, "Seul l'admin peut fermer avant la fin du delai");
        status = Status.Closed;
        emit VotingClosed();
    }

    /// @notice Dépouille le scrutin — détermine le choix gagnant
    /// @dev Seul l'organisationAdministrator peut appeler
    ///      Le scrutin doit être Closed sinon revert
    ///      Parcourt votesPerChoice pour trouver l'index avec le plus de votes
    ///      En cas d'égalité, le premier choix avec le score max l'emporte
    ///      Émet VotingTallied avec l'index gagnant
    function tallyVotes() external onlyOrganisationAdministrator {
        require(status == Status.Closed, "Le scrutin n'est pas ferme");
        uint256 winningVoteCount = 0;
        for (uint256 i = 0; i < choices.length; i++) {
            if (votesPerChoice[i] > winningVoteCount) {
                winningVoteCount = votesPerChoice[i];
                winningChoiceIndex = i;
            }
        }
        status = Status.Tallied;
        emit VotingTallied(winningChoiceIndex);
    }

    /// @notice Retourne la liste des choix du scrutin
    /// @return La liste des choix sous forme de tableau de strings en mémoire
    /// @dev external view → lecture seule, pas de gas en appel externe
    ///      Nécessaire car Solidity ne génère pas de getter pour les tableaux dynamiques
    function getChoices() external view returns (string[] memory) {
        return choices;
    }

    /// @notice Retourne le nom du choix gagnant
    /// @return Le string du choix ayant reçu le plus de votes
    /// @dev Accessible uniquement après le dépouillement (status == Tallied)
    ///      Utilise winningChoiceIndex pour indexer le tableau choices
    function getWinningChoice() external view returns (string memory) {
        require(status == Status.Tallied, "Le scrutin n'est pas encore depouille");
        return choices[winningChoiceIndex];
    }

    /// @notice Retourne le nombre de votes pour chaque choix
    /// @return Un tableau avec le score de chaque choix (même ordre que choices)
    /// @dev Accessible uniquement après le dépouillement (status == Tallied)
    ///      Les scores reflètent les poids : un vote de poids 3 = 3 dans le tableau
    ///      Construit un tableau en mémoire à partir du mapping votesPerChoice
    function getResults() external view returns (uint256[] memory) {
        require(status == Status.Tallied, "Le scrutin n'est pas encore depouille");
        uint256[] memory results = new uint256[](choices.length);
        for (uint256 i = 0; i < choices.length; i++) {
            results[i] = votesPerChoice[i];
        }
        return results;
    }
}