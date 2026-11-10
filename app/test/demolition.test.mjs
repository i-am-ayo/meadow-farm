import test from 'node:test';
import assert from 'node:assert/strict';
import {newFarmAccount,buildOrdinary,ordinaryShopItems,demolitionQuote,demolishOrdinary,mint,placeAsset,normalizeState,restartFarm,capacity,roomFor,BASE_ROADS} from '../dist/rules.mjs';

test('all 46 cash facilities can be removed for half their paid price without changing TOM or NFTs',()=>{
 const s=newFarmAccount();s.cash=100000;const token=s.token;
 for(const item of ordinaryShopItems()){
  const before=s.cash;assert.ok(buildOrdinary(s,item.id,3,3),item.id);const b=item.type==='road'?s.roads.at(-1):s.buildings.at(-1);
  assert.equal(demolitionQuote(s,b).refund,Math.floor(item.cost/2));const result=demolishOrdinary(s,b);assert.equal(result.refund,Math.floor(item.cost/2));
  assert.equal(s.cash,before-item.cost+Math.floor(item.cost/2));assert.ok(!s.buildings.includes(b)&&!s.roads.includes(b));
 }
 assert.equal(s.token,token);assert.equal(s.assets.length,0);
});
test('refund follows the recorded payment, rounds down, and pays exactly once',()=>{
 const s=newFarmAccount();buildOrdinary(s,'advanced-well',3,3);const b=s.buildings.at(-1);b.purchaseCost=51;const cash=s.cash;
 assert.equal(demolitionQuote(s,b).refund,25);assert.equal(s.cash,cash,'preview does not pay or remove');assert.ok(s.buildings.includes(b));
 assert.equal(demolishOrdinary(s,{...b}),false,'a stale or copied target cannot pay');assert.equal(demolishOrdinary(s,b).refund,25);
 assert.equal(demolishOrdinary(s,b),false);assert.equal(s.cash,cash+25);
});
test('saved payment and grade survive reload and the refund can be spent again',()=>{
 let s=newFarmAccount();buildOrdinary(s,'advanced-mill',3,3);s=normalizeState(JSON.parse(JSON.stringify(s)));const b=s.buildings.at(-1);
 assert.equal(b.modelId,'advanced-mill');assert.equal(demolishOrdinary(s,b).refund,150);assert.equal(s.cash,2850);
 assert.ok(buildOrdinary(s,'standard-well',3,3));assert.equal(s.buildings.at(-1).modelId,'standard-well');assert.equal(s.cash,2740);
});
test('NFTs and permanent starting buildings cannot be demolished for cash',()=>{
 const s=newFarmAccount(),a=mint(s,'mill-rustic');placeAsset(s,a.id,3,3);const cash=s.cash;
 for(const b of s.buildings){assert.equal(demolitionQuote(s,b).eligible,false);assert.equal(demolishOrdinary(s,b),false)}
 assert.equal(s.cash,cash);assert.equal(s.assets[0],a);assert.equal(s.buildings.length,3);
});
test('legacy cash buildings use their exact grade and free map roads never mint a refund',()=>{
 const s=newFarmAccount();buildOrdinary(s,'advanced-mill',3,3);const b=s.buildings.at(-1);delete b.purchaseCost;assert.equal(demolishOrdinary(s,b).refund,150);
 s.round.legacy=true;const free={...BASE_ROADS[0]},added={x:12,y:12},freeField={x:4,y:4,type:'wheat'};s.roads.push(free,added);s.buildings.push(freeField);
 assert.equal(demolishOrdinary(s,free).refund,0);assert.equal(demolishOrdinary(s,added).refund,2);assert.equal(demolishOrdinary(s,freeField).refund,0);
 const old=newFarmAccount();old.roads.push({x:7,y:8});assert.equal(demolishOrdinary(old,old.roads[0]).refund,2,'new rounds previously recorded roads without payment metadata');
});
test('roads on an active truck route stay in place until the truck returns',()=>{
 const s=newFarmAccount();buildOrdinary(s,'road',7,8);const road=s.roads[0],cash=s.cash;s.delivery={route:[{x:7.5,y:8.5},{x:6.5,y:8.5}]};
 assert.match(demolitionQuote(s,road).reason,/货车/);assert.equal(demolishOrdinary(s,road),false);assert.equal(s.cash,cash);assert.ok(s.roads.includes(road));
 s.delivery=null;s.truckRoute=[{x:7.5,y:8.5}];assert.equal(demolishOrdinary(s,road).refund,2);assert.equal(s.truckRoute,undefined);
});
test('demolishing storage retains inventory but removes its capacity',()=>{
 const s=newFarmAccount();buildOrdinary(s,'road',7,8);buildOrdinary(s,'barn',7,7);s.wheat=80;s.bread=4;
 assert.equal(capacity(s,'wheat'),200);assert.equal(capacity(s,'bread'),200);const cash=s.cash;
 assert.equal(demolishOrdinary(s,s.buildings.at(-1)).refund,80);assert.equal(s.cash,cash+80);
 assert.equal(s.wheat,80);assert.equal(s.bread,4);assert.equal(capacity(s,'wheat'),0);assert.equal(capacity(s,'bread'),0);assert.equal(roomFor(s,{bread:1}),false);
});
test('demolition drops only the removed production job, without refunding materials or challenge progress',()=>{
 const s=newFarmAccount();buildOrdinary(s,'basic-mill',3,3);const b=s.buildings.at(-1);b.job={remaining:2,outputs:{flour:1}};s.wheat=7;s.productionTotals.flour=4;s.daily.deliveries=2;
 demolishOrdinary(s,b);assert.equal(s.wheat,7);assert.equal(s.flour,0);assert.equal(s.productionTotals.flour,4);assert.equal(s.daily.deliveries,2);
});
test('a target from a previous round or another account cannot be removed or paid',()=>{
 const s=newFarmAccount();buildOrdinary(s,'well',3,3);const b=s.buildings.at(-1),fresh=restartFarm(s),other=newFarmAccount('B');
 assert.equal(demolishOrdinary(fresh,b),false);assert.equal(demolishOrdinary(other,b),false);assert.equal(fresh.cash,3000);assert.equal(other.cash,3000);
});
test('invalid payment records and invalid balances cannot create cash or remove a facility',()=>{
 for(const paid of [-1,NaN,Infinity,'100',Number.MAX_SAFE_INTEGER+1]){
  const s=newFarmAccount();buildOrdinary(s,'well',3,3);const b=s.buildings.at(-1);b.purchaseCost=paid;const cash=s.cash;
  assert.equal(demolishOrdinary(s,b),false);assert.equal(s.cash,cash);assert.ok(s.buildings.includes(b));
 }
 const s=newFarmAccount();buildOrdinary(s,'well',3,3);s.cash=Number.MAX_SAFE_INTEGER;assert.equal(demolishOrdinary(s,s.buildings.at(-1)),false);
});
