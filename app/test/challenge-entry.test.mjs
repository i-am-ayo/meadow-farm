import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeEntry} from '../dist/challenge-entry.mjs';
import {newFarmAccount,buildOrdinary,startDailyChallenge,upgradeRoundEconomy,CHALLENGES} from '../dist/rules.mjs';
const BASE=Date.parse('2030-05-12T10:00:00+08:00');
function readyFarm(){
 const s=newFarmAccount('A',BASE);
 for(const [type,x,y]of [['barn',3,7],['well',2,7],['mill',7,3],['bakery',7,6],['wheat',3,4],['road',7,8],['road',6,8],['road',6,7],['road',6,6],['road',6,5],['road',6,4],['road',6,3],['road',5,5],['road',4,5],['road',3,5],['road',3,6],['road',2,6]])assert.ok(buildOrdinary(s,type,x,y));
 return s;
}
test('viewing a fresh task explains missing facilities without starting or consuming the attempt',()=>{
 const s=newFarmAccount('A',BASE),entry=challengeEntry(s,BASE);assert.equal(entry.canStart,false);assert.equal(entry.startLabel,'需先完成设施准备');assert.equal(entry.readiness.checks.length,6);assert.ok(entry.readiness.checks.every(c=>!c.ready&&c.reason));assert.equal(s.daily.challenge,null);assert.equal(s.daily.claimed,false);
});
test('legacy farms can view a full checklist but must rebuild before starting',()=>{
 const s=readyFarm();delete s.roundMode;delete s.round;upgradeRoundEconomy(s);const entry=challengeEntry(s,BASE);assert.ok(entry.readiness.ready);assert.equal(entry.canStart,false);assert.ok(entry.issues.some(i=>i.kind==='round'&&i.text.includes('旧农场')));assert.equal(startDailyChallenge(s,'bread-rush',BASE),false);assert.equal(s.daily.challenge,null);
});
test('the checklist distinguishes an unbuilt, disconnected or paused facility',()=>{
 const s=readyFarm(),well=s.buildings.find(b=>b.type==='well');s.roads=s.roads.filter(r=>!(r.x===2&&r.y===6));let c=challengeEntry(s,BASE).readiness.checks.find(c=>c.label==='水井');assert.equal(c.ready,false);assert.match(c.reason,/道路/);
 well.enabled=false;c=challengeEntry(s,BASE).readiness.checks.find(c=>c.label==='水井');assert.match(c.reason,/暂停/);s.buildings=s.buildings.filter(b=>b!==well);c=challengeEntry(s,BASE).readiness.checks.find(c=>c.label==='水井');assert.match(c.reason,/尚未建造/);
});
test('a ready task starts only on confirmation and a second start requires the explicit retry path',()=>{
 const s=readyFarm();let entry=challengeEntry(s,BASE);assert.ok(entry.canStart);assert.equal(s.daily.challenge,null);assert.ok(startDailyChallenge(s,entry.view.plan.id,BASE+1));entry=challengeEntry(s,BASE+2);assert.equal(entry.canStart,false);assert.equal(entry.startLabel,'重新开始任务');assert.equal(entry.canRetry,true);assert.equal(entry.canBegin,true);assert.ok(entry.issues.some(i=>i.kind==='active'));assert.equal(startDailyChallenge(s,'bread-rush',BASE+3),false);
});
test('daily quota and changed readiness give specific reasons rather than silent click failures',()=>{
 const s=readyFarm();assert.ok(challengeEntry(s,BASE).canStart);s.buildings.find(b=>b.type==='mill').enabled=false;assert.equal(challengeEntry(s,BASE).canStart,false);
 s.daily.stageClaims=CHALLENGES.map(p=>({stage:p.stage,reward:p.reward}));const entry=challengeEntry(s,BASE);assert.equal(entry.startLabel,'今日五阶段已完成');assert.match(entry.issues.find(i=>i.kind==='quota').text,/00:00/);assert.equal(startDailyChallenge(s,'bread-rush',BASE),false);
});
