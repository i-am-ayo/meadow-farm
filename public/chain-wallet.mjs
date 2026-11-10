import {BrowserProvider,JsonRpcProvider,Contract,formatEther,parseEther,keccak256,toUtf8Bytes} from './vendor/ethers.mjs';
import {CHAIN_CONFIG as config} from './chain-config.mjs';
import {newFarmAccount,CATALOG,CHALLENGES,QUESTS,normalizeState,claimReward} from './rules.mjs?v=8.1';
import {today} from './daily-challenge.mjs?v=8.1';
import {enableTrace,trace} from './trace.mjs?v=8.1';
import {domUpdates as dom} from './dom-updates.mjs?v=8.1';
import {assertWallet,ensureSepolia,discoverWallets,walletError,SEPOLIA_CHAIN} from './wallet-provider.mjs?v=8.1';

const $=s=>document.querySelector(s),text=(zh,en)=>document.documentElement.lang==='en'?en:zh;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=address=>address?`${address.slice(0,6)}…${address.slice(-4)}`:'';
const nftNumber=id=>BigInt(String(id).replace(/^NFT-CHAIN-/,''));
const nativeAmount=value=>Math.floor(Number(formatEther(value))*1e6)/1e6;
const local=['127.0.0.1','localhost','::1'].includes(location.hostname);
const walletKey=address=>`meadow-farm-world-v6:sepolia:${address.toLowerCase()}`;

export function mountChainWallet(hooks){
  const getWallets=discoverWallets();
  let address='',injected,browserProvider,epoch=0,busy=false,snapshot=null,dialogOpen=false,errorText='',txHash='',refreshing=false;
  let demo=local,marketData=[],totalMinted=0;
  const rpc=new JsonRpcProvider(new URL('/api/rpc',location.href).href,11155111,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});
  const readGame=new Contract(config.game,config.gameAbi,rpc),readToken=new Contract(config.tom,config.tokenAbi,rpc);
  const demoWorld=hooks.getWorld(),demoAction=$('#wallet').onclick;
  const badge=document.createElement('button');badge.id='chain-network';badge.dataset.i18nIgnore='';$('.wallet').prepend(badge);badge.onclick=open;
  $('#wallet').onclick=open;
  $('#modal').addEventListener('close',()=>dialogOpen=false);
  const current=()=>hooks.getState();
  const active=()=>!demo;
  const notify=message=>{errorText=message;hooks.notify(message);render();if(dialogOpen)open();};
  function guest(){const s=newFarmAccount('guest');s.token=0;return {active:'guest',accounts:{guest:s},activity:[]};}
  if(!local){let world;try{world=JSON.parse(localStorage.getItem('meadow-farm-world-v6:guest'));}catch{}hooks.switchWorld(world?.accounts?.guest?world:guest(),'meadow-farm-world-v6:guest');}
  function syncAssets(s,assets){
    const previous=new Map(s.assets.map(a=>[a.id,a])),next=[];
    for(const fresh of assets){let asset=previous.get(fresh.id);
      if(!asset){asset={...fresh,enabled:true,totalProduced:0};if(s.proof)trace(s,'asset',[asset.id,asset.modelId]);}
      asset.modelId=fresh.modelId;if(fresh.listingPrice)asset.listingPrice=fresh.listingPrice;else delete asset.listingPrice;next.push(asset);
    }
    const held=new Set(next.filter(a=>!a.listingPrice).map(a=>a.id));
    if(s.proof){const imported=[...s.proof.initial.assets.map(a=>a.id),...s.proof.events.filter(e=>e.op==='asset').map(e=>e.args[0])];const nextIds=new Set(next.map(a=>a.id));if(imported.some(id=>!nextIds.has(id))||s.proof.events.some(e=>e.op==='place'&&!held.has(e.args[0])))s.proof.invalidReason='NFT ownership or listing changed. Start a new round for on-chain rewards.';}
    for(const b of s.buildings)if(b.assetId&&!held.has(b.assetId)&&s.proof)s.proof.invalidReason='NFT ownership or listing changed. Start a new round for on-chain rewards.';
    s.assets=next;s.buildings=s.buildings.filter(b=>!b.assetId||held.has(b.assetId));
  }
  function syncLedger(s,count,mask){
    if(s.daily?.date!==today())s.daily={version:2,date:today(),deliveries:0,stageClaims:[],challenge:null,attempts:0};
    if((s.daily.stageClaims?.length||0)!==count){s.daily.stageClaims=CHALLENGES.slice(0,count).map(p=>({stage:p.stage,planId:p.id,reward:p.reward,onchain:true}));s.daily.challenge=null;}
    s.daily.claimed=count===5;s.questsClaimed=QUESTS.filter((_,i)=>(mask&(1<<i))!==0).map(q=>q.id);
  }
  async function readWallet(who,provider=rpc){
    const game=new Contract(config.game,config.gameAbi,provider),token=new Contract(config.tom,config.tokenAbi,provider),day=await game.dayNow();
    const [balance,assets,count,mask,faucet,attempt,eth]=await Promise.all([token.balanceOf(who),game.ownedAssets(who),game.claimedStages(who,day),game.claimedQuestMask(who),game.faucetClaimed(who),game.attempts(who),provider.getBalance(who)]);
    return {balance:nativeAmount(balance),eth:formatEther(eth),claimed:Number(count),questMask:Number(mask),faucet,assets:Array.from(assets[0],(id,i)=>({id:`NFT-CHAIN-${id}`,modelId:CATALOG[Number(assets[1][i])].id,paid:CATALOG[Number(assets[1][i])].price,...(assets[2][i]>0n?{listingPrice:nativeAmount(assets[2][i])}:{})})),attempt:{nonce:Number(attempt.nonce),day:Number(attempt.day),stage:Number(attempt.stage),startedAt:Number(attempt.startedAt),endsAt:Number(attempt.endsAt),roundId:attempt.roundId}};
  }
  async function refreshMarket(){
    try{
      const total=Number(await readGame.totalMinted()),entries=[];totalMinted=total;
      for(let offset=0;offset<Math.min(total,2000);offset+=100){const values=await readGame.listings(offset,100);for(let i=0;i<values[0].length;i++)entries.push({owner:values[1][i].toLowerCase(),asset:{id:`NFT-CHAIN-${values[0][i]}`,modelId:CATALOG[Number(values[2][i])].id,listingPrice:nativeAmount(values[3][i]),enabled:true},model:CATALOG[Number(values[2][i])]});}
      if(address)for(const asset of current().assets)if(!entries.some(e=>e.asset.id===asset.id))entries.push({owner:address,asset,model:CATALOG.find(m=>m.id===asset.modelId)});
      marketData=entries;hooks.marketUpdated?.();
    }catch{notify(text('链上市场暂时无法读取，请稍后刷新。','The on-chain market is unavailable. Please refresh shortly.'));}
  }
  async function refresh(){
    if(!address||refreshing)return;const who=address,session=epoch;refreshing=true;
    try{const data=await readWallet(who,browserProvider||rpc);if(session!==epoch||who!==address)return;snapshot=data;
      const s=current();s.token=data.balance;syncAssets(s,data.assets);syncLedger(s,data.claimed,data.questMask);hooks.refresh();
    }catch{notify(text('钱包已连接，但链上数据未能刷新。请检查 Sepolia 网络。','Connected, but chain data could not refresh. Check Sepolia.'));}
    finally{refreshing=false;render();}
  }
  async function activate(who){
    const session=++epoch;who=who.toLowerCase();const data=await readWallet(who,browserProvider);if(session!==epoch)return;
    let world;try{world=JSON.parse(localStorage.getItem(walletKey(who)));}catch{}
    if(!world?.accounts?.[who]){const s=newFarmAccount(who);s.token=data.balance;s.assets=data.assets.map(a=>({...a,enabled:true,totalProduced:0}));syncLedger(s,data.claimed,data.questMask);enableTrace(s);world={active:who,accounts:{[who]:s},activity:[]};}
    const s=normalizeState(world.accounts[who]);s.token=data.balance;syncAssets(s,data.assets);syncLedger(s,data.claimed,data.questMask);
    address=who;demo=false;snapshot=data;hooks.switchWorld(world,walletKey(who));localStorage.setItem('meadow-connected-wallet','injected');errorText='';render();await refreshMarket();
  }
  function bind(provider){
    if(injected===provider)return;injected=provider;browserProvider=new BrowserProvider(provider,'any');
    provider.on?.('accountsChanged',accounts=>{if(!accounts.length)disconnect();else activate(accounts[0]).catch(()=>notify(text('账户切换未完成，请重新连接钱包。','Account switch failed. Reconnect the wallet.')));});
    provider.on?.('chainChanged',chain=>{epoch++;if(chain!==SEPOLIA_CHAIN)notify(text('请切回 Ethereum Sepolia，链上操作已暂停。','Switch back to Ethereum Sepolia. Chain actions are paused.'));else refresh();});
    provider.on?.('disconnect',disconnect);
  }
  async function connect(index=0){
    if(busy)return;const wallet=getWallets()[index];if(!wallet)return open();busy=true;render();
    try{const accounts=await wallet.provider.request({method:'eth_requestAccounts'});await ensureSepolia(wallet.provider,config.publicRpc);bind(wallet.provider);await activate(accounts[0]);$('#modal').close();hooks.notify(text('已连接 Sepolia 钱包，显示此地址的农场与链上资产。','Connected to Sepolia. Showing this wallet’s farm and on-chain assets.'));}
    catch(e){notify(walletError(e));}finally{busy=false;render();}
  }
  function disconnect(){
    epoch++;address='';snapshot=null;browserProvider=null;demo=local;localStorage.removeItem('meadow-connected-wallet');
    if(local)hooks.switchWorld(demoWorld,'meadow-farm-world-v6');else{let world;try{world=JSON.parse(localStorage.getItem('meadow-farm-world-v6:guest'));}catch{}hooks.switchWorld(world?.accounts?.guest?world:guest(),'meadow-farm-world-v6:guest');}
    render();
  }
  async function send(method,args=[]){
    if(!address){open();throw Error(text('请先连接 MetaMask。','Connect MetaMask first.'));}
    if(busy)throw Error(text('已有一笔钱包操作正在进行。','A wallet operation is already in progress.'));
    const who=address,session=epoch;busy=true;errorText='';render();
    try{
      await assertWallet(injected,who);const signer=await browserProvider.getSigner(who),game=new Contract(config.game,config.gameAbi,signer),tx=await game[method](...args);
      txHash=tx.hash;render();hooks.notify(text('交易已提交，等待 Sepolia 确认。','Transaction sent. Waiting for Sepolia confirmation.'));
      const receipt=await tx.wait();if(receipt.status!==1)throw Error('Transaction reverted.');
      if(session!==epoch||who!==address)throw Error('Account changed while the transaction was pending.');await refresh();await refreshMarket();return receipt;
    }catch(e){errorText=e?.message?.includes('Account changed')?e.message:walletError(e);hooks.notify(errorText);throw Error(errorText);}
    finally{busy=false;render();}
  }
  async function proofRequest(mode){
    if(!address)throw Error(text('请先连接钱包。','Connect the wallet first.'));
    const s=current();if(!s.proof)throw Error(text('此农场没有验证记录，请新开一轮。','No verified trace exists for this farm. Start a new round.'));
    if(s.proof.invalidReason)throw Error(s.proof.invalidReason);
    const response=await fetch('/api/replay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,player:address,proof:s.proof})});
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error(text('请在公开测试版网址使用链上领奖；本地静态预览没有验证服务。','Use the public test website for chain rewards. This static preview has no verifier.'));
    const result=await response.json();if(!response.ok)throw Error(result.error||'Verification failed.');return result;
  }
  async function checkpoint(){
    if(!active()||!address)return;
    const s=current();if(!s.proof)return;
    if(s.proof.invalidReason&&s.proof.nextCheckpoint){s.village=structuredClone(s.proof.nextCheckpoint.village);return;}
    const result=await proofRequest('checkpoint');s.proof.nextCheckpoint=result.checkpoint;hooks.refresh();
  }
  async function begin(){
    if(!active())return;
    if(!address){open();throw Error(text('连接钱包后才能开始链上挑战。','Connect a wallet to start an on-chain challenge.'));}
    const s=current();if(s.proof?.invalidReason)throw Error(s.proof.invalidReason);
    await send('beginChallenge',[keccak256(toUtf8Bytes(s.round.id))]);if(current()!==s)throw Error('Account changed.');
    s.chainAttempt=snapshot.attempt;hooks.refresh();
  }
  async function claim(){
    const s=current();const result=await proofRequest('reward');if(current()!==s)throw Error('Account changed.');
    await send('claimReward',[result.reward,result.signature]);
    // The chain refresh already advanced the ledger. Replaying the local claim
    // is unnecessary and would double-credit TOM; record only settled metadata.
    s.round.rewardClaimed=true;s.daily.challenge=null;s.proof.nextCheckpoint=result.checkpoint;
    s.proof.settled=true;hooks.refresh();hooks.notify(text('链上 TOM 奖励已到账。','On-chain TOM reward received.'));
  }
  function render(){
    dom.text(badge,demo?text('本地体验','Local demo'):busy?text('Sepolia · 确认中','Sepolia · pending'):'Sepolia');
    dom.attribute(badge,'data-connected',String(!!address));dom.attribute(badge,'aria-label',text('网络与钱包状态','Network and wallet status'));
    dom.text($('#wallet'),address?short(address):text('连接 MetaMask','Connect MetaMask'));
    dom.property($('#wallet'),'title',address||text('使用 MetaMask 连接 Ethereum Sepolia','Connect to Ethereum Sepolia with MetaMask'));
  }
  function open(){
    dialogOpen=true;const wallets=getWallets();
    const links=`<div class="chain-links"><a href="${config.explorer}/address/${config.tom}" target="_blank" rel="noopener">TOM ↗</a><a href="${config.explorer}/address/${config.game}" target="_blank" rel="noopener">NFT / ${text('游戏合约','Game contract')} ↗</a><a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener">${text('领取测试 ETH','Get test ETH')} ↗</a></div>`;
    const body=address?`<h1>${text('你的链上农场','Your on-chain farm')}</h1><p class="chain-address">${address}</p><div class="chain-balances"><b>${snapshot?.balance??0}<small>TOM</small></b><b>${current().assets.length}<small>NFT</small></b><b>${Number(snapshot?.eth||0).toFixed(5)}<small>Sepolia ETH</small></b></div><p>${text('NFT 与 TOM 从 Sepolia 读取。经营币与地图生产在浏览器运行，农场进度按钱包地址保存在此浏览器。阶段奖励通过服务端规则重放验证，再由钱包提交链上领取。','NFTs and TOM are read from Sepolia. Farm coins and production run in the browser; saves are stored here per wallet address. Stage rewards require server-side replay verification and an on-chain wallet transaction.')}</p><div class="chain-actions">${!snapshot?.faucet?`<button id="chain-faucet" class="primary" ${busy?'disabled':''}>${text('领取 200 测试 TOM','Claim 200 test TOM')}</button>`:`<span>${text('测试 TOM 已领取','Test TOM already claimed')}</span>`}<button id="chain-refresh" ${busy?'disabled':''}>${text('刷新链上资产','Refresh chain assets')}</button><button id="chain-import-token">${text('在钱包中显示 TOM','Show TOM in wallet')}</button><button id="chain-disconnect" ${busy?'disabled':''}>${text('断开连接','Disconnect')}</button></div>`:
      `<h1>${text('连接钱包，经营你的小镇','Connect your wallet, grow your town')}</h1><p>${text('使用 MetaMask 连接 Ethereum Sepolia 测试网。首次连接后，可以领取一次 200 测试 TOM，用于购买建筑 NFT。链上操作需要少量 Sepolia 测试 ETH 支付 Gas。','Connect MetaMask to Ethereum Sepolia. Claim 200 test TOM once to buy building NFTs. On-chain transactions need a small amount of Sepolia test ETH for gas.')}</p><div class="chain-actions">${wallets.map((w,i)=>`<button class="primary" data-connect-wallet="${i}" ${busy?'disabled':''}>${text('连接','Connect')} ${esc(w.name)}</button>`).join('')||`<p>${text('此浏览器未检测到钱包。请在安装 MetaMask 的 Chrome / Edge 中打开本网址，或使用 MetaMask 手机应用内的浏览器。','No wallet was detected. Open this site in Chrome / Edge with MetaMask installed, or in the MetaMask mobile browser.')}</p><a href="https://metamask.io/download/" target="_blank" rel="noopener">${text('安装 MetaMask','Install MetaMask')} ↗</a>`}${local?`<button id="chain-demo">${text('本地体验账户','Local demo accounts')}</button>`:''}</div>`;
    hooks.dialog(`<div class="chain-dialog" data-i18n-ignore><div class="eyebrow">ETHEREUM SEPOLIA · TESTNET</div>${body}${errorText?`<p class="chain-error" role="status">${esc(errorText)}</p>`:''}${txHash?`<p><a href="${config.explorer}/tx/${txHash}" target="_blank" rel="noopener">${text('查看最近交易','View latest transaction')} ↗</a></p>`:''}${links}</div>`);
    document.querySelectorAll('[data-connect-wallet]').forEach(b=>b.onclick=()=>connect(Number(b.dataset.connectWallet)));
    if($('#chain-faucet'))$('#chain-faucet').onclick=()=>send('faucet').then(open).catch(()=>open());
    if($('#chain-refresh'))$('#chain-refresh').onclick=()=>refresh().then(open);
    if($('#chain-disconnect'))$('#chain-disconnect').onclick=()=>{disconnect();open();};
    if($('#chain-import-token'))$('#chain-import-token').onclick=async()=>{try{await injected.request({method:'wallet_watchAsset',params:{type:'ERC20',options:{address:config.tom,symbol:'TOM',decimals:18}}});}catch(e){notify(walletError(e));}};
    if($('#chain-demo'))$('#chain-demo').onclick=()=>{demo=true;address='';hooks.switchWorld(demoWorld,'meadow-farm-world-v6');$('#modal').close();demoAction();};
  }
  document.addEventListener('languagechange',()=>{render();if(dialogOpen)open();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&address)refresh();});
  setInterval(()=>{if(!document.hidden&&address&&!busy)refresh();},20000);
  setTimeout(async()=>{await refreshMarket();if(localStorage.getItem('meadow-connected-wallet')==='injected'){const w=getWallets()[0];if(w)try{const [accounts,chain]=await Promise.all([w.provider.request({method:'eth_accounts'}),w.provider.request({method:'eth_chainId'})]);if(accounts.length&&chain===SEPOLIA_CHAIN){bind(w.provider);await activate(accounts[0]);}}catch{}}},0);
  render();
  return {render,open,refresh,refreshMarket,checkpoint,begin,claim,get active(){return active();},get connected(){return !!address;},get address(){return address;},get assets(){return marketData;},get busy(){return busy;},get totalMinted(){return totalMinted;},get connectLabel(){return text('连接钱包购买','Connect wallet to buy');},
    async buy(modelId){const model=CATALOG.find(m=>m.id===modelId);if(!model)throw Error('Unknown model.');const before=new Set(current().assets.map(a=>a.id));await send('buyBuilding',[CATALOG.indexOf(model),parseEther(String(model.price))]);return current().assets.find(a=>!before.has(a.id)&&a.modelId===modelId);},
    async list(id,price){await checkpoint();await send('list',[nftNumber(id),parseEther(String(price))]);},
    async buyListing(id,price){await send('buyListing',[nftNumber(id),parseEther(String(price))]);},
    async cancelListing(id){await send('cancelListing',[nftNumber(id)]);}
  };
}
