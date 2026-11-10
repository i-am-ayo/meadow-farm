import test from 'node:test';
import assert from 'node:assert/strict';
import {newFarmAccount,normalizeState,buildOrdinary,modelFor,ownerFor,productionInfo,tick,
  roomFor,capacity,warehouseStock,activeHaulers,startDelivery,purchase,placeAsset,ordinaryItem} from '../dist/rules.mjs';
import {treeReady,treeGrowth,findTimberTree,TREE_REGROW_SECONDS} from '../dist/forestry.mjs';
import {storageOverview} from '../dist/storage.mjs';
import {inventoryRows,preferences,runAutomation} from '../dist/farm-assistant.mjs';
import {salesReport} from '../dist/sales.mjs';
import {startNewRound} from '../dist/round-layout.mjs';
import {translate} from '../dist/i18n.mjs';

const BASE=Date.parse('2030-05-12T10:00:00+08:00');
function farm({vegetables=false,lumber=false,tree=true}={}) {
  const s=newFarmAccount('A',BASE);
  for(const [key,x,y] of [['road',7,8],['road',6,8],['road',5,8],['road',4,8],['barn',7,7],['well',5,7]])assert.ok(buildOrdinary(s,key,x,y));
  if(vegetables)assert.ok(buildOrdinary(s,'vegetable',4,9));
  if(lumber)assert.ok(buildOrdinary(s,'lumber',6,9));
  if(tree)assert.ok(buildOrdinary(s,'tree',6,10));
  return s;
}
const advance=(s,seconds)=>{for(let n=0;n<seconds;n++)tick(s,BASE+(s.seconds+1)*1000);};
test('vegetables require water, use the paid recipe, and arrive through the hauling system',()=>{
  const s=farm({vegetables:true,tree:false}),plot=s.buildings.find(b=>b.type==='vegetable');
  s.buildings.find(b=>b.type==='well').enabled=false;
  advance(s,20);assert.equal(s.vegetables,0);assert.equal(plot.job,undefined);assert.match(productionInfo(s,plot).label,/清水/);
  s.water=4;tick(s,BASE+21000);assert.equal(s.water,2);assert.equal(s.vegetables,0);assert.deepEqual(plot.job.outputs,{vegetables:3});
  assert.ok(plot.job.haul);
  while(plot.job.remaining>plot.job.haul.duration)tick(s,BASE+(s.seconds+1)*1000);
  assert.ok(activeHaulers(s).some(h=>h.outputs.vegetables===3));assert.equal(s.vegetables,0);
  const remaining=plot.job.remaining;advance(s,remaining);assert.equal(s.vegetables,3);assert.equal(s.productionTotals.vegetables,3);
});
test('logging needs a planted reachable mature tree and never creates timber from scenery',()=>{
  const s=farm({lumber:true,tree:false}),camp=s.buildings.find(b=>b.type==='lumber');
  advance(s,40);assert.equal(s.wood,0);assert.equal(camp.job,undefined);assert.equal(productionInfo(s,camp).label,'等待成熟林木');
  buildOrdinary(s,'tree',12,12);advance(s,5);assert.equal(s.wood,0,'a tree outside the harvesting radius is not a source');
  buildOrdinary(s,'tree',6,10);const tree=s.buildings.find(b=>b.type==='tree'&&b.x===6);
  tick(s,BASE+(s.seconds+1)*1000);assert.equal(tree.regrowsAt,tree.cutAt+TREE_REGROW_SECONDS);
  assert.equal(treeReady(s,tree),false);assert.equal(s.wood,0);assert.ok(camp.job.haul);
  advance(s,camp.job.remaining);assert.equal(s.wood,3);assert.equal(s.productionTotals.wood,3);
});
test('two camps cannot fell the same tree twice; regrowth follows the saved simulation clock',()=>{
  let s=farm({lumber:true});buildOrdinary(s,'lumber',5,9);
  tick(s,BASE+1000);let tree=s.buildings.find(b=>b.type==='tree');
  assert.equal(s.buildings.filter(b=>b.type==='lumber'&&b.job).length,1);
  assert.equal(tree.regrowsAt,91);assert.equal(treeGrowth(s,tree),0);
  s=normalizeState(JSON.parse(JSON.stringify(s)));tree=s.buildings.find(b=>b.type==='tree');
  assert.equal(tree.regrowsAt,91);advance(s,40);assert.equal(s.wood,3);
  assert.equal(s.buildings.filter(b=>b.type==='lumber'&&b.job).length,0);
  advance(s,49);assert.equal(s.seconds,90);assert.equal(treeReady(s,tree),false);
  tick(s,BASE+91000);assert.equal(tree.regrowsAt,181);assert.equal(s.buildings.filter(b=>b.type==='lumber'&&b.job).length,1);
});
test('nearby trees across the creek are reachable only after a bridge is built',()=>{
  const s=farm({tree:false});buildOrdinary(s,'lumber',15,7);buildOrdinary(s,'tree',17,7);
  const camp=s.buildings.find(b=>b.type==='lumber'),tree=s.buildings.find(b=>b.type==='tree');
  assert.equal(findTimberTree(s,camp,3),undefined);
  assert.ok(buildOrdinary(s,'road',16,7));assert.equal(findTimberTree(s,camp,3),tree);
});
test('no warehouse space means no tree is cut and no crop water is paid',()=>{
  const s=farm({vegetables:true,lumber:true}),tree=s.buildings.find(b=>b.type==='tree');
  s.vegetables=198;s.wood=2;s.water=20;s.buildings.find(b=>b.type==='well').enabled=false;
  assert.equal(warehouseStock(s),200);assert.equal(capacity(s,'wood'),200);assert.equal(capacity(s,'vegetables'),200);
  assert.equal(roomFor(s,{wood:3}),false);tick(s,BASE+1000);
  assert.equal(tree.cutAt,undefined);assert.equal(s.water,20);
  s.vegetables-=6;tick(s,BASE+2000);assert.ok(tree.cutAt);assert.equal(s.water,18);
});
test('vegetable and timber sales pay operating coins exactly once after a complete truck trip',()=>{
  const s=farm({vegetables:true,lumber:true});
  for(let n=0;n<150&&(s.vegetables<6||s.wood<3);n++)advance(s,1);
  assert.ok(s.vegetables>=6);assert.ok(s.wood>=3);
  const cash=s.cash,token=s.token;
  for(const [resource,amount,payout] of [['vegetables',6,60],['wood',3,75]]){
    s.selectedOrder=resource;const stock=s[resource],before=s.cash;
    assert.ok(startDelivery(s,BASE+s.seconds*1000));assert.equal(s[resource],stock-amount);assert.equal(s.cash,before);
    assert.equal(startDelivery(s),false);advance(s,11);assert.equal(s.cash,before);advance(s,1);assert.equal(s.cash,before+payout);
  }
  assert.equal(s.cash,cash+135);assert.equal(s.token,token);
  const report=salesReport(s,'all',BASE);assert.equal(report.trips,2);assert.equal(report.revenue,135);
  assert.equal(report.products.vegetables.units,6);assert.equal(report.products.wood.units,3);
  advance(s,1);assert.equal(salesReport(s,'all',BASE).revenue,135);
});
test('new goods appear in the shared warehouse, English search and configurable alerts',()=>{
  const s=farm({vegetables:true,lumber:true});s.vegetables=8;s.wood=4;s.flour=3;
  const overview=storageOverview(s,s.buildings.find(b=>b.type==='barn'));
  assert.equal(overview.groups[1].used,15);assert.equal(overview.groups[1].stocks.find(r=>r.resource==='wood').amount,4);
  assert.equal(inventoryRows(s,'蔬菜')[0].amount,8);assert.equal(inventoryRows(s,'vegetables')[0].amount,8);
  assert.equal(inventoryRows(s,'timber')[0].amount,4);assert.equal(inventoryRows(s,'lumber')[0].amount,4);
  const old={bread:9};preferences(s).thresholds=old;
  assert.equal(preferences(s).thresholds.wood,3);assert.equal(preferences(s).thresholds.vegetables,6);assert.equal(preferences(s).thresholds.bread,9);
});
test('auto-sell supports both new orders, and layout reuse preserves their grades but resets goods and stumps',()=>{
  const s=farm({vegetables:true,lumber:true});s.vegetables=6;s.wood=3;
  preferences(s).automation.enabled=true;s.selectedOrder='vegetables';
  assert.ok(runAutomation(s,BASE).dispatched);advance(s,12);
  s.selectedOrder='wood';assert.ok(runAutomation(s,BASE+12000).dispatched);
  const token=s.token,next=startNewRound(s,true,BASE+13000);
  assert.ok(next);assert.equal(next.vegetables,0);assert.equal(next.wood,0);assert.equal(next.token,token);
  assert.equal(next.buildings.find(b=>b.type==='vegetable').modelId,'basic-vegetable');
  assert.equal(next.buildings.find(b=>b.type==='lumber').modelId,'basic-lumber');
  assert.ok(treeReady(next,next.buildings.find(b=>b.type==='tree')));
  assert.equal(salesReport(next,'all',BASE).products.vegetables.revenue,60);
});
test('NFT vegetable and logging facilities use TOM once and retain an already paid logging batch on recall',()=>{
  const s=farm(),asset=purchase(s,'lumber-grove'),garden=purchase(s,'garden-verde');
  assert.ok(asset);assert.ok(garden);assert.equal(s.token,128-32-18);
  assert.ok(placeAsset(s,asset.id,6,9));assert.ok(placeAsset(s,garden.id,4,9));const cash=s.cash;
  tick(s,BASE+1000);const cutAt=s.buildings.find(b=>b.type==='tree').cutAt,remaining=asset.job.remaining;
  s.buildings=s.buildings.filter(b=>b.assetId!==asset.id);advance(s,3);assert.equal(asset.job.remaining,remaining);
  assert.ok(placeAsset(s,asset.id,6,9));advance(s,remaining);assert.equal(s.wood,3);
  assert.equal(s.buildings.find(b=>b.type==='tree').cutAt,cutAt);assert.equal(s.cash,cash);
  for(const type of ['vegetable','lumber']){
    const ordinary=ordinaryItem(type),nft=modelFor(s,s.buildings.find(b=>b.type===type));assert.ok(ordinary.cycle>nft.cycle);
  }
});
test('old saves initialize new stocks at zero without changing balances, buildings or completed stages',()=>{
  const s=newFarmAccount('A',BASE);delete s.vegetables;delete s.wood;s.daily.stageClaims=[{stage:1,reward:24}];
  const before={token:s.token,cash:s.cash,buildings:structuredClone(s.buildings),claims:structuredClone(s.daily.stageClaims)};
  normalizeState(s);assert.equal(s.vegetables,0);assert.equal(s.wood,0);assert.equal(s.token,before.token);assert.equal(s.cash,before.cash);
  assert.deepEqual(s.buildings,before.buildings);assert.deepEqual(s.daily.stageClaims,before.claims);
  for(const string of ['蔬菜','木材','采伐 1 棵成熟林木','林木再生中 · 55 秒'])assert.doesNotMatch(translate(string,'en'),/\p{Script=Han}/u);
});
