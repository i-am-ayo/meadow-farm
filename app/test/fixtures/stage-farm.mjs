import assert from 'node:assert/strict';
import {buildOrdinary,newFarmAccount,restartFarm,tick,startDelivery,startDailyChallenge,challengeView,claimReward,ORDERS} from '../../dist/rules.mjs';
export const STAGE_TEST_TIME=Date.parse('2030-05-12T10:00:00+08:00');
export const STARTER_LAYOUT=[...Array.from({length:6},(_,i)=>['road',i+2,8]),...Array.from({length:3},(_,i)=>['road',6,i+5]),['barn',5,7],['well',3,7],['mill',6,4],['bakery',7,6],['wheat',2,7],['wheat',3,6]];
export function buildStarter(s){for(const [key,x,y]of STARTER_LAYOUT)assert.ok(buildOrdinary(s,key,x,y),`${key} at ${x},${y}`)}
export function prepareStage(s,stage,now){
 buildStarter(s);if(stage>=2)assert.ok(buildOrdinary(s,'wheat',2,6));if(stage>=3)assert.ok(buildOrdinary(s,'wheat',2,5));
 const additions=stage>=3?[['dairy',4,9]]:[];
 if(stage>=4)additions.push(['cakery',6,9],['solar',7,9]);if(stage>=4)additions.push(['mill',5,5]);
 const cost=stage>=4?660:stage>=3?180:0;
 let preparation=0;
 while(s.cash<cost&&preparation<1800){preparation++;now+=1000;tick(s,now);if(s.bread>=3&&!s.delivery){s.selectedOrder='bread';startDelivery(s,now)}}
 assert.ok(s.cash>=cost,'preparation sales fund every facility without a gifted cash balance');
 // Finish any preparation delivery so a pre-stage trip cannot masquerade as progress.
 while(s.delivery){preparation++;now+=1000;tick(s,now)}
 for(const [key,x,y]of additions)assert.ok(buildOrdinary(s,key,x,y),key);
 return {now,preparation};
}
export function runStage(s,now){
 const view=challengeView(s,now);assert.ok(startDailyChallenge(s,view.plan.id,now));let completed=0;
 for(let elapsed=1;elapsed<view.plan.seconds;elapsed++){
  const at=now+elapsed*1000;tick(s,at);const v=challengeView(s,at);
  const cakeGoal=v.goals.find(g=>g.kind==='produced'&&g.resource==='cake');
  if(cakeGoal&&cakeGoal.value>=cakeGoal.target)s.buildings.find(b=>b.type==='cakery').enabled=false;
  if(!s.delivery)for(const resource of ['cake','milk','bread']){
   const goal=v.goals.find(g=>g.kind==='shipped'&&g.resource===resource),order=ORDERS.find(o=>o.resource===resource);
   const reserve=cakeGoal&&cakeGoal.value<cakeGoal.target&&['milk','bread'].includes(resource)?1:0;
   if(goal&&goal.value<goal.target&&s[resource]>=order.amount+reserve){s.selectedOrder=order.id;assert.ok(startDelivery(s,at));break}
  }
  if(v.status==='completed'){completed=elapsed;break}
 }
 assert.ok(completed>0,`stage ${view.stage} must finish before its deadline; ${JSON.stringify(challengeView(s,now+view.plan.seconds*1000).goals)}`);
 return {elapsed:completed,now:now+completed*1000};
}
export function simulateDailyStages(now=STAGE_TEST_TIME,budget=3000){
 let s=newFarmAccount('A',now);const results=[];
 for(let stage=1;stage<=5;stage++){
  if(stage>1)s=restartFarm(s,now+1000);
  s.cash=budget;const prep=prepareStage(s,stage,now+2000);const run=runStage(s,prep.now);now=run.now;
  assert.ok(claimReward(s,now));results.push({stage,preparation:prep.preparation,completed:run.elapsed,limit:challengeView(s,now).stages[stage-1].seconds,cash:s.cash});
 }
 return {s,results};
}
