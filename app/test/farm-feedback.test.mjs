import test from 'node:test';
import assert from 'node:assert/strict';
import {newFarmAccount, applySupportGrant, buildOrdinary, mint, placeAsset, tick, startDelivery,
  startDailyChallenge, challengeView, canPlace, MAP_SIZE, RIVER_COLUMN, ROUND_CASH, restartFarm, claimReward} from '../dist/rules.mjs';
import {preferences, inventoryRows, setThreshold, alertTransitions, automationDecision, runAutomation} from '../dist/farm-assistant.mjs';
import {roundLayoutQuote, startNewRound, buildStarter, starterQuote, captureLayout} from '../dist/round-layout.mjs';
import {salesReport} from '../dist/sales.mjs';
import {findTruckRoute} from '../dist/transport.mjs';
import {findHaulRoute} from '../dist/hauling.mjs';
import {productionInfo,demolishOrdinary} from '../dist/rules.mjs';
import {prepareStage, simulateDailyStages, STAGE_TEST_TIME as BASE} from './fixtures/stage-farm.mjs';
import {shouldYieldIngredients} from '../dist/production-planner.mjs';

test('new rounds get 3000 coins and the existing-account support grant applies only once',()=>{
  const fresh=newFarmAccount('A',BASE);assert.equal(fresh.cash,3000);assert.equal(ROUND_CASH,3000);
  assert.equal(applySupportGrant(fresh),false);
  const old=structuredClone(fresh);delete old.supportGrantApplied;old.cash=590;
  const buildings=structuredClone(old.buildings),token=old.token;
  assert.ok(applySupportGrant(old));assert.equal(old.cash,2590);assert.equal(old.token,token);
  assert.deepEqual(old.buildings,buildings);assert.equal(applySupportGrant(old),false);
  assert.equal(applySupportGrant(JSON.parse(JSON.stringify(old))),false);
});
test('24-square expansion preserves the creek and enables tiles outside the old boundary',()=>{
  const s=newFarmAccount('A',BASE);assert.equal(MAP_SIZE,24);assert.equal(RIVER_COLUMN,16);
  for(const [x,y] of [[15,22],[18,20],[22,22],[12,17]])assert.ok(canPlace(s,x,y));
  for(const [x,y] of [[16,20],[23,20],[20,23]])assert.equal(canPlace(s,x,y),false);
  s.roads=[{x:9,y:7}];s.buildings=[{type:'trade',x:9,y:8}];
  const route=findTruckRoute(s,24);assert.ok(route);assert.ok(route.every(p=>Math.floor(p.x)!==16));
  s.buildings=[{x:15,y:10,type:'wheat'},{x:17,y:10,type:'barn'}];
  assert.equal(findHaulRoute(s,s.buildings[0],s.buildings[1],24),null,'villagers cannot cross the unchanged creek');
});
test('roads form paid bridges, connect the expanded river bank, and removal disconnects it again',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);
  for(let x=8;x<=18;x++)assert.ok(buildOrdinary(s,'road',x,7));
  assert.equal(buildOrdinary(s,'well',16,6),false,'buildings still cannot occupy water');
  const before=s.cash;assert.equal(buildOrdinary(s,'road',16,7),false);assert.equal(s.cash,before);
  assert.ok(buildOrdinary(s,'solar',18,6));const solar=s.buildings.at(-1);
  assert.equal(productionInfo(s,solar).blocked,undefined);
  const bridge=s.roads.find(r=>r.x===16);assert.equal(bridge.purchaseCost,5);
  assert.equal(demolishOrdinary(s,bridge).refund,2);assert.equal(productionInfo(s,solar).blocked,true);
});
test('starter layout pays actual prices, connects a productive farm and cannot be purchased twice',()=>{
  const s=newFarmAccount('A',BASE),quote=starterQuote(s),token=s.token;
  assert.ok(quote.allowed);assert.ok(buildStarter(s));assert.equal(s.cash,3000-quote.cost);assert.equal(s.token,token);
  const before=JSON.stringify(s);assert.equal(buildStarter(s),false);assert.equal(JSON.stringify(s),before);
  for(let n=1;n<=150;n++)tick(s,BASE+n*1000);
  assert.ok(s.productionTotals.bread>0);assert.equal(s.assets.length,0);
});
test('layout reuse restores exact ordinary grades and owned NFT IDs, charging coins once',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);buildOrdinary(s,'advanced-well',2,6);
  const asset=mint(s,'solar-garden');placeAsset(s,asset.id,7,9);asset.job={remaining:2,outputs:{energy:2}};
  s.bread=50;s.water=40;s.delivery={arrives:15};s.round.rewardClaimed=true;s.productionTotals.bread=50;
  preferences(s).music=true;s.salesBook={totals:{revenue:90,trips:1,units:3,products:{}},days:{},recent:[]};
  const original=JSON.stringify(s),quote=roundLayoutQuote(s,BASE+1000);
  assert.equal(JSON.stringify(s),original,'preview never changes the farm or clock');assert.ok(quote.allowed);
  const next=startNewRound(s,true,BASE+1000);
  assert.equal(next.cash,3000-quote.cost);assert.equal(next.token,s.token);assert.notEqual(next.round.id,s.round.id);
  assert.equal(next.bread,0);assert.equal(next.water,0);assert.equal(next.delivery,undefined);assert.deepEqual(next.productionTotals,{});
  assert.equal(next.assets[0].id,asset.id);assert.equal(next.assets[0].job,undefined);
  assert.ok(next.buildings.some(b=>b.modelId==='advanced-well'));
  assert.ok(next.buildings.some(b=>b.assetId===asset.id));assert.equal(next.round.rewardClaimed,false);
  assert.equal(next.preferences.music,true);assert.equal(next.salesBook.totals.revenue,90);
  assert.equal(JSON.stringify(s),original);assert.deepEqual(captureLayout(next),captureLayout(s));
});
test('unaffordable or invalid saved layouts never partially reset a farm or spend its assets',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);s.cash=10000;
  for(let y=11;y<20;y++)buildOrdinary(s,'advanced-cakery',4,y);
  const before=JSON.stringify(s);assert.equal(roundLayoutQuote(s,BASE).allowed,false);
  assert.equal(startNewRound(s,true,BASE),null);assert.equal(JSON.stringify(s),before);
  const blank=startNewRound(s,false,BASE);assert.equal(blank.cash,3000);assert.equal(blank.roads.length,0);
  assert.ok(blank.savedLayout.length>0);
  const second=newFarmAccount('B',BASE),a=mint(second,'well-stone');placeAsset(second,a.id,3,7);a.listingPrice=12;
  assert.equal(startNewRound(second,true,BASE),null);
});
test('reusing a blank round can retrieve its saved layout without duplicating an NFT',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);const a=mint(s,'well-stone');placeAsset(s,a.id,4,9);
  const blank=startNewRound(s,false,BASE+1000),next=startNewRound(blank,true,BASE+2000);
  assert.ok(next);assert.equal(next.assets.length,1);assert.equal(next.buildings.filter(b=>b.assetId===a.id).length,1);
});
test('inventory search understands both languages, stock states and multiple words',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);
  assert.deepEqual(inventoryRows(s,'bread').map(r=>r.resource),['bread']);
  assert.deepEqual(inventoryRows(s,'面包 low').map(r=>r.resource),['bread']);
  assert.equal(inventoryRows(s,'unmatched-word').length,0);
  assert.equal(inventoryRows(s).find(r=>r.resource==='cake').low,false,'unused products do not trigger shortages');
  assert.ok(setThreshold(s,'bread',0));assert.equal(inventoryRows(s,'bread')[0].low,false);
  for(const invalid of [-1,1.2,1000,NaN])assert.equal(setThreshold(s,'bread',invalid),false);
});
test('inventory separates paid work, goods in transit and actually available stock',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);s.water=20;
  tick(s,BASE+1000);const crop=s.buildings.find(b=>b.type==='wheat');
  const before=inventoryRows(s,'wheat')[0];assert.equal(before.amount,0);assert.ok(before.working>0);assert.equal(before.incoming,0);
  crop.job.remaining=crop.job.haul.duration;
  const hauling=inventoryRows(s,'wheat')[0];assert.ok(hauling.incoming>0);assert.equal(hauling.amount,0);
  s.buildings.find(b=>b.type==='mill').enabled=false;crop.job.remaining=1;tick(s,BASE+2000);assert.ok(inventoryRows(s,'wheat')[0].amount>0);
});
test('stock notifications occur on transitions, not on startup or every simulation tick',()=>{
  const low=[{resource:'bread',low:true,full:false}],healthy=[{resource:'bread',low:false,full:false}];
  let check=alertTransitions(undefined,low);assert.deepEqual(check.added,[]);
  assert.deepEqual(alertTransitions(check.next,low).added,[]);
  check=alertTransitions(check.next,healthy);assert.deepEqual(alertTransitions(check.next,low).added,['bread:low']);
});
test('sales report settles exactly once on return, retains history across rounds and respects Beijing dates',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);s.bread=3;
  const cash=s.cash;assert.ok(startDelivery(s,BASE));assert.equal(salesReport(s,'all',BASE).revenue,0);
  for(let n=1;n<=12;n++)tick(s,BASE+n*1000);
  assert.equal(s.cash,cash+90);assert.equal(salesReport(s,'today',BASE).trips,1);
  tick(s,BASE+13000);assert.equal(salesReport(s,'all',BASE).revenue,90);
  assert.equal(salesReport(s,'today',BASE+86400000).revenue,0);
  assert.equal(salesReport(restartFarm(s,BASE+86400000),'all',BASE+86400000).revenue,90);
});
test('auto-sell is opt-in, respects reserves and route checks, and cannot duplicate dispatch',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);s.bread=9;
  assert.equal(runAutomation(s,BASE).dispatched,undefined);assert.equal(s.bread,9);
  const settings=preferences(s).automation;settings.enabled=true;settings.reserve=7;
  assert.equal(runAutomation(s,BASE).dispatched,undefined);settings.reserve=6;
  const cash=s.cash;assert.ok(runAutomation(s,BASE).dispatched);assert.equal(s.delivery.automatic,true);
  assert.equal(s.bread,6);assert.equal(s.cash,cash);assert.equal(runAutomation(s,BASE).dispatched,undefined);
  for(let n=1;n<=12;n++)tick(s,BASE+n*1000);
  assert.equal(salesReport(s,'all',BASE).recent[0].automatic,true);
  assert.equal(runAutomation(s,BASE+12000).dispatched,undefined);
  s.delivery=null;s.roads=[];s.bread=12;
  assert.equal(runAutomation(s,BASE+13000).dispatched,undefined);assert.equal(s.bread,12);
});
test('auto-sell prioritizes outstanding challenge products and keeps downstream ingredients',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);buildOrdinary(s,'cakery',6,9);
  preferences(s).automation.enabled=true;s.milk=3;s.bread=4;s.selectedOrder='milk';
  assert.equal(automationDecision(s,BASE).order,undefined,'milk is reserved for cake');
  s.milk=4;assert.equal(automationDecision(s,BASE).order.id,'milk');
  assert.ok(startDailyChallenge(s,'bread-rush',BASE));s.milk=20;
  assert.equal(automationDecision(s,BASE).order.id,'bread','stage bread deliveries take priority over the selected milk order');
});
test('all stages remain feasible with the lower former budget and the new budget removes preparation grinding',()=>{
  const {results}=simulateDailyStages(BASE,3000);
  assert.ok(results.every(r=>r.preparation===0));assert.ok(results.every(r=>r.completed<r.limit*.9));
});
test('auto-sell can finish the starter challenge from empty stock without awarding TOM automatically',()=>{
  const s=newFarmAccount('A',BASE);buildStarter(s);preferences(s).automation.enabled=true;
  assert.ok(startDailyChallenge(s,'bread-rush',BASE));let done=false;
  for(let n=1;n<300;n++){const now=BASE+n*1000;tick(s,now);runAutomation(s,now);if(challengeView(s,now).status==='completed'){done=true;break;}}
  assert.ok(done);assert.equal(s.token,128);assert.ok(salesReport(s,'all',BASE).trips>=3);
});
test('all five stages can run with automatic delivery and ingredient balancing inside their deadlines',()=>{
  let s=newFarmAccount('A',BASE),now=BASE;
  for(let stage=1;stage<=5;stage++){
    if(stage>1)s=restartFarm(s,now+1000);
    now=prepareStage(s,stage,now+2000).now;preferences(s).automation.enabled=true;
    assert.ok(startDailyChallenge(s,challengeView(s,now).plan.id,now));
    const limit=challengeView(s,now).plan.seconds;let elapsed=0;
    for(let n=1;n<limit;n++){
      const at=now+n*1000;tick(s,at);runAutomation(s,at);
      if(challengeView(s,at).status==='completed'){elapsed=n;now=at;break;}
    }
    assert.ok(elapsed>0&&elapsed<=limit*.9,`stage ${stage} must retain 10% timing headroom`);
    const token=s.token;assert.ok(claimReward(s,now));assert.ok(s.token>token);
  }
  const token=s.token,claims=structuredClone(s.daily.stageClaims);
  const reused=startNewRound(s,true,now+1000);
  assert.ok(reused);assert.deepEqual(reused.daily.stageClaims,claims);
  assert.equal(claimReward(reused,now+2000),false);assert.equal(reused.token,token);
});
test('ingredient balancing is optional, temporary, and does not pause a building or cancel paid batches',()=>{
  const s=newFarmAccount('A',BASE),b={type:'cakery',enabled:true};preferences(s).automation.enabled=true;
  s.daily.challenge={status:'active',roundId:s.round.id,endsAt:BASE+10000,
    produced:{cake:6,bread:12},shipped:{bread:3},planSnapshot:{goals:[
      {kind:'produced',resource:'cake',target:6},{kind:'shipped',resource:'bread',target:12}]}};
  assert.equal(shouldYieldIngredients(s,b,BASE),true);assert.equal(b.enabled,true);
  preferences(s).automation.balanceProduction=false;assert.equal(shouldYieldIngredients(s,b,BASE),false);
  preferences(s).automation.balanceProduction=true;s.daily.challenge.shipped.bread=12;
  assert.equal(shouldYieldIngredients(s,b,BASE),false);
  s.daily.challenge.shipped.bread=3;assert.equal(shouldYieldIngredients(s,b,BASE+11000),false);
});
