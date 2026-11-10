import {Contract,JsonRpcProvider,Wallet,verifyTypedData} from 'ethers';
import {CHAIN_CONFIG as config} from '../dist/chain-config.mjs';
import {CATALOG} from '../dist/rules.mjs';
import {replayFarm,careerDigest,ProofError} from './replay.mjs';
import {domain,checkpointTypes,rewardTypes} from './signatures.mjs';
import {ASSETS} from './generated-assets.mjs';
import {readRpc} from './rpc.mjs';

const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const limits=new Map();
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health')return reply({ok:true,network:'sepolia',chainId:11155111,game:config.game,tom:config.tom,rewardVerification:'deterministic-replay',signerConfigured:!!env.MEADOW_REWARD_SIGNER_KEY});
  if(url.pathname==='/api/rpc'){
    const bucket=Math.floor(Date.now()/15000),key=`rpc:${request.headers.get('cf-connecting-ip')||'local'}:${bucket}`;
    for(const [k,v]of limits)if(v.bucket<bucket-1)limits.delete(k);
    const rate=limits.get(key)||{bucket,count:0};limits.set(key,rate);
    if(++rate.count>80)return reply({error:'Read limit reached. Retry shortly.'},429);
    return readRpc(request,config,env.MEADOW_RPC_URL||config.publicRpc);
  }
  if(url.pathname==='/api/replay'){
    if(request.method!=='POST')return reply({error:'POST required.'},405);
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return reply({error:'Same-origin request required.'},403);
    const ip=request.headers.get('cf-connecting-ip')||'local',bucket=Math.floor(Date.now()/15000),key=`${ip}:${bucket}`;
    for(const [k,v]of limits)if(v.bucket<bucket-1)limits.delete(k);
    const rate=limits.get(key)||{bucket,count:0};limits.set(key,rate);if(++rate.count>8)return reply({error:'Please wait a few seconds before retrying.'},429);
    if(Number(request.headers.get('content-length')||0)>1000000)return reply({error:'Trace too large. Start a fresh round.'},413);
    let provider;
    try{
      if(!env.MEADOW_REWARD_SIGNER_KEY)return reply({error:'Reward verifier is not configured.'},503);
      const bodyText=await request.text();if(bodyText.length>1000000)return reply({error:'Trace too large.'},413);
      const body=JSON.parse(bodyText);if(!/^0x[\da-f]{40}$/i.test(body.player))return reply({error:'Invalid wallet address.'},400);
      const signer=new Wallet(env.MEADOW_REWARD_SIGNER_KEY);if(signer.address.toLowerCase()!==config.rewardSigner.toLowerCase())return reply({error:'Reward signer configuration mismatch.'},503);
      let initialCareer=null;
      const checkpoint=body.proof?.initial?.checkpoint;
      if(checkpoint){
        const value={player:body.player,careerHash:careerDigest(checkpoint.village),issuedAt:checkpoint.issuedAt};
        if(verifyTypedData(domain(config),checkpointTypes,value,checkpoint.signature).toLowerCase()!==signer.address.toLowerCase())return reply({error:'Invalid saved career signature.'},400);
        initialCareer=checkpoint.village;
      }
      provider=new JsonRpcProvider(env.MEADOW_RPC_URL||config.publicRpc,11155111,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});
      const game=new Contract(config.game,config.gameAbi,provider),player=body.player.toLowerCase();
      const day=await game.dayNow();const [owned,count,mask,a]=await Promise.all([game.ownedAssets(player),game.claimedStages(player,day),game.claimedQuestMask(player),game.attempts(player)]);
      const ownedAssets=Array.from(owned[0],(id,i)=>({id:`NFT-CHAIN-${id}`,modelId:CATALOG[Number(owned[1][i])]?.id,listingPrice:Number(owned[2][i]/10n**18n)}));
      const attempt={day:Number(a.day),startedAt:Number(a.startedAt),endsAt:Number(a.endsAt),nonce:Number(a.nonce),stage:Number(a.stage),roundId:a.roundId};
      const forReward=body.mode==='reward';
      if(forReward&&(attempt.day!==Number(day)||attempt.stage!==Number(count)+1))return reply({error:'The on-chain stage changed. Refresh the wallet before trying again.'},409);
      const result=replayFarm({player,proof:body.proof,ownedAssets,claimedStages:Number(count),questMask:Number(mask),attempt,now:Date.now(),initialCareer,forReward});
      const issuedAt=Math.floor(Date.now()/1000),saved={player,careerHash:result.careerHash,issuedAt};
      const nextCheckpoint={village:result.state.village,issuedAt,signature:await signer.signTypedData(domain(config),checkpointTypes,saved)};
      if(!forReward)return reply({checkpoint:nextCheckpoint});
      const reward={player,day:attempt.day,stage:attempt.stage,nonce:attempt.nonce,bonusMask:result.bonusMask,completedAt:result.completedAt,roundId:attempt.roundId,careerHash:result.careerHash};
      return reply({reward,signature:await signer.signTypedData(domain(config),rewardTypes,reward),checkpoint:nextCheckpoint});
    }catch(error){return reply({error:error instanceof ProofError?error.message:'Verification did not complete. Check Sepolia connectivity and try again.'},error instanceof ProofError?400:503);}
    finally{provider?.destroy();}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return reply({error:'Method not allowed.'},405);
  const path=url.pathname==='/'?'/index.html':url.pathname,asset=ASSETS[path];
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':path.endsWith('.html')?'no-cache':'public, max-age=3600'}});
}};
