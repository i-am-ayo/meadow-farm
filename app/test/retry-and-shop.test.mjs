import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDINARY_CATALOG,CATALOG,ordinaryShopItems,ordinaryItem,buildOrdinary,newFarmAccount,normalizeState,modelFor,capacity,tick,retryDailyChallenge,claimReward,challengeReadiness,CHALLENGES} from '../dist/rules.mjs';
import {beginChallenge,retryChallenge,challengeView,recordChallengeProduction,recordChallengeDelivery} from '../dist/daily-challenge.mjs';
import {challengeEntry} from '../dist/challenge-entry.mjs';
const BASE=Date.parse('2030-05-12T10:00:00+08:00');
const account=()=>({accountId:'A',token:128,daily:null});
function finish(s,now){const id=s.daily.challenge.id;recordChallengeProduction(s,{bread:6},id,now);for(let i=0;i<3;i++)recordChallengeDelivery(s,{challengeId:id},'bread',3,now)}
function readyFarm(){const s=newFarmAccount('A',BASE);for(const[type,x,y]of[['barn',3,7],['well',2,7],['mill',7,3],['bakery',7,6],['wheat',3,4],['road',7,8],['road',6,8],['road',6,7],['road',6,6],['road',6,5],['road',6,4],['road',6,3],['road',5,5],['road',4,5],['road',3,5],['road',3,6],['road',2,6]])assert.ok(buildOrdinary(s,type,x,y));return s}
test('unfinished active and expired tasks can restart repeatedly before a reward is claimed',()=>{
 const s=account();assert.ok(beginChallenge(s,'bread-rush',BASE));const first=s.daily.challenge.id;recordChallengeProduction(s,{bread:4},first,BASE+1000);
 assert.ok(retryChallenge(s,BASE+2000));assert.notEqual(s.daily.challenge.id,first);assert.deepEqual(s.daily.challenge.produced,{});assert.equal(s.daily.challenge.endsAt,BASE+302000);assert.equal(s.daily.attempts,2);
 assert.equal(challengeView(s,BASE+303000).status,'expired');assert.ok(retryChallenge(s,BASE+304000));assert.equal(s.daily.attempts,3);assert.equal(s.token,128);
});
test('retry keeps construction, funds, inventories, NFT identity and existing paid work intact',()=>{
 const s=readyFarm();assert.ok(beginChallenge(s,'bread-rush',BASE));tick(s,BASE+1000);const snapshot={cash:s.cash,token:s.token,water:s.water,wheat:s.wheat,buildings:JSON.stringify(s.buildings),assets:JSON.stringify(s.assets),roads:JSON.stringify(s.roads)};
 assert.ok(retryDailyChallenge(s,BASE+2000));for(const k of ['cash','token','water','wheat'])assert.equal(s[k],snapshot[k]);for(const k of ['buildings','assets','roads'])assert.equal(JSON.stringify(s[k]),snapshot[k]);
});
test('old production batches and deliveries cannot satisfy the restarted attempt',()=>{
 const s=account();beginChallenge(s,'bread-rush',BASE);const old=s.daily.challenge.id;retryChallenge(s,BASE+1000);recordChallengeProduction(s,{bread:100},old,BASE+2000);recordChallengeDelivery(s,{challengeId:old},'bread',100,BASE+2000);assert.deepEqual(s.daily.challenge.produced,{});assert.deepEqual(s.daily.challenge.shipped,{});assert.equal(s.daily.challenge.trips,0);
 finish(s,BASE+3000);assert.equal(challengeView(s,BASE+3000).status,'completed');assert.equal(retryChallenge(s,BASE+4000),false,'do not discard a completed, unclaimed reward');
});
test('repeated retries cannot issue another reward for the same stage or bypass the paid-round rebuild rule',()=>{
 const s=readyFarm();beginChallenge(s,'bread-rush',BASE);retryDailyChallenge(s,BASE+1000);finish(s,BASE+2000);assert.ok(claimReward(s,BASE+3000));const token=s.token;assert.equal(retryDailyChallenge(s,BASE+4000),false);assert.equal(claimReward(s,BASE+5000),false);assert.equal(s.token,token);assert.equal(challengeEntry(s,BASE+6000).canRetry,false);assert.equal(challengeView(s,BASE+86400000).needsRebuild,true);
});
test('reload preserves retry sequence and IDs remain unique even at the same timestamp',()=>{
 const s=account();beginChallenge(s,'bread-rush',BASE);const saved=JSON.parse(JSON.stringify(s));assert.ok(retryChallenge(saved,BASE));const id=saved.daily.challenge.id;assert.notEqual(id,s.daily.challenge.id);assert.ok(retryChallenge(saved,BASE));assert.notEqual(saved.daily.challenge.id,id);assert.equal(saved.daily.attempts,3);
});
test('the shop has 18 complete families and every required facility resolves to purchasable ordinary models',()=>{
 const all=ordinaryShopItems();assert.equal(all.length,46);assert.equal(new Set(all.map(m=>m.type )).size,18);assert.equal(new Set(all.map(m=>m.id )).size,46);
 for(const p of CHALLENGES){const s=newFarmAccount('A',BASE),r=challengeReadiness(s,p.id);for(const c of r.checks){assert.ok(c.buildTypes?.length,c.label);assert.ok(c.buildTypes.some(type=>all.some(m=>m.type===type)),c.label)}}
});
test('all 14 graded families have strictly increasing prices and useful capabilities across three grades',()=>{
 for(const type of new Set(ORDINARY_CATALOG.map(m=>m.type))){const ms=ORDINARY_CATALOG.filter(m=>m.type===type);assert.equal(ms.length,3);for(let i=1;i<3;i++){const a=ms[i-1],b=ms[i];assert.ok(b.cost>a.cost);if(b.cycle)assert.ok(Object.values(b.outputs)[0]/b.cycle>Object.values(a.outputs)[0]/a.cycle,type);else if(b.storage)assert.ok(Object.values(b.storage)[0]>Object.values(a.storage)[0],type);else if(b.handlingReduction)assert.ok(b.handlingReduction>a.handlingReduction,type);else if(b.shippingTime)assert.ok(b.shippingTime<a.shippingTime,type)}}
});
test('buying a higher grade charges its exact cash price and reload preserves the exact model, not an NFT',()=>{
 const s=newFarmAccount('A',BASE),m=ordinaryItem('advanced-well');assert.ok(buildOrdinary(s,m.id,2,7));assert.equal(s.cash,3000-m.cost);assert.equal(s.token,128);assert.equal(s.buildings.at(-1).modelId,m.id);assert.equal(s.assets.length,0);
 const saved=normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(modelFor(saved,saved.buildings.at(-1)).id,m.id);assert.equal(saved.assets.length,0);const cash=s.cash;assert.equal(buildOrdinary(s,'made-up-model',3,7),false);assert.equal(s.cash,cash);
});
test('higher-grade cash wells really produce more and higher-grade warehouses really add more capacity',()=>{
 function farm(id){const s=newFarmAccount('A',BASE);s.cash=5000;for(const[type,x,y]of[['barn',3,7],['road',7,8],['road',6,8],['road',6,7],['road',6,6],['road',5,6],['road',4,6],['road',3,6],['road',2,6],[id,2,7]])assert.ok(buildOrdinary(s,type,x,y));for(let i=0;i<60;i++)tick(s,BASE+i*1000);return s}
 const basic=farm('basic-well'),advanced=farm('advanced-well');assert.ok(advanced.productionTotals.water>basic.productionTotals.water);assert.ok(Number.isFinite(advanced.buildings.at(-1).totalProduced));
 const a=newFarmAccount('A',BASE),b=newFarmAccount('A',BASE);for(const[s,id]of[[a,'basic-warehouse'],[b,'advanced-warehouse']]){assert.ok(buildOrdinary(s,'road',7,8));assert.ok(buildOrdinary(s,id,7,7))}assert.ok(capacity(b,'flour')>capacity(a,'flour'));
});
