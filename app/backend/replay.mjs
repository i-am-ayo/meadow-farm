import {newFarmAccount,CATALOG,CHALLENGES,QUESTS,buildOrdinary,placeAsset,demolishOrdinary,setAssetEnabled,startDelivery,startDailyChallenge,retryDailyChallenge,tick,claimReward,challengeView,rewardQuote} from '../dist/rules.mjs';
import {buyResearch,acceptContract,fulfillContract,abandonContract,refreshContracts,claimAchievement} from '../dist/village.mjs';
import {recallAsset,enableFacility,setWeather} from '../dist/trace.mjs';
import {today} from '../dist/daily-challenge.mjs';
import {keccak256,toUtf8Bytes} from 'ethers';

export class ProofError extends Error {}
const fail=message=>{throw new ProofError(message);};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const careerDigest=village=>keccak256(toUtf8Bytes(JSON.stringify(village)));
export function replayFarm({player,proof,ownedAssets,claimedStages=0,questMask=0,attempt,now=Date.now(),initialCareer=null,forReward=false}){
  if(proof?.version!==1||!proof.initial||!Array.isArray(proof.events)||proof.events.length>14000)fail('Invalid or oversized game trace. Start a fresh round.');
  const initial=proof.initial;
  if(typeof initial.roundId!=='string'||initial.roundId.length>160||!integer(initial.serial,1,1000000)||!integer(initial.createdAt,1,now+5000)||!integer(initial.claimedStages,0,5)||initial.claimedStages>claimedStages||!Array.isArray(initial.assets)||initial.assets.length>250)fail('Invalid round header.');
  const allowed=new Map(ownedAssets.map(a=>[a.id,a]));
  function asset(id,modelId){const real=allowed.get(id);if(!real||real.modelId!==modelId||!CATALOG.some(m=>m.id===modelId))fail('A used NFT is no longer owned by this wallet. Rebuild before claiming.');return {id,modelId,enabled:true,totalProduced:0,...(real.listingPrice?{listingPrice:real.listingPrice}:{})};}
  const s=newFarmAccount(player,initial.createdAt);s.token=0;s.preferences.automation={enabled:!!initial.automation?.enabled,balanceProduction:initial.automation?.balanceProduction!==false};s.roundSerial=initial.serial;s.round.id=initial.roundId;
  if(initialCareer)s.village=structuredClone(initialCareer);
  const ids=new Set();s.assets=initial.assets.map(a=>{if(ids.has(a.id))fail('Duplicate NFT.');ids.add(a.id);return asset(a.id,a.modelId);});
  s.daily={version:2,date:today(initial.createdAt),deliveries:0,claimed:false,stageClaims:CHALLENGES.slice(0,initial.claimedStages).map(p=>({stage:p.stage,planId:p.id,reward:p.reward})),challenge:null,attempts:0};
  s.questsClaimed=QUESTS.filter((_,i)=>(questMask&(1<<i))!==0).map(q=>q.id);
  let ticks=0,lastTime=initial.createdAt,latestNonce=0,postStartTicks=0;
  for(const event of proof.events){
    if(!event||typeof event.op!=='string'||!Array.isArray(event.args)||event.args.length>5)fail('Malformed action.');
    const a=event.args;let ok=true;
    switch(event.op){
      case 'tick':{
        const time=a[0];if(!integer(time,initial.createdAt,now+5000)||time<lastTime||++ticks>10800)fail('Invalid game clock or round longer than three hours.');
        lastTime=time;tick(s,time);if(latestNonce===attempt?.nonce)postStartTicks++;break;
      }
      case 'build':ok=buildOrdinary(s,...a);break;
      case 'place':ok=placeAsset(s,...a);break;
      case 'asset':{if(ids.has(a[0]))fail('Duplicate NFT import.');ids.add(a[0]);s.assets.push(asset(a[0],a[1]));break;}
      case 'demolish':{const b=(a[0]==='road'?s.roads:s.buildings).find(b=>b.x===a[1]&&b.y===a[2]&&(a[0]==='road'||b.type===a[0]));ok=!!b&&!!demolishOrdinary(s,b);break;}
      case 'enable':{const b=s.buildings.find(b=>a[0]?b.assetId===a[0]:b.x===a[1]&&b.y===a[2]);ok=!!b&&enableFacility(s,b,a[3]);break;}
      case 'assetEnable':ok=setAssetEnabled(s,...a);break;
      case 'recall':ok=recallAsset(s,a[0]);break;
      case 'deliver':{if(!integer(a[1],initial.createdAt,now+5000))fail('Invalid delivery clock.');s.selectedOrder=a[0];ok=startDelivery(s,a[1]);break;}
      case 'start':{
        if(!integer(a[1],lastTime,now+5000)||!integer(a[2],1,Number.MAX_SAFE_INTEGER))fail('Invalid challenge clock.');
        latestNonce=a[2];postStartTicks=0;lastTime=a[1];
        s.chainAttempt={nonce:a[2]};ok=a[3]?retryDailyChallenge(s,a[1]):startDailyChallenge(s,a[0],a[1]);
        if(ok&&attempt&&a[2]===attempt.nonce){
          if(a[1]<attempt.startedAt*1000-5000||a[1]>attempt.startedAt*1000+120000||s.daily.challenge.stage!==attempt.stage)fail('Challenge does not match the chain attempt.');
          s.daily.challenge.endsAt=Math.min(s.daily.challenge.endsAt,attempt.endsAt*1000);
        }
        break;
      }
      case 'claim':ok=claimReward(s,a[0]);break;
      case 'research':ok=buyResearch(s,a[0]);break;
      case 'accept':ok=acceptContract(s,a[0]);break;
      case 'fulfill':ok=!!fulfillContract(s,a[0]);break;
      case 'abandon':ok=abandonContract(s);break;
      case 'refresh':ok=refreshContracts(s);break;
      case 'achievement':ok=claimAchievement(s,a[0]);break;
      case 'weather':setWeather(s,a[0]);break;
      case 'automation':s.preferences.automation??={};s.preferences.automation.enabled=!!a[0];break;
      case 'balance':s.preferences.automation??={};s.preferences.automation.balanceProduction=!!a[0];break;
      default:fail('Unsupported action in the game trace.');
    }
    if(!ok)fail(`The ${event.op} action is not valid for this farm.`);
  }
  if(forReward){
    const view=challengeView(s,lastTime),completedAt=s.daily.challenge?.completedAt;
    if(!attempt||latestNonce!==attempt.nonce||view.status!=='completed'||view.stage!==attempt.stage||keccak256(toUtf8Bytes(initial.roundId))!==attempt.roundId||!completedAt||completedAt>attempt.endsAt*1000||completedAt>now+5000)fail('Replay has not completed the active on-chain challenge.');
    const allowedSeconds=Math.max(0,Math.floor((Math.min(now,attempt.endsAt*1000)-attempt.startedAt*1000)/1000));
    if(postStartTicks>allowedSeconds+2)fail('Game ticks ran faster than the real challenge clock.');
    const quote=rewardQuote(s),bonusMask=quote.bonuses.reduce((mask,q)=>mask|(1<<QUESTS.findIndex(x=>x.id===q.id)),0)&~questMask;
    return {state:s,completedAt:Math.floor(completedAt/1000),bonusMask,careerHash:careerDigest(s.village)};
  }
  return {state:s,careerHash:careerDigest(s.village)};
}
