import test from 'node:test';
import assert from 'node:assert/strict';
import {CHALLENGES,beginChallenge,retryChallenge,recordChallengeProduction,recordChallengeDelivery,claimDailyReward,challengeView,dailyState,today} from '../dist/daily-challenge.mjs';
import {newFarmAccount,restartFarm,claimReward,buildOrdinary} from '../dist/rules.mjs';
import {challengeEntry} from '../dist/challenge-entry.mjs';
import {simulateDailyStages,STAGE_TEST_TIME as BASE} from './fixtures/stage-farm.mjs';
function finish(s,now=BASE+1000){
 const a=s.daily.challenge,p=a.planSnapshot;
 for(const g of p.goals)if(g.kind==='produced')recordChallengeProduction(s,{[g.resource]:g.target},a.id,now);
 for(const g of p.goals)if(g.kind==='shipped')recordChallengeDelivery(s,{challengeId:a.id},g.resource,g.target,now);
 for(let n=0;n<20;n++)recordChallengeDelivery(s,{challengeId:a.id},'bread',3,now);
 assert.equal(a.status,'completed');
}
function account(){return {accountId:'A',token:128}}
test('five stages increase rewards, production, delivery work and available time',()=>{
 assert.equal(CHALLENGES.length,5);
 for(let i=1;i<5;i++){
  const a=CHALLENGES[i-1],b=CHALLENGES[i];assert.ok(b.reward>a.reward);assert.ok(b.seconds>a.seconds);
  assert.ok(b.goals.find(g=>g.kind==='trips').target>a.goals.find(g=>g.kind==='trips').target);
  for(const g of a.goals){const next=b.goals.find(h=>g.kind===h.kind&&g.resource===h.resource);assert.ok(next&&next.target>=g.target)}
 }
 assert.equal(CHALLENGES.reduce((n,p)=>n+p.reward,0),240);
});
test('future stages cannot be selected or paid early and changing a UI plan preference cannot skip ahead',()=>{
 const s=account();for(const p of CHALLENGES.slice(1))assert.equal(beginChallenge(s,p.id,BASE),false);
 dailyState(s,BASE).planId='harvest-feast';assert.equal(challengeView(s,BASE).stage,1);assert.equal(challengeView(s,BASE).plan.id,'bread-rush');assert.equal(claimDailyReward(s,BASE),false);
});
test('each stage pays once, advances in order, and the completed day cannot pay a sixth reward',()=>{
 const s=account();let total=0;
 for(const p of CHALLENGES){assert.ok(beginChallenge(s,p.id,BASE));finish(s);assert.ok(claimDailyReward(s,BASE+2000));total+=p.reward;assert.equal(s.token,128+total);assert.equal(claimDailyReward(s,BASE+2000),false);assert.equal(s.daily.stageClaims.length,p.stage);assert.equal(beginChallenge(s,p.id,BASE+3000),false)}
 const v=challengeView(s,BASE+3000);assert.equal(v.status,'claimed');assert.equal(v.stages.filter(p=>p.status==='claimed').length,5);assert.equal(v.earned,240);assert.equal(s.token,368);
});
test('each new reward requires a different rebuilt round and rebuilds never reset the daily stage ledger',()=>{
 let s=newFarmAccount('A',BASE);assert.ok(buildOrdinary(s,'tree',2,2));assert.ok(beginChallenge(s,'bread-rush',BASE));finish(s);assert.ok(claimReward(s,BASE+2000));
 const token=s.token,claims=structuredClone(s.daily.stageClaims);assert.equal(challengeView(s,BASE+2000).stage,2);assert.equal(challengeView(s,BASE+2000).needsRebuild,true);assert.equal(beginChallenge(s,'bread-supply',BASE+3000),false);
 s=restartFarm(s,BASE+4000);assert.equal(s.token,token);assert.deepEqual(s.daily.stageClaims,claims);assert.equal(challengeView(s,BASE+4000).stage,2);assert.equal(challengeView(s,BASE+4000).needsRebuild,false);
 assert.ok(buildOrdinary(s,'tree',2,2));assert.equal(beginChallenge(s,'bread-rush',BASE+5000),false);assert.ok(beginChallenge(s,'bread-supply',BASE+5000));
});
test('retry and reload retain previously paid stages but reject batches and truck returns from the previous attempt',()=>{
 let s=account();beginChallenge(s,'bread-rush',BASE);finish(s);claimDailyReward(s,BASE+2000);beginChallenge(s,'bread-supply',BASE+3000);const old=s.daily.challenge.id,claims=JSON.parse(JSON.stringify(s.daily.stageClaims)),token=s.token;
 s=JSON.parse(JSON.stringify(s));assert.ok(retryChallenge(s,BASE+4000));recordChallengeProduction(s,{bread:100},old,BASE+5000);recordChallengeDelivery(s,{challengeId:old},'bread',100,BASE+5000);
 assert.deepEqual(s.daily.challenge.produced,{});assert.equal(s.daily.challenge.trips,0);assert.deepEqual(s.daily.stageClaims,claims);assert.equal(s.token,token);finish(s,BASE+6000);assert.ok(claimDailyReward(s,BASE+7000));assert.equal(s.token,token+32);
});
test('Shanghai midnight resets stage progress and never reclaims or pays yesterday’s completed attempt',()=>{
 const s=account();beginChallenge(s,'bread-rush',BASE);finish(s);claimDailyReward(s,BASE+2000);beginChallenge(s,'bread-supply',BASE+3000);finish(s,BASE+4000);const tomorrow=Date.parse('2030-05-13T00:00:00+08:00'),token=s.token;
 assert.equal(claimDailyReward(s,tomorrow),false);const v=challengeView(s,tomorrow);assert.equal(v.stage,1);assert.equal(v.earned,0);assert.equal(s.token,token);assert.ok(beginChallenge(s,'bread-rush',tomorrow));
});
test('a stage is not shortened into an impossible last-minute challenge',()=>{
 const s=account(),late=Date.parse('2030-05-12T23:58:00+08:00');assert.equal(beginChallenge(s,'bread-rush',late),false);assert.equal(challengeView(s,late).canFitToday,false);
 const farm=newFarmAccount('A',late),e=challengeEntry(farm,late);assert.equal(e.startLabel,'今日时间不足');assert.match(e.issues.find(i=>i.kind==='time').text,/完整挑战/);
});
test('existing claimed daily rewards migrate as the first cleared stage without paying again',()=>{
 const s={...account(),token:164,daily:{date:today(BASE),claimed:true,challenge:{planId:'dairy-team',status:'completed',roundId:'old'}}};
 const v=challengeView(s,BASE);assert.equal(v.stage,2);assert.equal(v.stageClaims[0].reward,36);assert.equal(s.token,164);assert.equal(claimDailyReward(s,BASE),false);assert.equal(challengeView(JSON.parse(JSON.stringify(s)),BASE).stage,2);
});
test('an existing unclaimed old task retains its goals, deadline and promised payout',()=>{
 const s={...account(),daily:{date:today(BASE),claimed:false,challenge:{id:'old-attempt',planId:'dairy-team',status:'active',startedAt:BASE,endsAt:BASE+360000,produced:{milk:8},shipped:{milk:9},trips:3}}};
 let v=challengeView(s,BASE+1000);assert.equal(v.stage,1);assert.equal(v.plan.reward,36);assert.equal(v.plan.seconds,360);assert.equal(v.attempt.endsAt,BASE+360000);recordChallengeProduction(s,{milk:2,bread:4},'old-attempt',BASE+2000);assert.ok(claimDailyReward(s,BASE+3000));assert.equal(s.token,164);assert.equal(challengeView(s,BASE+3000).stage,2);
});
test('all five stages are attainable with ordinary facilities and real cash earned from preparation sales',()=>{
 const {s,results}=simulateDailyStages(BASE,1000);assert.equal(s.assets.length,0);assert.equal(s.daily.stageClaims.length,5);assert.equal(s.daily.claimed,true);
 assert.equal(results.length,5);for(const r of results)assert.ok(r.completed<=r.limit*.9,`stage ${r.stage} should retain at least 10% headroom`);
 assert.ok(results[3].preparation>0);assert.ok(results[4].preparation>0);assert.equal(s.token,128+240+8+12+20);
});
