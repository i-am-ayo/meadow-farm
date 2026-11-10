import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,ORDINARY_MODELS,normalizeState,startDelivery,newFarmAccount,buildOrdinary,placeAsset,mint,purchase,modelFor,ownerFor,productionInfo,tick,capacity,startDailyChallenge,restartFarm,upgradeRoundEconomy,claimReward,claimQuest,QUESTS,challengeView} from '../dist/rules.mjs';
import {beginChallenge,recordChallengeProduction,recordChallengeDelivery,claimDailyReward} from '../dist/daily-challenge.mjs';
const BASE=Date.parse('2030-05-12T10:00:00+08:00');
function finish(s,now=BASE+10000){const id=s.daily.challenge.id;recordChallengeProduction(s,{bread:6},id,now);for(let n=0;n<3;n++)recordChallengeDelivery(s,{challengeId:id},'bread',3,now)}
function buildLine(s){
 for(const [type,x,y]of[['barn',3,7],['well',2,7],['mill',7,3],['bakery',7,6],['wheat',3,4],['road',7,8],['road',6,8],['road',6,7],['road',6,6],['road',6,5],['road',6,4],['road',6,3],['road',5,5],['road',4,5],['road',3,5],['road',3,6],['road',2,6]])assert.ok(buildOrdinary(s,type,x,y),`${type} ${x},${y}`);
}
test('a fresh round has no free production facilities, stocks or roads, and every ordinary family has a cash price',()=>{
 const s=newFarmAccount('A',BASE);assert.equal(s.cash,3000);assert.equal(s.assets.length,0);assert.equal(s.roads.length,0);assert.deepEqual(s.buildings.map(b=>b.type),['trade','house']);
 for(const k of ['wheat','flour','bread','milk','cake','water','energy'])assert.equal(s[k],0);
 const before=s.token;assert.ok(buildOrdinary(s,'well',2,7));assert.ok(buildOrdinary(s,'solar',5,7));assert.ok(buildOrdinary(s,'warehouse',7,7));assert.equal(s.cash,2650);assert.equal(s.token,before);assert.equal(s.assets.length,0);assert.equal(s.buildings.at(-1).ordinary,true);const reloaded=normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(reloaded.assets.length,0,'ordinary buildings never become free NFTs on reload');
 const cash=s.cash;assert.equal(buildOrdinary(s,'solar',5,7),false);assert.equal(s.cash,cash);s.cash=0;assert.equal(buildOrdinary(s,'mill',7,3),false);
});
test('every ordinary counterpart is weaker than the least expensive NFT of the same family',()=>{
 for(const [type,m]of Object.entries(ORDINARY_MODELS)){const nft=CATALOG.find(n=>n.type===type);assert.ok(m.cost>0);if(m.cycle)assert.ok(m.cycle>nft.cycle);if(m.storage)for(const [k,n]of Object.entries(m.storage))assert.ok(n<nft.storage[k]);if(m.radius)assert.ok(m.radius<nft.radius);if(m.handlingReduction)assert.ok(m.handlingReduction<nft.handlingReduction);if(m.shippingTime)assert.ok(m.shippingTime>nft.shippingTime)}
});
test('ordinary buildings really supply water, process crops and store cargo without minting NFTs',()=>{
 const s=newFarmAccount('A',BASE);buildLine(s);assert.equal(capacity(s,'wheat'),200);assert.ok(startDailyChallenge(s,'bread-rush',BASE));
 for(let n=0;n<150;n++)tick(s,BASE+n*1000);assert.ok(s.productionTotals.water>0);assert.ok(s.productionTotals.wheat>0);assert.ok(s.productionTotals.flour>0);assert.ok(s.productionTotals.bread>0);assert.equal(s.assets.length,0);const mill=s.buildings.find(b=>b.type==='mill');assert.equal(ownerFor(s,mill),mill);assert.equal(modelFor(s,mill).ordinary,true);
});
test('owned NFT placements cost no operating cash and each exact NFT can be deployed only once',()=>{
 const s=newFarmAccount('A',BASE),a=purchase(s,'solar-garden');assert.ok(a);const cash=s.cash,token=s.token;
 assert.ok(placeAsset(s,a.id,5,7));assert.equal(placeAsset(s,a.id,5,6),false);assert.equal(s.cash,cash);assert.equal(s.token,token);const b=purchase(s,'solar-garden');assert.ok(placeAsset(s,b.id,5,6));assert.equal(s.buildings.filter(b=>b.type==='solar').length,2);
});
test('restarting clears the round but retains TOM, exact NFT IDs, listings, favorites and daily quota',()=>{
 let s=newFarmAccount('A',BASE);const a=mint(s,'well-stone'),b=mint(s,'solar-garden');b.listingPrice=30;s.favorites=[b.id];assert.ok(placeAsset(s,a.id,2,7));a.job={remaining:3,outputs:{water:6}};a.chargeRemaining=8;s.wheat=30;s.cash=700;
 assert.ok(beginChallenge(s,'bread-rush',BASE));const oldId=s.round.id,token=s.token;s=restartFarm(s,BASE+1000);
 assert.notEqual(s.round.id,oldId);assert.equal(s.token,token);assert.equal(s.cash,3000);assert.equal(s.wheat,0);assert.equal(s.roads.length,0);assert.deepEqual(s.assets.map(a=>a.id),[a.id,b.id]);assert.equal(s.assets[0].job,undefined);assert.equal(s.assets[0].chargeRemaining,undefined);assert.equal(s.assets[1].listingPrice,30);assert.deepEqual(s.favorites,[b.id]);assert.equal(s.daily.challenge.status,'expired');assert.equal(beginChallenge(s,'bread-rush',BASE+2000),false);assert.ok(placeAsset(s,a.id,2,7));assert.equal(s.cash,3000);
});
test('a round can pay once only, even on a later day; only a newly rebuilt round earns a new reward',()=>{
 let s=newFarmAccount('A',BASE);buildLine(s);assert.ok(startDailyChallenge(s,'bread-rush',BASE));finish(s);const token=s.token;assert.ok(claimReward(s,BASE+11000));assert.equal(s.token,token+24);assert.equal(claimReward(s,BASE+12000),false);
 assert.equal(startDailyChallenge(s,'bread-rush',BASE+86400000),false);assert.equal(challengeView(s,BASE+86400000).needsRebuild,true);
 s=restartFarm(s,BASE+86400001);buildLine(s);assert.ok(startDailyChallenge(s,'bread-rush',BASE+86400002));finish(s,BASE+86410000);assert.ok(claimDailyReward(s,BASE+86411000));assert.equal(s.round.rewardClaimed,true);assert.equal(startDailyChallenge(s,'bread-rush',BASE+2*86400000),false);
});
test('industry bonuses settle once with the main reward and cannot create an extra payout in the same round',()=>{
 const s=newFarmAccount('A',BASE);buildLine(s);assert.ok(startDailyChallenge(s,'bread-rush',BASE));s.productionTotals={energy:6,milk:6,cake:4};finish(s);const before=s.token;assert.ok(claimReward(s,BASE+11000));assert.equal(s.token,before+24+8+12+20);assert.deepEqual(s.questsClaimed,QUESTS.map(q=>q.id));for(const q of QUESTS)assert.equal(claimQuest(s,q.id,BASE+12000),false);assert.equal(claimReward(s,BASE+13000),false);
});
test('legacy farms keep their assets and resources but cannot reuse old construction for new TOM rewards',()=>{
 const s=newFarmAccount('A',BASE);delete s.roundMode;delete s.round;const a=mint(s,'well-stone');s.wheat=45;upgradeRoundEconomy(s);assert.equal(s.wheat,45);assert.equal(s.assets[0].id,a.id);assert.equal(challengeView(s,BASE).needsRebuild,true);assert.equal(beginChallenge(s,'bread-rush',BASE),false);
});

test('an owned NFT warehouse supplies storage and shipping without purchasing an ordinary warehouse',()=>{const s=newFarmAccount('A',BASE);assert.ok(buildOrdinary(s,'road',7,8));const a=mint(s,'warehouse-logistics');assert.ok(placeAsset(s,a.id,7,7));assert.equal(capacity(s,'flour'),160);assert.equal(s.buildings.some(b=>b.type==='barn'),false);s.bread=3;assert.ok(startDelivery(s,BASE));assert.equal(s.cash,2995);});

test('a farm rebuilt with ordinary facilities alone can finish the starter challenge from zero stock in five minutes',()=>{const s=newFarmAccount('A',BASE);buildLine(s);assert.ok(buildOrdinary(s,'wheat',4,4));assert.ok(startDailyChallenge(s,'bread-rush',BASE));let completed=0;for(let n=1;n<300;n++){tick(s,BASE+n*1000);if(s.bread>=3&&!s.delivery)startDelivery(s,BASE+n*1000);if(challengeView(s,BASE+n*1000).status==='completed'){completed=n;break}}assert.ok(completed>0&&completed<300);assert.equal(s.assets.length,0);assert.ok(claimReward(s,BASE+completed*1000));assert.equal(s.token,152);});
