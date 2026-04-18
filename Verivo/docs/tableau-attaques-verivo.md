# Tableau des attaques — Verivo (C4)

> Analyse des vecteurs d'attaque connus sur les smart contracts Verivo
> (`VerivoVoting.sol`, `VerivoVotingNFT.sol`, `VerivoVotingFactory.sol`)
> et leurs mitigations dans le code.

---

## 1. Reentrancy

### Definition

La **reentrancy** (re-entree) est une attaque ou un contrat malveillant
**appelle a nouveau une fonction du contrat cible avant que cette fonction ait
fini son execution**. Pendant ce second appel, l'etat de la victime n'a pas
encore ete mis a jour → l'attaquant peut exploiter cette fenetre pour repeter
l'operation.

**Analogie :** imagine un distributeur automatique qui envoie d'abord l'argent,
puis decremente ton solde. Si tu peux "reprendre" dans la fonction retrait
pendant qu'elle t'envoie l'argent, tu peux retirer plusieurs fois sans que ton
solde ne diminue. C'est exactement ce qu'a fait l'attaquant du **DAO Hack**
en 2016 (60M$ voles sur Ethereum).

**Sequence classique d'une attaque :**

```
1. Attaquant appelle withdraw()
2. withdraw() envoie l'ETH via call{value:...}()
3. Le contrat attaquant recoit l'ETH et son fallback() appelle a nouveau withdraw()
4. withdraw() re-envoie l'ETH (le solde n'est pas encore decremente)
5. ... la boucle continue jusqu'a epuisement du contrat
```

### Risque pour Verivo

Surface d'attaque **tres limitee** :

- `VerivoVoting.castVote()` ne fait **aucun transfer d'ETH** ni appel a un
  contrat externe controle par l'attaquant
- Il appelle uniquement `votingNFT.hasVotingRight()` et `getVotingWeight()` —
  deux **view functions** sur un contrat Verivo connu et audite
- `VerivoVotingNFT.safeMintBatch` utilise `_safeMint` d'OpenZeppelin qui fait
  un callback `onERC721Received()` sur le destinataire. Si le destinataire est
  un contrat malveillant, il pourrait theoriquement re-entrer

### Comment on s'en premunit

**Protection principale : pattern Checks-Effects-Interactions (CEI)** dans
`VerivoVoting.sol` :

```solidity
// contracts/VerivoVoting.sol, fonction castVote (ligne 139-148)
function castVote(uint256 _choiceIndex) external {
    // 1. CHECKS : toutes les verifications AVANT tout changement d'etat
    require(status == Status.Open, "Le scrutin n'est pas ouvert");
    require(votingNFT.hasVotingRight(msg.sender), "Vous n'avez pas le droit de vote");
    require(!hasVoted[msg.sender], "Vous avez deja vote");
    require(_choiceIndex < choices.length, "Choix invalide");

    // 2. EFFECTS : mise a jour de l'etat AVANT l'interaction externe
    hasVoted[msg.sender] = true;
    uint256 weight = votingNFT.getVotingWeight(msg.sender);
    votesPerChoice[_choiceIndex] += weight;

    // 3. INTERACTIONS : emit d'event (pas de call risque)
    emit VoteCast(msg.sender, _choiceIndex);
}
```

### Pourquoi ca marche

- **L'etat est mis a jour AVANT tout appel externe**. Meme si un contrat
  malveillant re-entre dans `castVote` durant `getVotingWeight`, le
  `require(!hasVoted[msg.sender])` echoue instantanement parce que
  `hasVoted[msg.sender] = true` a deja ete ecrit.
- **Aucun transfer d'ETH** dans Verivo → pas de callback natif exploitable.
- Pour `safeMintBatch`, le callback `onERC721Received` se declenche apres le mint,
  mais seul l'admin (role MINTER) peut l'appeler — un attaquant externe ne peut
  pas declencher ce mint.

---

## 2. Front-running

### Definition

Le **front-running** est une attaque ou un acteur privilege (mineur, validateur,
bot MEV) **observe les transactions en attente dans le mempool** et insere sa
propre transaction **avant** celle de la victime, en payant plus de gas prioritaire.

**Analogie :** imagine une vente aux encheres ou un traitre peut voir toutes
les enchieres futures en temps reel et placer la sienne juste avant pour gagner.

**Scenarios typiques :**

- Sur **Uniswap** : un bot voit une grosse vente arriver et vend avant pour
  faire baisser le prix, puis rachete plus bas (sandwich attack)
- Sur un **NFT drop** : un bot voit un mint populaire et paye plus cher pour
  etre premier
- Sur un **vote** : un attaquant voit un vote decisif arriver et vote
  strategiquement avant

### Risque pour Verivo

Risque **faible** mais reel pour un scrutin serre :

- Les votes sont publics en temps reel (events `VoteCast` + transactions visibles)
- Un attaquant pourrait "attendre" et voter seulement apres avoir vu les autres
  pour maximiser l'impact strategique
- Cependant, **il ne peut pas "voler"** de vote — il ne peut voter qu'avec son
  propre NFT

### Comment on s'en premunit

**Trois couches de defense** dans les contrats :

**1. Whitelist obligatoire via NFT soul-bound** (`VerivoVotingNFT.sol`) :

```solidity
// Seuls les wallets mintes peuvent voter
function hasVotingRight(address account) external view returns (bool) {
    return balanceOf(account) > 0;
}

// Dans VerivoVoting.castVote :
require(votingNFT.hasVotingRight(msg.sender), "Vous n'avez pas le droit de vote");
```

**2. NFT non-transferable** (`VerivoVotingNFT._update`) :

```solidity
function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    address from = _ownerOf(tokenId);
    // Autoriser mint (from == 0) et burn (to == 0), revert tout le reste
    if (from != address(0) && to != address(0)) {
        revert("NFT soul-bound : transfert interdit");
    }
    return super._update(to, tokenId, auth);
}
```

**3. Logique deterministe du tally** : le gagnant est calcule uniquement a
partir des compteurs finaux, independamment de l'ordre des votes.

### Pourquoi ca marche

- Un bot MEV ne peut **pas acheter un droit de vote a la volee** : les NFTs
  sont soul-bound, personne ne peut les lui vendre
- Meme si un bot observe les votes, **il ne peut voter qu'une seule fois** avec
  son propre NFT → il n'a pas d'avantage asymetrique
- L'ordre des transactions dans un bloc **n'influence pas** le resultat final
  (pas de "premier vote = gagnant"), donc le reordonnancement par un mineur
  est inutile

### Limite residuelle

Un votant legitime pourrait attendre strategiquement pour voter en dernier
(voir les autres puis decider). Ce n'est pas vraiment du front-running — c'est
le comportement normal d'un votant informe. Pour eliminer completement ce biais,
il faudrait un systeme de **commit-reveal** (commit d'un hash pendant le vote,
reveal apres cloture), mais la complexite ajoutee n'est pas justifiee pour
Verivo.

---

## 3. Double vote

### Definition

Le **double vote** est la tentative d'un votant de **faire compter son vote
plusieurs fois** pour amplifier son influence sur le resultat.

**Variantes d'attaque :**

- **Re-appel direct** : l'user appelle `castVote()` deux fois de suite
- **Multi-wallet** : l'user cree plusieurs wallets et vote depuis chacun
- **Transfer du NFT** : l'user vote, transfere son NFT a un deuxieme wallet,
  et vote a nouveau

### Risque pour Verivo

Direct et critique : **la crédibilité du scrutin repose entierement** sur le
principe "un inscrit = une voix".

### Comment on s'en premunit

**Triple protection** — trois verrous independants qui bloquent chaque variante :

**Verrou 1 : mapping `hasVoted` on-chain** (`VerivoVoting.sol`) :

```solidity
mapping(address => bool) public hasVoted;

function castVote(uint256 _choiceIndex) external {
    require(!hasVoted[msg.sender], "Vous avez deja vote");
    hasVoted[msg.sender] = true;
    // ...
}
```
→ Empeche le **re-appel direct** : un second `castVote` depuis la meme adresse
revert instantanement.

**Verrou 2 : un seul NFT par adresse** (`VerivoVotingNFT._mintVotingNFT`) :

```solidity
function _mintVotingNFT(address to, uint256 weight) internal {
    require(balanceOf(to) == 0, "Adresse possede deja un NFT de vote");
    require(weight >= 1, "Le poids doit etre au minimum 1");
    _safeMint(to, _nextTokenId);
    // ...
}
```
→ Empeche **l'accumulation de poids** : un admin ne peut pas accidentellement
(ou maliciusement) minter deux NFT a la meme adresse.

**Verrou 3 : NFT soul-bound (non-transferable)** (`VerivoVotingNFT._update`) :

```solidity
function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    address from = _ownerOf(tokenId);
    if (from != address(0) && to != address(0)) {
        revert("NFT soul-bound : transfert interdit");
    }
    return super._update(to, tokenId, auth);
}

function approve(address, uint256) public pure override {
    revert("NFT soul-bound : approve interdit");
}

function setApprovalForAll(address, bool) public pure override {
    revert("NFT soul-bound : approve interdit");
}
```
→ Empeche l'astuce **"vote puis transfer"** : meme si l'user cree un nouveau
wallet, il ne peut pas y transferer son NFT.

### Pourquoi ca marche

Les trois verrous sont **independants** :
- Meme si `hasVoted` etait bypass (impossible en Solidity strict), le NFT
  unique limiterait l'impact
- Meme si l'user possedait plusieurs NFT, ils seraient soul-bound et ne
  viendraient pas d'un transfer illegal

Contre la **multi-wallet** (creer plusieurs wallets et les faire inscrire
chacun) : cette defense est **organisationnelle** (l'admin valide la liste
d'inscrits), pas technique. C'est la limite du modele "1 inscrit = 1 voix"
sur blockchain.

---

## 4. DoS par gas limit (batch mint)

### Definition

Un **Denial of Service (DoS) par gas limit** est une attaque ou l'appelant
fait appel a une fonction qui **consomme plus de gas que la limite d'un bloc
Ethereum** (~30M gas). La transaction revert systematiquement → la fonction
devient **inutilisable**.

**Exemples classiques :**

- Une boucle non bornee sur un tableau de 10 000 elements
- Une fonction qui envoie de l'ETH a N adresses dont une refuse la reception
  (la boucle entiere revert)

**Impact :** le contrat devient paralyse sur cette fonctionnalite, meme pour
les operations legitimes.

### Risque pour Verivo

Vecteur identifie sur `safeMintBatch` :

- Un admin qui veut minter 5 000 NFT d'un coup ferait exploser le gas
- La transaction revert → impossible de distribuer les droits de vote
  → scrutin bloque avant meme son ouverture

### Comment on s'en premunit

**Limite stricte au niveau du contrat** (`VerivoVotingNFT.sol`) :

```solidity
/// @notice Taille maximale d'un batch de mint en une transaction
/// @dev Limite le gas consomme pour eviter de depasser le block gas limit
uint256 public constant MAX_BATCH_SIZE = 200;

/// @notice Nombre maximum de votants autorises pour ce scrutin
uint256 public maximumVoters;

function safeMintBatch(VoterConfig[] calldata voters) external onlyRole(MINTER_ROLE) {
    require(voters.length <= MAX_BATCH_SIZE, "Batch trop grand");
    require(_activeTokenCount + voters.length <= maximumVoters, "Nombre maximum de votants atteint");
    for (uint256 i = 0; i < voters.length; i++) {
        _mintVotingNFT(voters[i].recipient, voters[i].weight);
    }
}
```

**Calcul de securite :**

| Operation | Gas approximatif |
|---|---|
| 1 mint ERC721 (`_safeMint` + `_tokenWeight` + `_activeTokenCount++`) | ~60 000 gas |
| Batch de 200 NFT | ~12 000 000 gas |
| Marge sur un block de 30M | 60% reste libre |

### Pourquoi ca marche

- Le `require(voters.length <= MAX_BATCH_SIZE)` est une **pure check
  arithmetique en prealable** : il revert avant meme d'entrer dans la boucle,
  donc consomme < 30k gas → pas de DoS possible
- Pour inscrire 1 000 votants, l'admin fait **5 appels sequentiels** de 200 max
  → chaque tx reste dans les limites de gas
- Cote backend, `lib/deployment.js` peut iterer automatiquement sur les batches
  sans intervention manuelle

### Limite residuelle

Un admin distrait pourrait appeler `safeMintBatch` avec 201 adresses et voir
la tx revert. Impact : frustration, pas d'argent perdu (revert = gas rembourse
partiellement). Facile a diagnostiquer via le message d'erreur.

---

## 5. Timestamp manipulation (delai auto-close)

### Definition

Les **mineurs et validateurs** ont une influence limitee sur le timestamp
inscrit dans un bloc Ethereum. Specifiquement :

- Ils peuvent **retarder** legerement (attendre pour publier)
- Ils peuvent **avancer** dans une fenetre de `+15 secondes` par rapport au
  block precedent (sur Ethereum ; ~2s sur Polygon)
- Mais ils **ne peuvent pas sauter dans le passe** ni tricher enormement

Un attaquant collaborant avec un mineur complice pourrait tenter d'**influencer
des decisions basees sur `block.timestamp`** a hauteur de cette derive.

**Exemples d'usages risques :**

- Un tirage aleatoire qui utilise `block.timestamp` comme seed
- Une fenetre de vente/enchere qui ferme precisement a un timestamp

### Risque pour Verivo

Identifie sur la fermeture automatique du scrutin (`closeVoting`) :

- Un mineur pourrait avancer le timestamp de 15s pour **fermer 15s en avance**
  (empecher un vote de dernier instant) ou **retarder** (permettre un vote
  apres l'heure de fin officielle)

### Comment on s'en premunit

**Impact borne par les echelles de temps** dans `VerivoVoting.sol` :

```solidity
uint256 public votingDuration;    // En secondes, fixe au constructor
uint256 public votingStartTime;   // Enregistre par openVoting()

function closeVoting() external {
    require(status == Status.Open, "Le scrutin n'est pas ouvert");
    bool isAdmin = msg.sender == organisationAdministrator;
    bool isExpired = block.timestamp >= votingStartTime + votingDuration;
    require(isAdmin || isExpired, "Seul l'admin peut fermer avant la fin du delai");
    status = Status.Closed;
    emit VotingClosed();
}
```

**Design hybride** :

- **L'admin** peut fermer a tout moment, sans dependance au timestamp
- **N'importe qui** peut fermer uniquement apres expiration
  (`votingStartTime + votingDuration`)

### Pourquoi ca marche

**1. Echelle de temps >> derive mineur**

Verivo utilise des durees de scrutin de **plusieurs heures a plusieurs jours**
(`votingDuration` typique = 7 heures a 7 jours, soit `25200s` a `604800s`).
La derive potentielle d'un mineur (15s) represente **moins de 0,006%** de la
duree totale d'un vote de 7 heures → impact negligeable.

**2. Pas d'incitation financiere**

Un mineur n'a aucun interet financier a fermer un scrutin 15s en avance ou
en retard. Il ne gagne rien, au contraire il depense du gas pour envoyer la tx.

**3. Apres close, plus de vote possible**

```solidity
require(status == Status.Open, "Le scrutin n'est pas ouvert");
```

Meme si un mineur retarde la close de 15s, les votes arrives dans cette fenetre
sont valides (le scrutin etait encore ouvert). Ce n'est pas une fraude mais
une **extension marginale** du delai.

### Alternative rejetee

Certains protocoles utilisent des **oracles de temps** (Chainlink Time Feeds)
pour eviter la dependance a `block.timestamp`. Pour Verivo, c'est **overkill** :
la complexite ajoutee (cout, latence) depasse largement le risque d'une derive
de 15s sur un scrutin de plusieurs heures.

---

## 6. Unauthorized minting

### Definition

Le **mint non autorise** est une attaque ou un acteur **appelle directement
une fonction de creation de token** (NFT ou ERC-20) qui devrait etre reservee
a des roles privileges.

**Impact sur un systeme de vote :**

- L'attaquant se mint lui-meme des droits de vote → **vote massif illegitime**
- L'attaquant mint des droits a ses complices → **manipulation du resultat**
- Ou encore, il peut creer de fausses identites pour **noyer les vrais votants**

### Risque pour Verivo

**Direct et critique** : si un attaquant peut appeler `safeMintBatch` librement,
il peut s'accorder un poids de vote enorme et manipuler n'importe quel scrutin.

### Comment on s'en premunit

**1. AccessControl OpenZeppelin avec role MINTER_ROLE** (`VerivoVotingNFT.sol`) :

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract VerivoVotingNFT is ERC721, AccessControl {
    /// @notice Role autorisant le mint et le burn des NFT de vote
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function safeMintBatch(VoterConfig[] calldata voters) external onlyRole(MINTER_ROLE) {
        require(voters.length <= MAX_BATCH_SIZE, "Batch trop grand");
        // ...
    }

    function burn(uint256 tokenId) external onlyRole(MINTER_ROLE) {
        _burn(tokenId);
        _activeTokenCount--;
    }
}
```

**2. Assignation controlee du role au deploiement** :

```solidity
constructor(address minter, uint256 _maximumVoters) ERC721("VerivoVotingNFT", "VVOTE") {
    // msg.sender = Verivo (operateur qui deploie) → peut gerer les roles
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    // minter = wallet admin de l'organisation → seul habilite a mint
    _grantRole(MINTER_ROLE, minter);
    maximumVoters = _maximumVoters;
}
```

**3. Plafond global infranchissable** :

```solidity
require(_activeTokenCount + voters.length <= maximumVoters, "Nombre maximum de votants atteint");
```

Meme un admin malhonnete ne peut pas mint au-dela du plafond fixe a la creation
du scrutin.

**4. Pattern "grant → mint → revoke" cote backend** (`backend/src/lib/deployment.js`) :

Lors du deploiement via Verivo, le backend s'accorde temporairement le
MINTER_ROLE pour batch mint tous les votants, puis le retire immediatement :

```javascript
// 1. Grant MINTER_ROLE a Verivo operator (possible car il a DEFAULT_ADMIN_ROLE)
await walletClient.writeContract({
    abi: votingNftArtifact.abi,
    functionName: "grantRole",
    args: [MINTER_ROLE, operatorAccount.address],
});

// 2. Mint les NFTs
await walletClient.writeContract({
    abi: votingNftArtifact.abi,
    functionName: "safeMintBatch",
    args: [voterConfigs],
});

// 3. Revoke MINTER_ROLE immediatement
await walletClient.writeContract({
    abi: votingNftArtifact.abi,
    functionName: "revokeRole",
    args: [MINTER_ROLE, operatorAccount.address],
});
```

→ Apres le deploiement, seul l'admin de l'organisation a MINTER_ROLE. Meme si
la cle operateur Verivo etait compromise plus tard, elle ne pourrait plus mint.

### Pourquoi ca marche

- **`onlyRole(MINTER_ROLE)` revert** tout appel d'un compte non habilite.
  OpenZeppelin `AccessControl` est **standard, largement audite**, utilise
  par des milliers de projets.
- **Le pattern grant/revoke** limite dans le temps le pouvoir de mint de Verivo
  → reduction drastique de la **surface d'attaque** (si la cle fuite plus
  tard, elle est inutile).
- **L'admin organisationnel** reste seul detenteur du MINTER_ROLE apres deploy
  → un seul point de confiance, identifie et responsable.

### Limite residuelle

Si l'admin org lui-meme est malveillant, il peut mint abusivement pour ses
propres wallets. **Mitigation organisationnelle uniquement** (choix des
admins), pas technique. Les events `Transfer` emis par ERC721 permettent
d'auditer a posteriori tous les mints effectues.

---

## Synthese

| Attaque | Severite | Mitigation principale | Code cle |
|---|---|---|---|
| Reentrancy | Faible | Pattern Checks-Effects-Interactions | `castVote` met `hasVoted = true` avant tout |
| Front-running | Faible | Whitelist + 1 NFT soul-bound par adresse | `_update` revert sur transfer |
| Double vote | Moyenne | Triple protection `hasVoted` + `balanceOf==0` + soul-bound | `require(!hasVoted)` + `require(balanceOf==0)` |
| DoS gas limit | Moyenne | Constante `MAX_BATCH_SIZE = 200` | `require(voters.length <= MAX_BATCH_SIZE)` |
| Timestamp manipulation | Faible | Echelle heures/jours >> derive 15s mineur | `isAdmin || isExpired` |
| Unauthorized minting | Haute | `AccessControl.MINTER_ROLE` + grant/revoke temporaire | `onlyRole(MINTER_ROLE)` |

**Conclusion :** Verivo adresse les attaques classiques via des patterns
reconnus (OpenZeppelin AccessControl, ERC721 soul-bound, Checks-Effects-Interactions).
Les risques techniques sont tous borne. Les risques residuels sont
**organisationnels** (choix des admins, processus d'inscription des votants)
plutot que techniques — ils sortent du perimetre des smart contracts.
