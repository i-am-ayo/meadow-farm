// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice Test token. Only the immutable game contract can issue or settle it.
contract MeadowTOM is ERC20 {
    address public immutable game;
    error OnlyGame();
    constructor() ERC20("Meadow TOM Test Token", "TOM") { game = msg.sender; }
    modifier onlyGame() { if (msg.sender != game) revert OnlyGame(); _; }
    function issue(address to,uint256 amount) external onlyGame { _mint(to,amount); }
    function spend(address from,uint256 amount) external onlyGame { _burn(from,amount); }
    function settle(address from,address to,uint256 amount) external onlyGame { _transfer(from,to,amount); }
}

/// @notice Sepolia game assets, TOM settlement and capped signed stage rewards.
/// Simulation stays off-chain. A separate verifier replays the game trace and
/// signs a wallet/chain/attempt-bound voucher; the client cannot mint rewards.
contract MeadowFarm is ERC721Enumerable, EIP712, ReentrancyGuard {
    using Strings for uint256;
    MeadowTOM public immutable tom;
    address public immutable rewardSigner;
    uint256 public constant MODEL_COUNT=22;
    uint256 public totalMinted;
    uint256[22] public modelPrices;
    mapping(uint256=>uint8) public modelOf;
    mapping(uint256=>uint256) public listingPrice;
    mapping(address=>bool) public faucetClaimed;
    mapping(address=>mapping(uint64=>uint8)) public claimedStages;
    mapping(address=>uint8) public claimedQuestMask;
    mapping(address=>mapping(bytes32=>bool)) public rewardedRounds;
    mapping(address=>bytes32) public careerHash;
    struct Attempt { uint64 day; uint64 startedAt; uint64 endsAt; uint64 nonce; uint8 stage; bytes32 roundId; }
    mapping(address=>Attempt) public attempts;
    struct Reward { address player; uint64 day; uint8 stage; uint64 nonce; uint8 bonusMask; uint64 completedAt; bytes32 roundId; bytes32 careerHash; }
    bytes32 public constant REWARD_TYPEHASH=keccak256("Reward(address player,uint64 day,uint8 stage,uint64 nonce,uint8 bonusMask,uint64 completedAt,bytes32 roundId,bytes32 careerHash)");
    uint16[5] private windows=[300,420,540,660,900];
    uint16[5] private payouts=[24,32,44,60,80];
    error InvalidModel(); error InvalidPrice(); error NotOwner(); error NotForSale(); error OwnListing();
    error AlreadyClaimed(); error InvalidAttempt(); error InvalidReward(); error DayEnding();
    event BuildingPurchased(address indexed player,uint256 indexed tokenId,uint8 indexed model,uint256 tomPaid);
    event Listed(address indexed seller,uint256 indexed tokenId,uint256 price);
    event Sold(address indexed seller,address indexed buyer,uint256 indexed tokenId,uint256 price);
    event ChallengeStarted(address indexed player,uint64 indexed nonce,uint8 stage,uint64 day,bytes32 roundId);
    event RewardClaimed(address indexed player,uint64 indexed day,uint8 stage,uint256 amount,uint8 bonusMask);
    constructor(address verifier,uint256[22] memory prices) ERC721("Meadow Farm Buildings","MFB") EIP712("Meadow Farm","1") {
        require(verifier!=address(0),"verifier");rewardSigner=verifier;tom=new MeadowTOM();
        for(uint256 i;i<22;i++){require(prices[i]>0&&prices[i]<=1000000 ether,"price");modelPrices[i]=prices[i];}
    }
    function dayNow() public view returns(uint64){return uint64((block.timestamp+8 hours)/1 days);}
    function faucet() external nonReentrant {
        if(faucetClaimed[msg.sender])revert AlreadyClaimed();faucetClaimed[msg.sender]=true;tom.issue(msg.sender,200 ether);
    }
    function buyBuilding(uint8 model,uint256 expectedPrice) external nonReentrant returns(uint256 id){
        if(model>=22)revert InvalidModel();uint256 price=modelPrices[model];if(price!=expectedPrice)revert InvalidPrice();
        tom.spend(msg.sender,price);id=++totalMinted;modelOf[id]=model;_safeMint(msg.sender,id);emit BuildingPurchased(msg.sender,id,model,price);
    }
    function list(uint256 id,uint256 price) external {
        if(ownerOf(id)!=msg.sender)revert NotOwner();if(price==0||price>1000000 ether||price%1 ether!=0)revert InvalidPrice();
        listingPrice[id]=price;emit Listed(msg.sender,id,price);
    }
    function cancelListing(uint256 id) external {
        if(ownerOf(id)!=msg.sender)revert NotOwner();delete listingPrice[id];emit Listed(msg.sender,id,0);
    }
    function buyListing(uint256 id,uint256 expectedPrice) external nonReentrant {
        address seller=ownerOf(id);uint256 price=listingPrice[id];if(price==0)revert NotForSale();if(price!=expectedPrice)revert InvalidPrice();if(seller==msg.sender)revert OwnListing();
        delete listingPrice[id];tom.settle(msg.sender,seller,price);_safeTransfer(seller,msg.sender,id);emit Sold(seller,msg.sender,id,price);
    }
    function _update(address to,uint256 id,address auth) internal override returns(address from){
        delete listingPrice[id];return super._update(to,id,auth);
    }
    function beginChallenge(bytes32 roundId) external {
        uint64 day=dayNow();uint8 stage=claimedStages[msg.sender][day]+1;
        if(stage>5||roundId==bytes32(0)||rewardedRounds[msg.sender][roundId])revert InvalidAttempt();
        if(block.timestamp+windows[stage-1]>(uint256(day)+1)*1 days-8 hours)revert DayEnding();
        uint64 nonce=attempts[msg.sender].nonce+1;
        attempts[msg.sender]=Attempt(day,uint64(block.timestamp),uint64(block.timestamp+windows[stage-1]),nonce,stage,roundId);
        emit ChallengeStarted(msg.sender,nonce,stage,day,roundId);
    }
    function claimReward(Reward calldata r,bytes calldata signature) external nonReentrant {
        Attempt memory a=attempts[msg.sender];
        if(r.player!=msg.sender||r.day!=dayNow()||r.day!=a.day||r.stage!=a.stage||r.nonce!=a.nonce||r.roundId!=a.roundId||r.completedAt<a.startedAt||r.completedAt>a.endsAt||r.completedAt>block.timestamp||r.stage!=claimedStages[msg.sender][r.day]+1||rewardedRounds[msg.sender][r.roundId])revert InvalidAttempt();
        if(r.bonusMask>7||(claimedQuestMask[msg.sender]&r.bonusMask)!=0)revert InvalidReward();
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(REWARD_TYPEHASH,r.player,r.day,r.stage,r.nonce,r.bonusMask,r.completedAt,r.roundId,r.careerHash)));
        if(ECDSA.recover(digest,signature)!=rewardSigner)revert InvalidReward();
        uint256 amount=payouts[r.stage-1];if((r.bonusMask&1)!=0)amount+=8;if((r.bonusMask&2)!=0)amount+=12;if((r.bonusMask&4)!=0)amount+=20;
        claimedStages[msg.sender][r.day]=r.stage;claimedQuestMask[msg.sender]|=r.bonusMask;rewardedRounds[msg.sender][r.roundId]=true;careerHash[msg.sender]=r.careerHash;
        tom.issue(msg.sender,amount*1 ether);emit RewardClaimed(msg.sender,r.day,r.stage,amount,r.bonusMask);
    }
    function ownedAssets(address player) external view returns(uint256[] memory ids,uint8[] memory models,uint256[] memory prices){
        uint256 count=balanceOf(player);ids=new uint256[](count);models=new uint8[](count);prices=new uint256[](count);
        for(uint256 i;i<count;i++){uint256 id=tokenOfOwnerByIndex(player,i);ids[i]=id;models[i]=modelOf[id];prices[i]=listingPrice[id];}
    }
    function listings(uint256 offset,uint256 limit) external view returns(uint256[] memory ids,address[] memory owners,uint8[] memory models,uint256[] memory prices){
        if(limit>100)limit=100;uint256 end=offset+limit;if(end>totalMinted)end=totalMinted;uint256 count;
        for(uint256 id=offset+1;id<=end;id++)if(listingPrice[id]>0)count++;
        ids=new uint256[](count);owners=new address[](count);models=new uint8[](count);prices=new uint256[](count);uint256 n;
        for(uint256 id=offset+1;id<=end;id++)if(listingPrice[id]>0){ids[n]=id;owners[n]=ownerOf(id);models[n]=modelOf[id];prices[n++]=listingPrice[id];}
    }
    function tokenURI(uint256 id) public view override returns(string memory){
        _requireOwned(id);string memory n=id.toString();string memory m=uint256(modelOf[id]).toString();
        string memory svg=string.concat('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="32" fill="#e0ebd2"/><path d="M70 230 200 150 330 230 200 310Z" fill="#87aa6b"/><path d="M145 230v-70l55-35 55 35v70l-55 35Z" fill="#448f83"/><path d="m130 165 70-55 70 55-70 45Z" fill="#f3d387"/><text x="200" y="340" text-anchor="middle" font-size="22" fill="#315b43">MEADOW FARM #',n,'</text></svg>');
        return string.concat('data:application/json;base64,',Base64.encode(bytes(string.concat('{"name":"Meadow Farm Building #',n,'","description":"Sepolia testnet production building. Model indexes match the public game catalog.","attributes":[{"trait_type":"Model index","value":',m,'}],"image":"data:image/svg+xml;base64,',Base64.encode(bytes(svg)),'"}'))));
    }
}
