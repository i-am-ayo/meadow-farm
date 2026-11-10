import test from 'node:test';
import assert from 'node:assert/strict';
import {newFarmAccount,normalizeState,tick,productionInfo,capacity,buildOrdinary,startDelivery,restartFarm,purchase,placeAsset,ownerFor,claimReward,challengeView} from '../dist/rules.mjs';
import {buildStarter,startNewRound} from '../dist/round-layout.mjs';
import {preferences,automationDecision} from '../dist/farm-assistant.mjs';
import {salesReport} from '../dist/sales.mjs';
import {prepareStage,runStage} from './fixtures/stage-farm.mjs';
import {translate} from '../dist/i18n.mjs';
import {LEVEL_XP,villageState,farmLevel,awardExperience,recordVillageProduction,researchQuote,buyResearch,researchRank,weatherView,productionMultiplier,contractOffers,activeContract,acceptContract,fulfillContract,refreshContracts,abandonContract,claimAchievement,achievementRows} from '../dist/village.mjs';
const BASE=Date.parse('2030-05-12T10:00:00+08:00');
function farm(){const s=newFarmAccount('A',BASE);assert.ok(buildStarter(s));return s;}
function advance(s,n){for(let i=0;i<n;i++)tick(s,BASE+(s.seconds+1)*1000);}
function fill(s,goods){for(const [k,n]of Object.entries(goods))s[k]=Math.max(s[k]||0,n);}

test('legacy migration initializes a career without inventing XP or changing stock, cash, TOM or buildings',()=>{
  const s=farm();delete s.village;s.bread=47;s.productionTotals={bread:1000};
  const before=structuredClone(s);normalizeState(s);
  assert.equal(s.village.xp,0);assert.equal(farmLevel(s),1);assert.equal(s.village.points,0);assert.equal(s.village.weatherEnabled,false);
  delete s.village;assert.deepEqual(s,before);
});
test('XP is awarded for actual unloading and settled truck trips, never for a pending or full batch',()=>{
  const s=farm();s.water=20;advance(s,1);assert.equal(s.village.xp,0);
  advance(s,65);assert.ok(s.village.xp>0);assert.ok(s.village.produced.wheat>0);
  // Freeze production and pay a ready truck exactly once.
  for(const b of s.buildings)if(b.type!=='barn')ownerFor(s,b).enabled=false;
  s.bread=10;s.selectedOrder='bread';const xp=s.village.xp;assert.ok(startDelivery(s,BASE));
  assert.equal(s.village.xp,xp);advance(s,11);assert.equal(s.village.xp,xp);advance(s,1);
  assert.equal(s.village.xp,xp+8);assert.equal(s.village.trips,1);advance(s,3);assert.equal(s.village.xp,xp+8);
});
test('water and power do not generate XP and warehouse overflow cannot generate unreceived experience',()=>{
  const s=farm();recordVillageProduction(s,{water:100,energy:100});assert.equal(s.village.xp,0);
  for(const b of s.buildings)if(b.type!=='barn')ownerFor(s,b).enabled=false;
  const bakery=s.buildings.find(b=>b.type==='bakery');bakery.enabled=true;bakery.job={remaining:1,outputs:{bread:1}};s.bread=200;
  tick(s,BASE);assert.equal(s.bread,200);assert.equal(s.village.xp,0);assert.equal(bakery.job.remaining,0);
  s.bread--;tick(s,BASE+1000);assert.equal(s.bread,200);assert.equal(s.village.xp,6);assert.equal(bakery.job,undefined);
});
test('level thresholds grant research points once, including multi-level jumps and reloads',()=>{
  const s=farm();awardExperience(s,LEVEL_XP[3]);assert.equal(farmLevel(s),4);assert.equal(s.village.points,6);
  const restored=normalizeState(JSON.parse(JSON.stringify(s)));awardExperience(restored,1);assert.equal(restored.village.points,6);
  awardExperience(restored,NaN);awardExperience(restored,-1);assert.equal(restored.village.xp,321);
  awardExperience(restored,10000);assert.equal(farmLevel(restored),10);assert.equal(restored.village.points,18);
  awardExperience(restored,10000);assert.equal(restored.village.points,18);
});
test('research validates level, points and rank and storage responds to connectivity after upgrading',()=>{
  const s=farm();assert.equal(buyResearch(s,'storage'),false);assert.equal(buyResearch(s,'fake'),false);
  awardExperience(s,60);assert.equal(researchQuote(s,'storage').cost,1);assert.ok(buyResearch(s,'storage'));
  assert.equal(s.village.points,1);assert.equal(capacity(s,'bread'),224);assert.equal(buyResearch(s,'storage'),false);
  awardExperience(s,300);assert.ok(buyResearch(s,'storage'));assert.ok(buyResearch(s,'storage'));
  assert.equal(researchRank(s,'storage'),3);assert.equal(capacity(s,'bread'),272);assert.equal(buyResearch(s,'storage'),false);
  s.buildings.find(b=>b.type==='barn').enabled=false;assert.equal(capacity(s,'bread'),0);
});
test('production and logistics research affect new work but preserve a previously paid NFT batch',()=>{
  const s=farm(),a=purchase(s,'bakery-artisan');assert.ok(placeAsset(s,a.id,7,9));
  const b=s.buildings.find(b=>b.assetId===a.id);s.flour=20;s.water=100;advance(s,1);
  const remaining=a.job.remaining,flour=s.flour,baseline=productionInfo(s,b).cycle;
  awardExperience(s,320);assert.ok(buyResearch(s,'cultivation'));assert.ok(buyResearch(s,'logistics'));
  assert.equal(a.job.remaining,remaining);assert.equal(s.flour,flour);assert.ok(productionInfo(s,b).cycle<=baseline);
  a.enabled=false;advance(s,5);assert.equal(a.job.remaining,remaining);
  a.enabled=true;advance(s,1);assert.equal(a.job.remaining,remaining-1);
  s.bread=10;s.selectedOrder='bread';assert.ok(startDelivery(s,BASE));assert.equal(s.delivery.duration,11);
  const arrival=s.delivery.arrives;assert.ok(buyResearch(s,'logistics'));assert.equal(s.delivery.arrives,arrival);
});
test('weather is optional, predictable and positive, and game time alone advances the forecast',()=>{
  const s=farm();assert.equal(weatherView(s).id,'sun');assert.equal(productionMultiplier(s,'solar'),1);
  villageState(s).weatherEnabled=true;assert.equal(productionMultiplier(s,'solar'),.8);assert.equal(productionMultiplier(s,'wheat'),1);
  s.seconds=180;assert.equal(weatherView(s).id,'rain');assert.equal(weatherView(s).remaining,180);assert.equal(weatherView(s,1).id,'breeze');
  assert.equal(productionMultiplier(s,'wheat'),.8);assert.equal(productionMultiplier(s,'well'),.8);
  assert.deepEqual(weatherView(normalizeState(JSON.parse(JSON.stringify(s)))),weatherView(s));
  s.seconds=360;assert.equal(productionMultiplier(s,'mill'),.8);assert.equal(productionMultiplier(s,'bakery'),1);
});
test('learned production research and enabled weather really shorten new engine cycles',()=>{
  const s=farm(),mill=s.buildings.find(b=>b.type==='mill'),baseline=productionInfo(s,mill).cycle;
  awardExperience(s,320);for(let i=0;i<3;i++)assert.ok(buyResearch(s,'cultivation'));
  assert.ok(productionInfo(s,mill).cycle<baseline);
  villageState(s).weatherEnabled=true;s.seconds=360;
  assert.ok(productionInfo(s,mill).cycle<baseline-1);
});
test('visitor offers use available industries, acceptance is exclusive and incomplete handover is atomic',()=>{
  const s=farm(),first=contractOffers(s)[0];assert.equal(contractOffers(s).some(o=>o.requires.includes('dairy')),false);
  assert.equal(acceptContract(s,'unknown'),false);assert.ok(acceptContract(s,first.id));assert.equal(acceptContract(s,contractOffers(s)[1].id),false);
  const before=JSON.stringify(s);assert.equal(fulfillContract(s,first.id),false);assert.equal(JSON.stringify(s),before);
  fill(s,first.goods);const token=s.token,cash=s.cash,points=s.village.points;
  assert.ok(fulfillContract(s,first.id));assert.equal(s.cash,cash+first.cash);assert.equal(s.token,token);assert.ok(s.village.points>=points+1);
  assert.equal(s.village.contracts,1);assert.equal(s.orders,0);assert.equal(salesReport(s,'all',BASE).trips,0);
  assert.equal(fulfillContract(s,first.id),false);assert.equal(acceptContract(s,first.id),false);
});
test('refresh charges once, observes its game-time cooldown and never discards an accepted basket',()=>{
  const s=farm(),first=contractOffers(s)[0];acceptContract(s,first.id);const active=structuredClone(activeContract(s)),cash=s.cash;
  assert.ok(refreshContracts(s));assert.equal(s.cash,cash-25);assert.deepEqual(activeContract(s),active);
  assert.equal(refreshContracts(s),false);assert.equal(s.cash,cash-25);s.seconds=120;assert.ok(refreshContracts(s));
  assert.deepEqual(activeContract(s),active);s.cash=24;s.seconds=240;assert.equal(refreshContracts(s),false);
});
test('request deadlines survive reloads and changing offers; expired baskets keep stock and cannot pay',()=>{
  let s=farm();const first=contractOffers(s)[0];acceptContract(s,first.id);fill(s,first.goods);
  s.seconds=180;s=normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(activeContract(s).id,first.id);
  assert.notEqual(contractOffers(s)[0].id,first.id);assert.equal(acceptContract(s,first.id),false);
  // Disable sites so time expiry can be checked without production mutations.
  for(const b of s.buildings)ownerFor(s,b).enabled=false;
  const cash=s.cash,stock=Object.fromEntries(Object.keys(first.goods).map(k=>[k,s[k]]));advance(s,120);
  assert.equal(activeContract(s),null);assert.equal(fulfillContract(s,first.id),false);assert.equal(s.cash,cash);
  assert.deepEqual(Object.fromEntries(Object.keys(first.goods).map(k=>[k,s[k]])),stock);assert.equal(s.villageBoard.lastResult,'expired');
});
test('abandoning a request does not consume stock, and a stale completion cannot pay another request',()=>{
  const s=farm(),a=contractOffers(s)[0];acceptContract(s,a.id);fill(s,a.goods);const cash=s.cash;
  assert.ok(abandonContract(s));assert.equal(abandonContract(s),false);assert.equal(s.cash,cash);
  const b=contractOffers(s).find(o=>!o.used);assert.ok(acceptContract(s,b.id));fill(s,b.goods);
  assert.equal(fulfillContract(s,a.id),false);assert.equal(activeContract(s).id,b.id);assert.ok(fulfillContract(s,b.id));
});
test('preparation auto-sell reserves accepted baskets without disabling or consuming the manual stock',()=>{
  const s=farm();preferences(s).automation.enabled=true;const offer=contractOffers(s)[0];acceptContract(s,offer.id);
  s.selectedOrder='bread';s.bread=4;assert.equal(automationDecision(s,BASE).order,undefined);
  s.bread=5;const d=automationDecision(s,BASE);assert.equal(d.order.id,'bread');assert.equal(d.reserve,2);
  assert.equal(s.bread,5);abandonContract(s);assert.equal(automationDecision(s,BASE).reserve,0);
});
test('milestones pay once, do not award TOM and retain research, XP and claims across fresh and reused rounds',()=>{
  let s=farm();recordVillageProduction(s,{bread:12,vegetables:30,wood:18});const token=s.token,cash=s.cash;
  assert.ok(claimAchievement(s,'bread'));assert.equal(s.cash,cash+80);assert.equal(claimAchievement(s,'bread'),false);
  assert.equal(claimAchievement(s,'dessert'),false);assert.equal(s.token,token);
  awardExperience(s,600);assert.ok(buyResearch(s,'storage'));s.village.weatherEnabled=true;
  const career=structuredClone(s.village),offer=contractOffers(s)[0];acceptContract(s,offer.id);
  s=restartFarm(s,BASE+1000);assert.deepEqual(s.village,career);assert.equal(activeContract(s),null);assert.equal(s.bread,0);assert.equal(s.token,token);
  assert.equal(claimAchievement(s,'bread'),false);assert.ok(buildStarter(s));const next=startNewRound(s,true,BASE+2000);
  assert.deepEqual(next.village,career);assert.equal(next.villageBoard,undefined);assert.equal(capacity(next,'flour'),224);
  assert.equal(achievementRows(next).find(a=>a.id==='bread').claimed,true);
});
test('all five ordinary-facility stages remain attainable with maximum research and weather enabled',()=>{
  let s=newFarmAccount('A',BASE),now=BASE;awardExperience(s,6000);
  for(const id of ['cultivation','storage','logistics'])for(let rank=0;rank<3;rank++)assert.ok(buyResearch(s,id));
  s.village.weatherEnabled=true;
  for(let stage=1;stage<=5;stage++){
    if(stage>1)s=restartFarm(s,now+1000);
    const prepared=prepareStage(s,stage,now+2000),run=runStage(s,prepared.now);now=run.now;
    assert.ok(run.elapsed<challengeView(s,now).plan.seconds);assert.ok(claimReward(s,now));
  }
  assert.equal(s.daily.stageClaims.length,5);assert.equal(s.token,128+240+8+12+20);
});
test('new transient feedback is also translated when language changes during a notification',()=>{
  for(const message of ['成就奖励已到账。','设施已暂停，已付款批次保留。','研究已完成，新批次开始时生效。','村民取货完成：＋115 经营币、＋24 XP、＋1 研究点。'])
    assert.doesNotMatch(translate(message,'en'),/\p{Script=Han}/u);
});
