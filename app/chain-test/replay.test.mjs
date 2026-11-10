import test from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,toUtf8Bytes} from 'ethers';
import {newFarmAccount,CHALLENGES,startDailyChallenge,tick,challengeView} from '../dist/rules.mjs';
import {preferences,runAutomation} from '../dist/farm-assistant.mjs';
import {enableTrace} from '../dist/trace.mjs';
import {replayFarm,ProofError} from '../backend/replay.mjs';
import {prepareStage,runStage,STAGE_TEST_TIME as BASE} from '../test/fixtures/stage-farm.mjs';
const player='0x0000000000000000000000000000000000000a11';
function completed(){
  const s=newFarmAccount(player,BASE);enableTrace(s);const prep=prepareStage(s,1,BASE+1000);s.chainAttempt={nonce:7};
  const result=runStage(s,prep.now),attempt={nonce:7,stage:1,startedAt:Math.floor(prep.now/1000),endsAt:Math.floor(prep.now/1000)+300,roundId:keccak256(toUtf8Bytes(s.round.id))};
  return {s,attempt,now:result.now};
}
test('server replays a completed ordinary-only stage from an empty farm without trusting client totals',()=>{
  const {s,attempt,now}=completed();const result=replayFarm({player,proof:s.proof,ownedAssets:[],attempt,now,forReward:true});
  assert.deepEqual(result.state.village,s.village);assert.equal(result.state.cash,s.cash);assert.equal(result.state.seconds,s.seconds);assert.equal(result.state.daily.challenge.status,'completed');assert.equal(result.bonusMask,0);
});
test('forged stocks, local completed flags, free construction and unsupported actions cannot earn a voucher',()=>{
  const {s,attempt,now}=completed();const replay=proof=>replayFarm({player,proof,ownedAssets:[],attempt,now,forReward:true});
  const fake=structuredClone(s.proof);fake.events=[];fake.bread=1000;fake.status='completed';assert.throws(()=>replay(fake),ProofError);
  const unknown=structuredClone(s.proof);unknown.events.push({op:'setCash',args:[1000000]});assert.throws(()=>replay(unknown),ProofError);
  const wrong=structuredClone(s.proof);wrong.events.unshift({op:'build',args:['cakery',8,8]});assert.throws(()=>replay(wrong),ProofError);
});
test('an unowned NFT, stale attempt, wrong round and accelerated post-start clock are rejected',()=>{
  const {s,attempt,now}=completed(),args={player,proof:s.proof,ownedAssets:[],attempt,now,forReward:true};
  const nft=structuredClone(s.proof);nft.initial.assets=[{id:'NFT-CHAIN-999',modelId:'mill-gale'}];assert.throws(()=>replayFarm({...args,proof:nft}),ProofError);
  assert.throws(()=>replayFarm({...args,attempt:{...attempt,nonce:8}}),ProofError);
  assert.throws(()=>replayFarm({...args,attempt:{...attempt,roundId:keccak256(toUtf8Bytes('another'))}}),ProofError);
  assert.throws(()=>replayFarm({...args,now:attempt.startedAt*1000+5000}),ProofError);
});
test('all five live automation stages replay exactly, including ingredient balancing in dessert stages',()=>{
  for(const plan of CHALLENGES){
    const s=newFarmAccount(player,BASE);s.daily.stageClaims=CHALLENGES.slice(0,plan.stage-1).map(p=>({stage:p.stage,planId:p.id,reward:p.reward}));
    preferences(s).automation.enabled=true;enableTrace(s);const prepared=prepareStage(s,plan.stage,BASE+2000);s.chainAttempt={nonce:plan.stage};
    assert.ok(startDailyChallenge(s,plan.id,prepared.now));let ended;
    for(let n=1;n<plan.seconds;n++){const at=prepared.now+n*1000;tick(s,at);runAutomation(s,at);if(challengeView(s,at).status==='completed'){ended=at;break;}}
    assert.ok(ended,plan.id);
    const attempt={nonce:plan.stage,stage:plan.stage,startedAt:Math.floor(prepared.now/1000),endsAt:Math.floor(prepared.now/1000)+plan.seconds,roundId:keccak256(toUtf8Bytes(s.round.id))};
    const result=replayFarm({player,proof:s.proof,ownedAssets:[],claimedStages:plan.stage-1,attempt,now:ended,forReward:true});
    assert.deepEqual(result.state.village,s.village,plan.id);assert.equal(result.state.cash,s.cash,plan.id);
  }
});
