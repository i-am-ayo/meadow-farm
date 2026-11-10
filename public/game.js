import {mountChainWallet} from './chain-wallet.mjs?v=8.1';
import {enableFacility,recallAsset} from './trace.mjs?v=8.1';
import {mountFarmShell} from './farm-shell.mjs?v=8.1';
import {mountVillage} from './village-ui.mjs?v=8.1';
import {renderPixelRatio,createLayerCache,createSpriteCache} from './render-cache.mjs?v=8.1';
import {createRenderProbe} from './render-probe.mjs?v=8.1';
import {domUpdates as dom} from './dom-updates.mjs?v=8.1';
import {treeGrowth} from './forestry.mjs?v=8.1';
import {mountFarmExperience} from './farm-experience.mjs?v=8.1';
import {createFarmAudio} from './farm-audio.mjs?v=8.1';
import {createFarmEffects} from './farm-effects.mjs?v=8.1';
import {preferences,runAutomation} from './farm-assistant.mjs?v=8.1';
import {roundLayoutQuote,startNewRound} from './round-layout.mjs?v=8.1';
import {createLanguageUI} from './locale-ui.mjs?v=8.1';
import {translate,searchMatches} from './i18n.mjs?v=8.1';
import {challengeEntry} from './challenge-entry.mjs?v=8.1';
import {CURRENCY,displayNftId} from './economy.mjs?v=8.1';
import {ORDINARY_GRADES,ORDINARY_GROUPS} from './ordinary.mjs?v=8.1';
import {CARGO_COLORS} from './hauling.mjs?v=8.1';
import {isStorage,storageKey,storageOverview} from './storage.mjs?v=8.1';
import {sampleTruck,deliveryStage} from './transport.mjs?v=8.1';
import {assetArt} from './asset-art.mjs?v=8.1';
import {CATALOG,TIERS,TYPE_NAMES,TYPE_ICONS,BASIC_BUILDINGS,RESOURCE_NAMES,RESOURCE_ICONS,activeHaulers,haulerSnapshot,sampleHaulers,withFarmRead,ownerFor,ORDINARY_MODELS,ordinaryItem,ordinaryShopItems,buildOrdinary,inputText,warehouseStock,demolitionQuote,demolishOrdinary,retryDailyChallenge,newFarmAccount,upgradeRoundEconomy,restartFarm,rewardQuote,modelFor,mint,normalizeState,dailyState,layout,productionInfo,tick,purchase,canPlace,canPlaceRoad,placeAsset,startDelivery,claimReward,goodsText,listAsset,transferListing,TOOL_TYPES,ORDERS,QUESTS,isDay,capacity,effectText,summaryText,selectedOrder,claimQuest,setAssetEnabled,MAP_SIZE,MAP_CENTER,RIVER_COLUMN,CHALLENGES,ROUND_CASH,applySupportGrant,challengeView,dailyCleared,challengeReadiness,startDailyChallenge} from './rules.mjs?v=8.1';
const SAVE_KEY='meadow-farm-world-v6';let activeSaveKey=SAVE_KEY;
const $=s=>document.querySelector(s),canvas=$('#scene'),mainContext=canvas.getContext('2d');
let ctx=mainContext;const renderProbe=createRenderProbe(),terrainCache=createLayerCache(),fenceCache=createLayerCache(),spriteCache=createSpriteCache();
const languageUI=createLanguageUI();
const localize=value=>translate(value,languageUI.getLanguage());
const initial=()=>newFarmAccount();
let state;try{state=JSON.parse(localStorage.getItem('net-meadow-v1'));if(!state||!Array.isArray(state.buildings))state=initial()}catch{state=initial()}
state=normalizeState(state);
let world;try{world=JSON.parse(localStorage.getItem(SAVE_KEY)||localStorage.getItem('meadow-farm-world-v5')||localStorage.getItem('meadow-farm-world-v4')||localStorage.getItem('meadow-farm-world-v3')||localStorage.getItem('net-meadow-world-v2'))}catch{}
if(!world?.accounts?.A||!world?.accounts?.B){
 state.accountId='A';const second=newFarmAccount('B');
 const spring=mint(second,'well-spring'),mill=mint(second,'mill-breeze');spring.listingPrice=40;mill.listingPrice=80;
 world={active:'A',accounts:{A:state,B:second},activity:[],initializedAt:new Date().toISOString()};
}
for(const [id,account]of Object.entries(world.accounts)){account.accountId=id;normalizeState(account);upgradeRoundEconomy(account);applySupportGrant(account)}
if(!world.accounts[world.active])world.active='A';state=world.accounts[world.active];
let exchangeFilters={type:'all',tier:'all',min:'',max:'',q:'',sort:'price-low',favorites:false};
let marketActive=false;
let frameTime=null,simAccumulator=0,animationSeconds=state.seconds,challengeUiSecond=-1;

const types=BASIC_BUILDINGS;
let build=null,hover=null,zoom=1.25,rotation=0,paused=false,W=0,H=0,tile=38,origin={x:0,y:0},pan={x:0,y:0},toastTimer,selectedBuilding=null;
let placementAssetId=null,placementOrdinaryKey=null,marketView='catalog',marketFilter='all';
let shopFilters={group:'all',grade:'all',q:'',types:[]};
let warehouseMarkers=[],experience,villageExperience,farmShell,chainWallet,haulerJobs=[],uiHaulers=[],mapTopology='',visibleScenery=[],sceneRevision=0,pixelRatio=1,lastPaint=-Infinity,lastPaintKey='',sceneVisible=true,lastMarkerKey='';
const audio=createFarmAudio(()=>preferences(state),()=>isDay(state)),effects=createFarmEffects();
let saveTimer=null;
function save(defer=false){
 if(defer){if(saveTimer===null)saveTimer=setTimeout(()=>save(),3000);return}
 clearTimeout(saveTimer);saveTimer=null;try{localStorage.setItem(activeSaveKey,JSON.stringify(world))}catch{}
}
function toast(text){dom.text($('#toast'),text);$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}
function ui(deferSave=false){return withFarmRead(state,()=>refreshUI(deferSave))}
function refreshUI(deferSave){
 sceneRevision++;haulerJobs=haulerSnapshot(state);uiHaulers=sampleHaulers(haulerJobs);refreshMapTopology();
 dom.text($('#token-symbol'),CURRENCY.name);
 dom.text($('#wallet'),`农场主 ${world.active} ↗`);
 ['token','cash','stars',...Object.keys(RESOURCE_NAMES)].forEach(k=>dom.text($('#'+k),state[k]));
 const processed=warehouseStock(state);
 dom.text($('#capacity'),capacity(state,'wheat')?`${state.wheat} / ${capacity(state,'wheat')} 粮仓`:'粮仓未接通');
 dom.text($('#storecapacity'),capacity(state,'flour')?`${processed} / ${capacity(state,'flour')} 加工仓`:'加工仓未接通');
 dom.text($('#watercap'),capacity(state,'water'));dom.text($('#energycap'),capacity(state,'energy'));
 $('#storagefill').style.width=Math.min(100,(state.wheat+processed)/Math.max(1,capacity(state,'wheat')+capacity(state,'flour'))*100)+'%';
 dom.text($('#day'),1+Math.floor(state.seconds/180));dom.text($('#skytext'),isDay(state)?'☀ 白天':'☾ 夜晚');
 dom.text($('#dayphase'),isDay(state)?`${120-state.seconds%180} 秒后入夜`:`${180-state.seconds%180} 秒后天亮`);
 const order=selectedOrder(state);dom.text($('#ordercount'),state[order.resource]+' / '+order.amount);
 dom.text($('#ordertitle'),order.name);dom.text($('#orderdesc'),order.desc);dom.html($('#orderart'),order.icon+'<span>☁</span>');
 dom.text($('#orderrequire'),`${order.icon} ${RESOURCE_NAMES[order.resource]} × ${order.amount}`);
 dom.html($('#orderreward'),`◈ ${order.cash} 经营币 <small>＋ ${order.stars} 星星</small>`);
 dom.property($('#deliver'),'disabled',!!state.delivery||state[order.resource]<order.amount);
 dom.text($('#deliver'),state.delivery?`${{loading:'装车出发',outbound:'驶向集市',away:'集市交货',returning:'货车返程',parking:'货车归位'}[deliveryStage(state.delivery,state.seconds)]} · ${Math.max(0,state.delivery.arrives-state.seconds)} 秒`:(state[order.resource]>=order.amount?'装车出售  ↗':'准备产品中…'));
 document.querySelectorAll('[data-order]').forEach(b=>b.classList.toggle('active',b.dataset.order===order.id));
 dom.text($('.orderfoot'),state.delivery?'货车正在往返途中，回到货运站后结算收入':'货车已归位，可装载下一批产品');
 renderRewardPanels();renderCargoFlow();renderWarehouseStatuses();
 dom.text($('#assetcount'),state.assets.length);dom.text($('#assetvalue'),state.assets.reduce((n,a)=>n+(CATALOG.find(m=>m.id===a.modelId)?.price||0),0));
 if($('#nft-available'))dom.text($('#nft-available'),`${state.assets.filter(a=>!a.listingPrice&&!state.buildings.some(b=>b.assetId===a.id)).length} / ${state.assets.length} 件可放置 ↗`);
 dom.text($('#placedcount'),state.buildings.filter(b=>b.assetId).length);
 if(selectedBuilding)renderSelection();if(marketActive)refreshMarketStats();experience?.render();villageExperience?.render();farmShell?.render();chainWallet?.render();save(deferSave);
}
const clockText=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
function renderRewardPanels(){
 const v=challengeView(state),quote=rewardQuote(state),labels={ready:'待开始',active:'阶段进行中',completed:'限时达标',expired:'可重试',claimed:'今日全部完成'};
 challengeUiSecond=Math.floor(Date.now()/1000);const panel=$('.dailychallenge');panel.dataset.state=v.status;panel.classList.toggle('urgent',v.status==='active'&&v.remaining<=60);
 const stagePanel=$('#daily-stages'),stageKey=v.stages.map(p=>p.status).join(',');
 if(stagePanel.dataset.progress!==stageKey){stagePanel.dataset.progress=stageKey;
  dom.html(stagePanel,v.stages.map(p=>`<button data-stage-preview="${p.stage}" data-status="${p.status}" aria-label="第 ${p.stage} 阶段 ${p.name}，${p.reward} TOM，${{claimed:'已领奖',current:'当前阶段',locked:'待解锁'}[p.status]}"><b>${p.status==='claimed'?'✓':p.stage}</b><span>${p.reward}<small> TOM</small></span></button>`).join(''));
 document.querySelectorAll('[data-stage-preview]').forEach(b=>b.onclick=()=>previewDailyStages(Number(b.dataset.stagePreview)));
 }
 dom.text($('#stage-earned'),`今日已领 ${v.stageClaims.length} / ${v.totalStages} 阶段 · 基础奖励 ${v.earned} TOM`);
 dom.text($('#challenge-stage-label'),v.status==='claimed'?'五阶段已全部完成':`第 ${v.stage} 阶段 · ${v.plan.name}`);
 dom.text($('#challenge-status'),v.needsRebuild?'需新开局':labels[v.status]);dom.text($('#challenge-timer'),v.status==='claimed'?'已通关':v.needsRebuild?'待建设':v.status==='completed'?'已达标':v.status==='expired'?'00:00':clockText(v.remaining));
 dom.text($('#challenge-clocklabel'),v.status==='claimed'?'明日 00:00 开启新一轮阶段':v.needsRebuild?'领取新奖励需重新建设':v.status==='completed'?'用时 '+clockText(v.elapsed):v.status==='expired'?'保留建设，可重试本阶段':v.status==='ready'?'准备时间不限，确认后才计时':`第 ${v.attempts||1} 次尝试 · 剩余时间`);
 dom.text($('#challenge-reward'),v.status==='claimed'?v.earned+' TOM 已领':v.plan.reward+' '+CURRENCY.symbol+(quote.bonus?' ＋ '+quote.bonus+' 委托奖励':''));
 const rs=$('#round-status');if(rs)dom.text(rs,state.round?.legacy?'旧农场 · 新领奖需重开建设':`第 ${state.roundSerial} 轮 · ${state.round?.builds||0} 次建设${state.round?.rewardClaimed?' · 阶段奖励已结算':''}`);
 dom.html($('#challenge-goals'),v.status==='claimed'?'<p class="stage-finished">✓ 今日五笔基础奖励均已到账</p>':v.goals.map(g=>`<div class="challengegoal ${g.value>=g.target?'done':''}"><span>${g.value>=g.target?'✓':'○'} ${g.label}</span><b>${Math.min(g.target,g.value)} / ${g.target}</b></div>`).join(''));
 dom.property($('#retrychallenge'),'hidden',v.needsRebuild||!['active','expired'].includes(v.status));
 const readiness=challengeReadiness(state,v.plan.id);
 dom.text($('#challenge-help'),v.status==='claimed'?'今日五阶段已全部完成，TOM 已保留。明天从第一阶段重新开始，新的领奖需要新开局建设。':v.needsRebuild?'每笔新奖励都需重新建设。新开局后挑战当前阶段，今天已领奖励、TOM 和 NFT 保留。':v.status==='ready'?(!v.canFitToday?'今日剩余时间不足一个完整阶段，请明天再来。':readiness.ready?v.plan.tip:'用经营币购买普通设施，或放置持有的 NFT；需接通：'+readiness.missing.join('、')):v.status==='active'?'只计本次开始后的生产与回站交付。未完成可保留建设重试，不影响已领阶段奖励。':v.status==='completed'?'限时达标！可领取本阶段奖励，领取后解锁下一阶段。':'可以重新挑战本阶段。保留建设和库存，重置本次倒计时与目标进度。');
 dom.property($('#startchallenge'),'hidden',false);dom.property($('#startchallenge'),'disabled',false);dom.text($('#startchallenge'),v.status==='claimed'?'查看今日阶段与奖励':v.status==='active'?'查看本阶段进度':v.status==='completed'?'查看任务与奖励':'查看本阶段任务');dom.property($('#claim'),'hidden',v.needsRebuild||v.status==='ready'||v.status==='claimed');dom.property($('#claim'),'disabled',v.status!=='completed');dom.text($('#claim'),v.status==='expired'?'未完成，可重新挑战':v.status==='active'?'完成全部目标后领取':`领取第 ${v.stage} 阶段 · ${v.plan.reward+quote.bonus} ${CURRENCY.symbol}`);
 for(const q of QUESTS){const claimed=state.questsClaimed.includes(q.id),total=state.productionTotals[q.resource]||0;dom.text($('#questprogress-'+q.id),`${Math.min(q.target,total)} / ${q.target}`);const button=$('#quest-'+q.id);dom.property(button,'disabled',true);dom.text(button,claimed?'已结算 ✓':state.round?.rewardClaimed?'下轮再争取':total>=q.target?'随本阶段结算 +'+q.reward:'达成后 +'+q.reward+' TOM')}
}
function previewDailyStages(selected=challengeView(state).stage){
 const v=challengeView(state),p=v.stages.find(p=>p.stage===selected)||v.plan;
 dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">DAILY JOURNEY · FIVE STAGES</div><h1>每天，向前多走一步</h1><p>五阶段依次解锁，基础奖励共 <b>${CHALLENGES.reduce((n,p)=>n+p.reward,0)} TOM</b>。每阶段限领一次；领奖后新开局建设，继续下一阶段。已领的奖励永久保留。</p><div class="stage-roadmap">${v.stages.map(p=>`<button data-view-stage="${p.stage}" class="${p.stage===selected?'active':''}" data-status="${p.status}"><span>${p.status==='claimed'?'✓':p.stage}</span><div><b>${p.name}</b><small>${p.seconds/60} 分钟 · ${{claimed:'已领奖',current:'当前阶段',locked:'完成前序阶段解锁'}[p.status]}</small></div><strong>＋${p.reward}<small> TOM</small></strong></button>`).join('')}</div><section class="stage-detail"><h2>第 ${p.stage} 阶段 · ${p.name}</h2><div class="challenge-preview-goals">${p.goals.map(g=>`<p>○ ${g.label}</p>`).join('')}</div><p>${p.tip}</p><p>准备时间不限。先补齐设施、赚取经营币、备好原料，再主动开始计时。超时可保留建设重试。</p></section><button class="primary" id="stage-current-task">${v.status==='claimed'?'返回农场':`查看当前第 ${v.stage} 阶段任务`}</button>`);
 document.querySelectorAll('[data-view-stage]').forEach(b=>b.onclick=()=>previewDailyStages(Number(b.dataset.viewStage)));$('#stage-current-task').onclick=()=>{if(v.status==='claimed')modal.close();else previewDailyChallenge()};if(!modal.open)modal.showModal();
}
function previewDailyChallenge(){
 const entry=challengeEntry(state),v=entry.view;if(v.status==='claimed'){previewDailyStages();return}
 dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">DAILY TIME CHALLENGE</div><h1>第 ${v.stage} 阶段 · ${v.plan.name}</h1><p>时限 <b>${clockText(v.status==='active'?v.remaining:v.plan.seconds)}</b> · 基础奖励 <b>${v.plan.reward} ${CURRENCY.name}</b></p><div class="challenge-preview-goals">${v.goals.map(g=>`<p>${g.value>=g.target?'✓':'○'} ${g.label}${v.attempt?` <b>${Math.min(g.value,g.target)} / ${g.target}</b>`:''}</p>`).join('')}</div>${entry.issues.length?`<div class="challenge-missing" role="status">${entry.issues.map(i=>`<p>${i.text}</p>`).join('')}<div class="preparation-actions">${v.needsRebuild?'<button id="prepare-newround">查看新开局说明 ↗</button>':''}${!entry.readiness.ready?'<button id="prepare-shop">前往经营币设施商店 ↗</button>':''}</div></div>`:'<p class="challenge-ready">✓ 生产线已准备好，确认后才开始倒计时。</p>'}<p class="stage-tip">${v.plan.tip||'先准备好产线，再开始本阶段计时。'}</p><section class="challenge-checks"><h2>开始前的准备清单</h2>${entry.readiness.checks.map(c=>`<div class="preparation-check ${c.ready?'ready':'missing'}"><span>${c.ready?'✓':'○'}</span><div><b>${c.label}</b><small>${c.reason}</small>${!c.ready&&c.buildTypes?.length?`<button data-prepare-facility="${c.buildTypes.join(',')}">去购买${c.label.includes('仓储')?'仓储设施':c.label} ↗</button>`:''}</div></div>`).join('')}</section><p class="challenge-timing-note">查看任务不消耗次数，也不会开始计时。未完成可重新挑战，每阶段限领一次，领奖后新开局挑战下一阶段。确认后按真实时间倒计时；暂停、换账户和关闭页面仍计时。</p><button class="primary" id="confirmchallenge" ${entry.canBegin?'':'disabled'} aria-describedby="challenge-start-reason">${entry.startLabel}${entry.canBegin?' · '+clockText(entry.canRetry?v.retrySeconds:v.remaining):''}</button><p id="challenge-start-reason" class="challenge-start-reason">${entry.canRetry?'重新开始会重置本次任务进度和计时，保留建筑、NFT、经营币及库存；旧批次与旧发车不计入新任务。':entry.canStart?'确认后开始本阶段计时。未完成可重试，本阶段奖励只结算一次。':entry.issues.map(i=>i.text).join(' ')}</p><div class="preparation-actions"><button id="prepare-back">${v.status==='completed'?'返回领取奖励':'返回农场继续准备'}</button></div>`);
 $('#confirmchallenge').onclick=async()=>{
  if(chainWallet?.active){try{await chainWallet.begin()}catch(error){toast(error.message);return}}
  const fresh=challengeEntry(state);
  const restarting=fresh.canRetry;if(!fresh.canBegin||!(restarting?retryDailyChallenge(state):startDailyChallenge(state,fresh.view.plan.id))){ui();previewDailyChallenge();return}
  if(chainWallet?.connected&&state.daily.challenge)state.daily.challenge.endsAt=Math.min(state.daily.challenge.endsAt,state.chainAttempt.endsAt*1000);
  paused=false;audio.setPaused(false);dom.text($('#pause'),'Ⅱ');dom.text($('.pill'),'● 自动生产中');ui();modal.close();toast(restarting?'任务已重新开始：保留建设，重新计算本次倒计时和进度。':'挑战开始！请在倒计时结束前完成全部目标。');
 };
 if($('#prepare-newround'))$('#prepare-newround').onclick=()=>{modal.close();previewNewRound()};
 if($('#prepare-shop'))$('#prepare-shop').onclick=()=>{modal.close();openOrdinaryShop(entry.readiness.checks.filter(c=>!c.ready).flatMap(c=>c.buildTypes||[]))};
 document.querySelectorAll('[data-prepare-facility]').forEach(b=>b.onclick=()=>{modal.close();openOrdinaryShop(b.dataset.prepareFacility.split(','))});
 $('#prepare-back').onclick=()=>{modal.close();showFarm()};
 if(!modal.open)modal.showModal();
}
function renderSelection(){
 const b=selectedBuilding,panel=$('#selected');if(state.roads.includes(b)){renderRoadSelection(b);return}if(!state.buildings.includes(b)){selectedBuilding=null;dom.property(panel,'hidden',true);return}
 const m=modelFor(state,b),a=ownerFor(state,b),info=productionInfo(state,b),nft=!!b.assetId;
 const t=m?{name:m.name,icon:TYPE_ICONS[b.type]}:(types[b.type]||{name:{house:'农人住宅',trade:'货运站'}[b.type],icon:'🏡'});
 dom.property(panel,'hidden',false);panel.classList.toggle('warehouse-selection',isStorage(b));
 if(isStorage(b)){renderStorageSelection(b,m,a);return}
 dom.html(panel,`<span class="eyebrow">${nft?'✦ NFT · '+displayNftId(a.id):b.ordinary?'◈ 普通设施 · '+(ORDINARY_GRADES[m?.grade]||'通用型'):'小镇基础配套'}</span><b>${t.icon} ${t.name}</b>${m?`<div class="detailprice"><span>${nft?TIERS[m.tier]+' · 发行价':'经营币建造价'}</span><strong>${nft?m.price:b.purchaseCost??m.cost??types[b.type].cost} <small>${nft?CURRENCY.symbol:'经营币'}</small></strong></div><p>${m.cycle?inputText(m)+' → '+goodsText(m.outputs)+'<br>基础周期 '+m.cycle+' 秒':''}<br>${effectText(m)}</p>`:`<p>${t.desc||'连接道路，为小镇提供服务。'}</p>`}<div class="productionstatus ${info.blocked?'waiting':''}">${info.label}</div>${info.cycle?`<p class="detailnotes">当前周期 ${info.cycle} 秒<br>${info.notes.join('<br>')}${info.reason?'<br>'+info.reason:''}</p>`:''}<p class="facility-tenure">${nft?'永久持有 · 重开可再次免费放置 · 一件仅占一个位置':b.ordinary?'本轮使用 · 新一轮可按原布局付费重建':''}</p><div class="detailactions">${m?`<button id="toggleasset">${a.enabled===false?'启用设施':'暂停使用'}</button>`:''}${nft?'<button id="storeasset">收回 NFT</button>':demolitionAction(b)}<button id="dismiss">收起</button></div>`);
 $('#dismiss').onclick=()=>{selectedBuilding=null;dom.property(panel,'hidden',true)};
 if(m)$('#toggleasset').onclick=()=>{if(nft)setAssetEnabled(state,a.id,a.enabled===false);else enableFacility(state,b,b.enabled===false);ui()};
 bindDemolition(b);
 if(nft)$('#storeasset').onclick=()=>{recallAsset(state,b.assetId);selectedBuilding=null;dom.property(panel,'hidden',true);ui();toast('NFT 已收回背包，可再次放置或交易。')};
}
function demolitionAction(b){
 const q=demolitionQuote(state,b);return q.eligible?`<button id="demolish" class="demolition-button">拆除 · 返还 ${q.refund} 经营币</button>`:'';
}
function bindDemolition(b){if($('#demolish'))$('#demolish').onclick=()=>previewDemolition(b)}
function renderRoadSelection(b){
 const panel=$('#selected'),q=demolitionQuote(state,b);dom.property(panel,'hidden',false);panel.classList.remove('warehouse-selection','storage-on-right');
 dom.html(panel,`<span class="eyebrow">◈ 普通设施 · 道路</span><b>🛤️ 乡间道路</b><p>连接生产设施与货运站。拆除后，依赖这段道路的设施可能停止工作。</p><p class="facility-tenure">${q.priceKnown?'建造计价 '+q.paid+' 经营币 · 拆除返还 '+(q.rate*100)+'%（向下取整）':'旧地图赠送道路 · 可拆除，无经营币返还'}</p>${q.reason?`<p class="demolition-note">${q.reason}</p>`:''}<div class="detailactions">${demolitionAction(b)}<button id="dismiss">收起</button></div>`);
 bindDemolition(b);$('#dismiss').onclick=()=>{selectedBuilding=null;dom.property(panel,'hidden',true)};
}
function previewDemolition(b){
 const farm=state,q=demolitionQuote(farm,b);if(!q.eligible)return toast(q.reason);
 const storage=isStorage(b),job=ownerFor(farm,b)?.job;
 dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">FACILITY · REMOVE & REFUND</div><h1>拆除${q.name}？</h1><p>移除地图上的这座设施，空地可以重新建设。</p><div class="demolition-summary"><div><span>${q.priceKnown?'建造计价':'旧设施无购置记录'}</span><b>${q.paid} <small>经营币</small></b></div><div><span>返还比例</span><b>${q.rate*100}% <small>向下取整</small></b></div><div class="demolition-refund"><span>返还到账户</span><b>＋${q.refund} <small>经营币</small></b></div></div><p class="demolition-note">${storage?'已入库货物保留，仓储容量会减少。超出容量时，新的货物需等待有空位后才能入库。':q.type==='road'?'这段道路被移除后，部分设施可能断路并暂停生产。':'拆除后，该设施的产能与范围效果立即停止。'}${job?' 本设施尚未入库的批次会取消，已消耗的原料不返还。':''}</p>${q.reason?`<p class="challenge-missing" role="status">${q.reason}</p>`:''}<div class="demolition-dialog-actions"><button id="cancel-demolition">保留设施</button><button class="primary" id="confirm-demolition" ${q.allowed?'':'disabled'}>确认拆除 · 返还 ${q.refund} 经营币</button></div>`);
 $('#cancel-demolition').onclick=()=>modal.close();
 $('#confirm-demolition').onclick=()=>{
  if(state!==farm){modal.close();return toast('账户已切换，请重新选择设施。')}
  const fresh=demolitionQuote(state,b);if(!fresh.allowed||fresh.refund!==q.refund){if(fresh.eligible)previewDemolition(b);else{modal.close();toast(fresh.reason)}return}
  const result=demolishOrdinary(state,b);if(!result)return;
  selectedBuilding=null;dom.property($('#selected'),'hidden',true);modal.close();ui();toast(`${result.name}已拆除，＋${result.refund} 经营币已到账。`);
 };
 if(!modal.open)modal.showModal();
}
function renderWarehouseStatuses(){
 const root=$('#warehouse-markers'),previous=new Map(warehouseMarkers.map(e=>[e.key,e]));
 warehouseMarkers=state.buildings.filter(isStorage).map(b=>{
  const v=storageOverview(state,b,{haulers:uiHaulers}),old=previous.get(v.key),button=old?.button||document.createElement('button');previous.delete(v.key);
  if(!old){button.className='warehouse-marker';button.type='button';button.dataset.storage=v.key;root.append(button)}
  button.dataset.facility=b.assetId?'nft':'ordinary';button.dataset.status=v.status;dom.attribute(button,'aria-label',`${v.name}，${v.label}，${v.groups.map(g=>`${g.name} ${g.used}/${g.capacity}`).join('，')}。查看仓库货物详情`);
  dom.property(button,'title',`${v.name} · ${v.label}\n${v.groups.map(g=>`${g.name} ${g.used} / ${g.capacity}`).join('\n')}\n点击查看货物详情`);
  const percent=Math.round(v.ratio*100),text=['disconnected','paused'].includes(v.status)?v.label:`${percent}%${['full','overflow','tight'].includes(v.status)?' · '+v.label:''}`;
  dom.html(button,`<span class="marker-line"><i>${b.assetId?'✦':b.type==='silo'?'🌾':'📦'}</i><b>${text}</b>${v.incoming.length?`<small>↓${v.incoming.length}</small>`:''}</span><span class="marker-bars">${v.groups.map(g=>`<i style="--fill:${Math.min(100,g.ratio*100)}%"></i>`).join('')}</span>`);
  button.onclick=()=>{choose(null);selectedBuilding=b;renderSelection()};
  return {key:v.key,b,button};
 });
 for(const e of previous.values())e.button.remove();positionWarehouseStatuses(true);
}
function positionWarehouseStatuses(force=false){
 const key=[rotation,tile,origin.x,origin.y,W,H].join(':');if(!force&&key===lastMarkerKey)return;lastMarkerKey=key;
 for(const {b,button}of warehouseMarkers){const p=iso(b.x+.5,b.y+.5,b.type==='silo'?1.85:1.45);const transform=`translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0) translate(-50%,-100%)`;if(button.style.transform!==transform){button.style.left='0';button.style.top='0';button.style.transform=transform;}dom.property(button,'hidden',p.x<0||p.x>W||p.y<0||p.y>H)}
 if(isStorage(selectedBuilding))$('#selected').classList.toggle('storage-on-right',W>650&&iso(selectedBuilding.x+.5,selectedBuilding.y+.5).x<400);
}
function renderStorageSelection(b,m,a){
 const v=storageOverview(state,b,{haulers:uiHaulers}),panel=$('#selected'),scroll=panel.scrollTop;
 const reason={normal:'有空间，村民可继续卸货入库。',tight:'空间紧张，可出售货物或增建仓储。',full:'至少一类库存已满；出售货物或消耗材料后恢复入库。',overflow:'库存超过当前容量，货物保留，腾出空间后再入库。',disconnected:'未接通货运站道路，当前仓库无法接收搬运货物。',paused:'仓库已暂停，不接收新货物；现有共享库存保留。'};
 dom.html(panel,`<div class="storage-heading"><div><span class="eyebrow">WAREHOUSE · LIVE INVENTORY</span><h2>${b.type==='silo'?'🌾':'📦'} ${v.name}</h2></div><button id="dismiss" aria-label="收起仓库详情">×</button></div><div class="storage-health" data-state="${v.status}"><span>● ${v.label}</span><small>${v.connected?'道路已连通':'道路未连通'}${!v.enabled?' · 资产已暂停':paused?' · 游戏已暂停':''}</small></div><p class="storage-note">农场共享库存 · ${reason[v.status]}</p>${b.assetId?'':`<div class="detailactions storage-demolition">${demolitionAction(b)}</div>`}${v.groups.map(g=>`<section class="storage-group" data-storage-group="${g.id}"><div class="storage-group-head"><b>${g.icon} ${g.name}</b><strong>${g.used}<small> / ${g.capacity}</small></strong></div><div class="storage-meter" role="progressbar" aria-label="${g.name}占用" aria-valuenow="${Math.min(g.used,g.capacity)}" aria-valuemin="0" aria-valuemax="${g.capacity}" aria-valuetext="已用 ${g.used}，容量 ${g.capacity}"><i style="width:${Math.min(100,g.ratio*100)}%" data-full="${g.ratio>=1}"></i></div><div class="storage-space"><span>剩余 ${g.free}</span><span>${g.overflow?'超出 '+g.overflow:'占用 '+Math.round(g.ratio*100)+'%'}</span></div><div class="storage-goods">${g.stocks.map(r=>`<div><span>${RESOURCE_ICONS[r.resource]} ${RESOURCE_NAMES[r.resource]}</span><b>${r.amount}</b>${r.incoming?`<small>＋${r.incoming} 在途</small>`:''}</div>`).join('')}</div><p class="storage-contribution">${b.type==='barn'?'基础容量':'本仓当前扩容'}：${g.contribution}${g.id==='processed'?' · 加工品共用以上容量':''}</p></section>`).join('')}<section class="storage-inbound"><div><b>正在送往此仓库</b><span>${v.incoming.length} 批</span></div>${v.incoming.length?v.incoming.map(h=>`<p>${cargoText(h.outputs)} <span>${h.sourceName}</span><small>${h.waiting?'仓满，等待卸货':'约 '+Math.ceil(h.duration*(1-h.progress))+' 秒后到达'}</small></p>`).join(''):'<p class="empty-inbound">暂无搬运中的货物</p>'}</section><p class="storage-footnote">同类仓储共享货物与容量。在途货物卸货后才计入数量；清水与电力另存水箱、电池。</p>${m&&!b.ordinary?`<div class="storage-nft">${displayNftId(a.id)} · NFT · 发行价 ${m.price} ${CURRENCY.symbol}</div><div class="detailactions"><button id="toggleasset">${a.enabled===false?'启用仓库':'暂停仓库'}</button><button id="storeasset">收回 NFT</button></div>`:''}`);
 panel.scrollTop=scroll;bindDemolition(b);
 $('#dismiss').onclick=()=>{selectedBuilding=null;dom.property(panel,'hidden',true)};
 if(m&&!b.ordinary)$('#toggleasset').onclick=()=>{setAssetEnabled(state,a.id,a.enabled===false);ui()};
 if(m&&!b.ordinary)$('#storeasset').onclick=()=>{recallAsset(state,b.assetId);selectedBuilding=null;dom.property(panel,'hidden',true);ui();toast('仓储 NFT 已收回，现有库存保留。')};
}
// Orbit around the world's vertical axis before applying the fixed camera tilt.
// Keeping this order prevents a screen-space roll of the whole map.
function rotated(x,y){const c=Math.cos(rotation),s=Math.sin(rotation),u=x-MAP_CENTER,v=y-MAP_CENTER;return {x:u*c-v*s,y:u*s+v*c}}
function depth(x,y){const p=rotated(x,y);return p.x+p.y}
function iso(x,y,z=0){const p=rotated(x,y);return {x:origin.x+(p.x-p.y)*tile,y:origin.y+MAP_CENTER*tile+(p.x+p.y)*tile*.5-z*tile}}
function facing(nx,ny){const c=Math.cos(rotation),s=Math.sin(rotation);return nx*(c+s)+ny*(c-s)>0}
function poly(points,color,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke()}}
function quad(x,y,w,d,z,color){poly([iso(x,y,z),iso(x+w,y,z),iso(x+w,y+d,z),iso(x,y+d,z)],color)}
function box(x,y,w,d,h,color='#ede5cc',roof='#f8f0db',base=0){const corners=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],c=Math.cos(rotation),s=Math.sin(rotation);const normals=[[0,-1],[1,0],[0,1],[-1,0]];corners.forEach((p,i)=>{const n=normals[i],visible=n[0]*(c+s)+n[1]*(c-s);if(visible<=0)return;const q=corners[(i+1)%4];poly([iso(...p,base),iso(...q,base),iso(...q,base+h),iso(...p,base+h)],shade(color,i%2?-22:0))});quad(x,y,w,d,base+h,roof)}
function shade(hex,n){let a=parseInt(hex.slice(1),16);return '#'+[a>>16,(a>>8)&255,a&255].map(v=>Math.max(0,Math.min(255,v+n)).toString(16).padStart(2,'0')).join('')}
function line(a,b,color,width=2){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function ellipse(p,rx,ry,color){ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
function roof(x,y,w,d,h,color){
const a=iso(x-.08,y-.08,h),b=iso(x+w+.08,y-.08,h),c=iso(x+w+.08,y+d+.08,h),e=iso(x-.08,y+d+.08,h),r1=iso(x+w/2,y-.08,h+.5),r2=iso(x+w/2,y+d+.08,h+.5);
const faces=[{points:[a,r1,r2,e],color,depth:depth(x+w*.25,y+d*.5)},{points:[r1,b,c,r2],color:shade(color,-25),depth:depth(x+w*.75,y+d*.5)},{points:[a,b,r1],color:shade(color,-12),depth:depth(x+w*.5,y-.08)},{points:[e,c,r2],color:shade(color,-8),depth:depth(x+w*.5,y+d+.08)}];
faces.sort((a,b)=>a.depth-b.depth).forEach(f=>poly(f.points,f.color));line(r1,r2,shade(color,15),2)
}
function drawTool(b,time,accent){
 const {x,y,type}=b,color=accent||'#7b9b85';
 if(type==='vegetable'){
  quad(x+.05,y+.05,.9,.9,.035,'#886444');
  const owner=ownerFor(state,b),model=modelFor(state,b),growth=owner?.job?Math.max(.25,1-owner.job.remaining/((model?.cycle||10)+4)):.25;
  for(let row=0;row<3;row++){
   line(iso(x+.12,y+.18+row*.29,.055),iso(x+.88,y+.18+row*.29,.055),'#b49361',1.5);
   for(let col=0;col<3;col++){
    const p=iso(x+.2+col*.3,y+.18+row*.29,.11),r=tile*(.05+.075*growth);
    if((row+col)%2){ellipse(p,r*.55,r*1.2,'#de9d49');line(p,{x:p.x+2,y:p.y-r*2},'#6b9a47',1.5)}
    else{ellipse({...p,x:p.x-r*.5},r,r*.6,'#5e913f');ellipse({...p,x:p.x+r*.4},r,r*.6,'#8ebc56');ellipse({...p,y:p.y-r*.4},r*.75,r*.7,'#b2cf73')}
   }
  }
 }else if(type==='lumber'){
  box(x+.12,y+.08,.64,.62,.5,'#c6ab7c','#e4c894');roof(x+.08,y+.04,.72,.7,.5,accent||'#75815c');
  for(let i=0;i<3;i++){box(x+.45,y+.7+i*.08,.42,.065,.07,'#967046','#cba275',.05+i*.06);ellipse(iso(x+.88,y+.73+i*.08,.09+i*.06),tile*.05,tile*.055,'#ecd1a0')}
  const p=iso(x+.2,y+.85,.12);line({x:p.x-3,y:p.y+2},{x:p.x+4,y:p.y-11},'#a78353',2.5);poly([{x:p.x,y:p.y-11},{x:p.x+6,y:p.y-14},{x:p.x+9,y:p.y-9},{x:p.x+3,y:p.y-6}],'#aab9af');
 }else if(type==='solar'){
  box(x+.15,y+.2,.08,.08,.35,'#9ea991','#bfc8aa');box(x+.78,y+.7,.08,.08,.35,'#9ea991','#bfc8aa');
  const p=(u,v)=>iso(x+.08+u*.86,y+.08+v*.86,.3+(1-v)*.18);
  poly([p(0,0),p(1,0),p(1,1),p(0,1)],b.ordinary?'#777d72':'#427f9d','#c1dbd4');
  for(let i=1;i<4;i++)line(p(i/4,0),p(i/4,1),'#96bac0',1);for(let i=1;i<3;i++)line(p(0,i/3),p(1,i/3),'#96bac0',1);
 }else if(type==='wind'){
  box(x+.43,y+.43,.14,.14,1.4,'#d5d9bd','#eef0d8');const angle=time/1100;
  for(let i=0;i<3;i++){const a=angle+i*Math.PI*2/3,point=(r,t)=>iso(x+.5+Math.cos(a)*r-Math.sin(a)*t,y+.5,1.4+Math.sin(a)*r+Math.cos(a)*t);poly([point(.08,-.03),point(.7,-.02),point(.7,.08),point(.13,.13)],'#f9f5dd')}
  ellipse(iso(x+.5,y+.5,1.4),3,3,color);
 }else if(type==='tower'){
  for(const [dx,dy]of[[.2,.2],[.7,.2],[.2,.7],[.7,.7]])box(x+dx,y+dy,.06,.06,.85,'#9b9d7c','#bdc4a1');
  box(x+.15,y+.15,.65,.65,.5,'#87adae','#c8dbce',.8);line(iso(x+.15,y+.81,1.05),iso(x+.8,y+.81,1.05),'#edf0d6',2);
 }else if(type==='silo'){
  const bottom=iso(x+.5,y+.5,.05),top=iso(x+.5,y+.5,1.05);poly([{x:top.x-tile*.33,y:top.y},{x:top.x+tile*.33,y:top.y},{x:bottom.x+tile*.33,y:bottom.y},{x:bottom.x-tile*.33,y:bottom.y}],'#b7c1a6');ellipse(bottom,tile*.33,tile*.16,'#b7c1a6');ellipse(top,tile*.33,tile*.16,'#d1d7b9');poly([{x:top.x-tile*.36,y:top.y},iso(x+.5,y+.5,1.5),{x:top.x+tile*.36,y:top.y}],color);for(const z of[.4,.75]){const p=iso(x+.5,y+.5,z);line({x:p.x-tile*.32,y:p.y},{x:p.x+tile*.32,y:p.y},'#d4dcc2',1.2)}
 }else if(type==='tractor'){
  box(x+.12,y+.2,.8,.55,.25,color,'#a9c49a',.12);box(x+.5,y+.23,.32,.4,.42,'#d4dfbb','#ebecd1',.37);quad(x+.5,y+.64,.27,.01,.65,'#93b5b3');
  for(const dx of[.25,.76])for(const dy of[.15,.8])ellipse(iso(x+dx,y+dy,.12),tile*.12,tile*.14,'#53665a');
 }else{
  const warehouse=type==='warehouse',dairy=type==='dairy',cake=type==='cakery';
  box(x+.08,y+.08,.84,.84,.6,warehouse?'#c7c6a6':dairy?'#e0c9a3':cake?'#ecd5bd':'#d9d1ae','#e4dec2');roof(x+.04,y+.04,.92,.92,.6,accent|| (warehouse?'#8b9d7d':dairy?'#a77464':cake?'#c48e91':'#b8a26c'));
  if(warehouse||type==='depot'){box(x+.65,y+.72,.3,.28,.25,'#b69c69','#dfca91');box(x+.35,y+.85,.25,.2,.2,'#b69c69','#e7d5a8')}
  if(dairy){box(x+.65,y+.7,.35,.23,.23,'#f3efd7','#fff9e5',.06);quad(x+.72,y+.74,.14,.12,.3,'#526b59');box(x+.91,y+.78,.14,.13,.16,'#e6dec0','#fcf4d9',.13)}
  if(cake){box(x+.7,y+.75,.35,.3,.2,'#d7a197','#f9edcf');box(x+.8,y+.8,.17,.15,.17,'#edc7a5','#fff4d6',.2);ellipse(iso(x+.89,y+.87,.4),2,2,'#b67567')}
 }
}
function drawForestTree(b){
 const {x,y}=b,growth=treeGrowth(state,b),stump=growth<.28;
 if(stump){
  box(x+.4,y+.4,.2,.2,.14,'#947348','#d9b681');ellipse(iso(x+.5,y+.5,.145),tile*.1,tile*.05,'#e8ce98');
  if(growth>.12){const p=iso(x+.68,y+.5,.1);line(p,{x:p.x,y:p.y-tile*.15},'#6c904d',1.5);ellipse({x:p.x+2,y:p.y-tile*.12},3,1.5,'#8aab58')}
  return;
 }
 const scale=Math.max(.35,growth),p=iso(x+.5,y+.5,.9*scale);
 box(x+.44,y+.44,.12,.12,.7*scale,'#97714d','#97714d');
 ellipse({...p,y:p.y+8*scale},tile*.42*scale,tile*.32*scale,'#527d48');
 ellipse({...p,x:p.x-7*scale,y:p.y-4*scale},tile*.3*scale,tile*.35*scale,'#6b9955');
 ellipse({...p,x:p.x+7*scale,y:p.y-6*scale},tile*.28*scale,tile*.35*scale,'#81aa60');
 ellipse({...p,y:p.y-15*scale},tile*.28*scale,tile*.3*scale,'#8bb667');
}
function building(b,time,ghost=false){let {x,y,type}=b;const model=b.ordinary?modelFor(state,b):b.modelId?CATALOG.find(m=>m.id===b.modelId):modelFor(state,b),nft=!!b.assetId,accent=b.ordinary?'#9c927e':model?.tier===2?'#c5a35e':nft?'#469e9e':null;ctx.save();if(nft)quad(x+.02,y+.02,.96,.96,.02,'#5eb5ad55');if(ghost)ctx.globalAlpha=.55;ellipse(iso(x+.57,y+.62),tile*.65,tile*.22,'#3d572b20');if(TOOL_TYPES.includes(type)){drawTool(b,time,accent)}else if(type==='wheat'){quad(x+.04,y+.04,.92,.92,.025,'#927044');for(let a=0;a<4;a++)for(let c=0;c<4;c++){let p=iso(x+.16+a*.2,y+.16+c*.2,.08),h=(.14+.18*((state.seconds%6)/6))*tile;line(p,{x:p.x+Math.sin(time/700+a)*1.3,y:p.y-h},'#d9b94f',1.6);ellipse({x:p.x,y:p.y-h},2.3,4.4,'#f0ce65')}for(let a=0;a<5;a++){line(iso(x+.05+a*.2,y+.03,.06),iso(x+.05+a*.2,y+.97,.06),'#b28c51',.7)}}
else if(type==='tree'){drawForestTree(b)}
else if(type==='well'){box(x+.2,y+.2,.6,.6,.3,'#b8b9a3','#dedcc3');quad(x+.3,y+.3,.4,.4,.31,'#609aab');box(x+.22,y+.24,.06,.08,.75,'#9b7851','#9b7851');box(x+.72,y+.65,.06,.08,.75,'#9b7851','#9b7851');roof(x+.1,y+.1,.8,.8,.8,accent||'#699292')}
else{const mill=type==='mill',barn=type==='barn',trade=type==='trade';let h=mill?1.25:.65,col=type==='bakery'?'#f1ddba':barn?'#cd7d59':trade?'#b0c0b0':'#e8e0bc';box(x+.12,y+.12,.78,.78,h,col,shade(col,12));roof(x+.06,y+.06,.9,.9,h,mill?(accent||'#8b9fa0'):barn?'#6c8586':type==='bakery'?(accent||'#c48260'):trade?'#719891':'#d49a6b');if(facing(0,1)){poly([iso(x+.43,y+.902,.05),iso(x+.67,y+.902,.05),iso(x+.67,y+.902,.43),iso(x+.43,y+.902,.43)],'#665946');quad(x+.2,y+.905,.15,.01,.43,'#b8d9cf');line(iso(x+.275,y+.92,.25),iso(x+.275,y+.92,.43),'#f5e9cc',1.2)}if(mill&&facing(0,1)){const angle=time/1700;for(let i=0;i<4;i++){const a=angle+i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a),point=(r,t)=>iso(x+.51+dx*r-dz*t,y+.99,1.15+dz*r+dx*t);poly([point(.12,-.04),point(.85,-.07),point(.85,.16),point(.12,.07)],'#f1ead3','#afab90')}ellipse(iso(x+.51,y+.99,1.15),3,3,'#897b59')}if(type==='bakery'){box(x+.6,y+.2,.15,.18,.6,'#9a8d7b','#c1b49d',.65);for(let i=0;i<3;i++){let p=iso(x+.7,y+.3,1.3);ellipse({x:p.x+Math.sin(time/900+i)*5,y:p.y-((time/45+i*13)%40)},5+i*2,4+i,'#ffffff60')}if(facing(0,1)){let a=iso(x+.5,y+1,.6);ctx.font=`${tile*.21}px sans-serif`;ctx.fillStyle='#fff2d3';ctx.fillText('BAKERY',a.x-14,a.y)}}}
if(nft){const p=iso(x+.8,y+.9,.42);ellipse(p,tile*.16,tile*.16,'#1f8c8c');ctx.fillStyle='#ffdf84';ctx.font=`bold ${tile*.22}px sans-serif`;ctx.textAlign='center';ctx.fillText('✦',p.x,p.y+tile*.075);ctx.textAlign='start'}ctx.restore()}
function drawTruck(pose,time){
 if(!pose.visible)return;ctx.save();ctx.globalAlpha=pose.alpha;
 const c=Math.cos(pose.heading),s=Math.sin(pose.heading),world=(x,y,z=0)=>({x:pose.x+x*c-y*s,y:pose.y+x*s+y*c,z}),point=(x,y,z=0)=>{const p=world(x,y,z);return iso(p.x,p.y,p.z)};
 const polygon=(points,color)=>poly(points.map(p=>point(...p)),color);
 const part=(cx,cy,w,d,h,z,color,top)=>{const corners=[[cx-w/2,cy-d/2],[cx+w/2,cy-d/2],[cx+w/2,cy+d/2],[cx-w/2,cy+d/2]],normals=[[0,-1],[1,0],[0,1],[-1,0]];corners.forEach((p,i)=>{const [nx,ny]=normals[i];if(!facing(nx*c-ny*s,nx*s+ny*c))return;const q=corners[(i+1)%4];polygon([[...p,z],[...q,z],[...q,z+h],[...p,z+h]],shade(color,i%2?-17:0))});polygon(corners.map(p=>[...p,z+h]),top)};
 const shadow=point(0,0,.01);ellipse(shadow,tile*.75,tile*.22,'#36533625');
 if(pose.moving){for(let i=0;i<3;i++){const p=point(-.85-i*.17,Math.sin(time/130+i)*.09,.03);ellipse(p,tile*(.1+i*.025),tile*.045,'#e6dcc16b')}}
 const wheel=(x,y)=>{const p=point(x,y,.12);ellipse(p,tile*.12,tile*.14,'#46574e');ellipse(p,tile*.055,tile*.065,'#b9c5a8');const a=time/90;line({x:p.x-Math.cos(a)*tile*.045,y:p.y-Math.sin(a)*tile*.05},{x:p.x+Math.cos(a)*tile*.045,y:p.y+Math.sin(a)*tile*.05},'#edf0d8',.8)};
 for(const y of[-.32,.32])if(!facing(-Math.sign(y)*s,Math.sign(y)*c))for(const x of[-.42,.43])wheel(x,y);
 part(0,0,1.45,.6,.15,.13,'#63816b','#86a381');
 const parts=[{depth:(()=>{const p=world(-.27,0);return depth(p.x,p.y)})(),draw:()=>{part(-.27,0,.82,.59,.28,.28,'#65977d','#a3c49b');if(pose.loaded){for(const x of[-.48,-.16])for(const y of[-.14,.14])part(x,y,.26,.22,.2,.55,'#c9ad6f','#f0d69b')}}},{depth:(()=>{const p=world(.46,0);return depth(p.x,p.y)})(),draw:()=>{part(.46,0,.45,.59,.49,.28,'#e7d6a5','#fff0c7');if(facing(c,s))polygon([[.692,-.22,.48],[.692,.22,.48],[.692,.22,.67],[.692,-.22,.67]],'#8fb7b5');for(const side of[-1,1])if(facing(-side*s,side*c))polygon([[.28,side*.302,.48],[.6,side*.302,.48],[.6,side*.302,.67],[.28,side*.302,.67]],'#94b9b6');for(const y of[-.22,.22])ellipse(point(.7,y,.38),tile*.035,tile*.035,'#f9e4a0')}}];
 parts.sort((a,b)=>a.depth-b.depth).forEach(p=>p.draw());
 for(const y of[-.32,.32])if(facing(-Math.sign(y)*s,Math.sign(y)*c))for(const x of[-.42,.43])wheel(x,y);
 ctx.restore();
}
const cargoText=outputs=>Object.entries(outputs).map(([k,v])=>`${RESOURCE_ICONS[k]} ×${v}`).join(' ');
function renderCargoFlow(){
 const active=uiHaulers,arrivals=state.haulArrivals||[];
 const noStore=!capacity(state,'wheat')&&!capacity(state,'flour'),full=[capacity(state,'wheat')>0&&state.wheat>=capacity(state,'wheat')?'粮仓':'',capacity(state,'flour')>0&&warehouseStock(state)>=capacity(state,'flour')?'加工仓':''].filter(Boolean);
 dom.text($('#hauling-count'),paused?'搬运已暂停':active.length?`${active.length} 人搬运中`:noStore?'先建仓库':full.length?'等待仓位':'等待下一批');
 dom.html($('#cargo-flow-list'),active.slice(0,3).map(h=>`<div class="flowrow"><span>${cargoText(h.outputs)}</span><div><b>${h.sourceName} → ${h.destinationName}</b><small>${paused?'暂停中 · 货物和进度保留':h.waiting?'仓满，等待卸货':`搬运入库 · 还需 ${Math.ceil(h.duration*(1-h.progress))} 秒`}</small></div></div>`).join('')||arrivals.slice(-2).reverse().map(h=>`<div class="flowrow arrived"><span>${cargoText(h.outputs)}</span><div><b>${h.sourceName} → ${h.destinationName}</b><small>✓ 已卸货入库</small></div></div>`).join('')||(noStore?'<p>先建设并接通仓库，或放置已有仓储 NFT。<br>普通设施在经营币设施商店购买。</p>':full.length?`<p>${full.join('、')}已满。<br>出售货物腾出空间后，村民继续搬运。</p>`:'<p>生产完成后，村民抱货送往仓库。<br>地图虚线显示路线，货物到达后入库。</p>'));
}
function drawHaulRoute(h){
 const resource=Object.keys(h.outputs)[0],color=CARGO_COLORS[resource];ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.setLineDash([4,5]);ctx.lineDashOffset=-animationSeconds*8;ctx.beginPath();h.route.forEach((p,i)=>{const q=iso(p.x,p.y,.035);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.stroke();ctx.setLineDash([]);
 const end=h.route.at(-1),q=iso(end.x,end.y,.05);ellipse(q,5+Math.sin(animationSeconds*5)*1.2,2.4,color);ctx.restore();
}
function drawHauler(h){
 const p=iso(h.x,h.y,.055),scale=Math.max(.85,Math.min(1.6,tile/26)),step=h.waiting?0:Math.sin(animationSeconds*11),ahead=iso(h.x+h.dx*.1,h.y+h.dy*.1),face=ahead.x<p.x?-1:1;
 const resource=Object.keys(h.outputs)[0],shirt=CARGO_COLORS[resource]||'#6f968d';
 ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);ellipse({x:0,y:2},6,2.5,'#334b3438');
 ctx.lineCap='round';line({x:-2,y:-2},{x:-2+step*3,y:4},'#566758',2.5);line({x:2,y:-2},{x:2-step*3,y:4},'#566758',2.5);
 ctx.fillStyle=shirt;ctx.fillRect(-4,-13,8,11);ellipse({x:0,y:-16},3.5,4,'#f4d2a3');ellipse({x:0,y:-19},5.5,1.8,'#dbc17d');ellipse({x:0,y:-20},3.4,1.8,'#e8d394');ellipse({x:face*2.4,y:-15},1.5,1.1,'#e6bb8c');
 ctx.fillStyle='#c59b61';ctx.fillRect(face>0?1:-10,-11,9,8);ctx.fillStyle='#e5c38d';ctx.fillRect(face>0?1:-10,-11,9,2);line({x:face*5,y:-11},{x:face*5,y:-4},'#f5d1a0',2.5);line({x:face*4,y:-9},{x:face*9,y:-5},'#f5d1a0',2.4);ctx.restore();
}
function cargoBadge(text,p,color,alpha=1){
 text=localize(text);
 ctx.save();ctx.globalAlpha=alpha;ctx.font='600 11px system-ui,sans-serif';const w=ctx.measureText(text).width+14;ctx.fillStyle='#fffef4f0';ctx.strokeStyle=color+'80';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-11,w,22,7);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,p.y);ctx.restore();
}
function drawCargoLabels(haulers){
 for(const h of haulers){const scale=Math.max(.85,Math.min(1.6,tile/26)),p=iso(h.x,h.y,.055);cargoBadge(cargoText(h.outputs),{x:p.x,y:p.y-34*scale},CARGO_COLORS[Object.keys(h.outputs)[0]])}
 for(const h of state.haulArrivals||[]){const age=animationSeconds-h.at;if(age<0||age>1.8)continue;const end=h.route.at(-1),p=iso(end.x,end.y,1);cargoBadge(`＋${cargoText(h.outputs)} 入库`,{x:p.x,y:p.y-age*12},'#477954',1-age/1.8)}
}
function road(x,y){if(x===RIVER_COLUMN){quad(x,y,1,1,.07,'#ad9167');for(let i=0;i<6;i++)line(iso(x+i/6,y,.075),iso(x+i/6,y+1,.075),'#e4c89a',1);for(const dy of[.05,.95]){line(iso(x,y+dy,.27),iso(x+1,y+dy,.27),'#d8bd86',2);for(const dx of[.08,.92])box(x+dx,y+dy,.045,.045,.25,'#9c845d','#dcc191')}return}quad(x,y,1,1,.015,'#d8c9a6');line(iso(x+.05,y+.05,.02),iso(x+.95,y+.05,.02),'#e8d9b5',1);for(let k=0;k<3;k++){let p=iso(x+.2+k*.25,y+.45,.025);ellipse(p,1.5,.6,'#bcb18d')}}
const SCENERY=[{x:.7,y:3,type:'tree'},{x:1,y:9,type:'tree'},{x:9,y:10,type:'tree'},{x:9,y:.8,type:'tree'},{x:.6,y:6,type:'tree'},{x:9,y:1,type:'tree'},{x:.6,y:13,type:'tree'},{x:.7,y:16,type:'tree'},{x:4,y:23.3,type:'tree'},{x:12,y:23.2,type:'tree'},{x:14,y:.6,type:'tree'},{x:23.3,y:4,type:'tree'},{x:23.3,y:12,type:'tree'}];
let routeCells=[],occupiedRoads=new Set(),occupiedBuildings=new Set();
function refreshMapTopology(){
 const route=state.delivery?.route||state.truckRoute||[];
 const key=state.roads.map(p=>`${p.x},${p.y}`).join(';')+'|'+state.buildings.map(p=>`${p.x},${p.y}`).join(';')+'|'+route.map(p=>`${p.x},${p.y}`).join(';');
 if(key===mapTopology)return;mapTopology=key;
 occupiedRoads=new Set(state.roads.map(p=>`${p.x},${p.y}`));occupiedBuildings=new Set(state.buildings.map(p=>`${p.x},${p.y}`));
 routeCells=route.filter(p=>p.x>=0&&p.y>=0&&p.x<MAP_SIZE&&p.y<MAP_SIZE).map(p=>({x:Math.floor(p.x),y:Math.floor(p.y)}));
 const routeSet=new Set(routeCells.map(p=>`${p.x},${p.y}`));
 visibleScenery=SCENERY.filter(p=>{const key=`${Math.floor(p.x)},${Math.floor(p.y)}`;return !occupiedRoads.has(key)&&!occupiedBuildings.has(key)&&!routeSet.has(key)});
}
function resize(){
 const r=canvas.getBoundingClientRect();W=r.width;H=r.height;
 pixelRatio=renderPixelRatio(W,H,devicePixelRatio,preferences(state).graphics||'auto');
 canvas.width=Math.ceil(W*pixelRatio);canvas.height=Math.ceil(H*pixelRatio);mainContext.setTransform(pixelRatio,0,0,pixelRatio,0,0);
 terrainCache.clear();fenceCache.clear();spriteCache.clear();lastPaintKey='';
}
function paintOn(context,paint){const previous=ctx;ctx=context;try{paint()}finally{ctx=previous}}
function paintStructure(b,time){
 if(['wheat','mill','wind','bakery'].includes(b.type)){building(b,time);return}
 const p=iso(b.x+.5,b.y+.5),w=Math.ceil(tile*3.5+18),h=Math.ceil(tile*4+24),ax=w/2,ay=h-tile*.65;
 if(p.x+w/2<0||p.x-w/2>W||p.y+tile<0||p.y-h>H)return;
 const model=modelFor(state,b),owner=ownerFor(state,b),variant=b.type==='tree'?treeGrowth(state,b).toFixed(3):b.type==='vegetable'?owner?.job?.remaining??'idle':'';
 const key=[b.type,model?.id,b.ordinary?'ordinary':b.assetId?'nft':'base',rotation,tile,pixelRatio,variant].join(':');
 const sprite=spriteCache.get(key,w,h,pixelRatio,context=>{
  context.translate(ax-p.x,ay-p.y);paintOn(context,()=>building(b,time));
 });
 ctx.drawImage(sprite,p.x-ax,p.y-ay,w,h);
}
function drawTerrain(){
ctx.clearRect(0,0,W,H);tile=Math.min(W/(MAP_SIZE*2.25),H/(MAP_SIZE+5))*zoom;origin={x:W*.49+pan.x,y:H*.54-MAP_CENTER*tile+pan.y};const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,isDay(state)?'#deead7':'#c0cfc4');bg.addColorStop(1,isDay(state)?'#cfdfbd':'#a1b7aa');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
// Soft cloud shadows and distant grass
ellipse({x:W*.48,y:H*.72},W*.39,H*.19,'#77915a1b');box(0,0,MAP_SIZE,MAP_SIZE,.25,'#b7b88b','#b1c58e',-.3);
for(let x=0;x<MAP_SIZE;x++)for(let y=0;y<MAP_SIZE;y++){let v=(x*17+y*31)%5;quad(x,y,1,1,0,shade(['#a9c785','#b0cd8e','#acc98a','#b4ce8e','#a8c487'][v],isDay(state)?0:-18));poly([iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1)],'#ffffff00','#91b27335');if(x===0||y===0||x===MAP_SIZE-1||y===MAP_SIZE-1){if((x+y)%2===0){let p=iso(x+.5,y+.5,.02);ellipse(p,2,1,'#d8e6a8')}}}
// Creek on the far side
for(let y=0;y<MAP_SIZE;y++){quad(RIVER_COLUMN+.2,y,.85,1,0,'#83bfc0');quad(RIVER_COLUMN+.3,y,.15,.55,.01,'#b9dfd3');if(y%2===0){let p=iso(RIVER_COLUMN+.7,y+.5);line({x:p.x-4,y:p.y},{x:p.x+5,y:p.y},'#d0e7d5',1)}}
for(const p of state.roads)road(p.x,p.y);
for(const p of routeCells)if(!occupiedRoads.has(`${p.x},${p.y}`)&&!occupiedBuildings.has(`${p.x},${p.y}`))road(p.x,p.y);

}
function drawFence(){
// Fence along near boundaries
for(let k=0;k<MAP_SIZE;k++){for(let side=0;side<2;side++){let x=side?MAP_SIZE-.1:k,y=side?k:MAP_SIZE-.1;box(x,y,.055,.055,.32,'#ded0aa','#fbebc6');if(k<MAP_SIZE-1){line(iso(x,y,.23),iso(x+(side?0:1),y+(side?1:0),.23),'#ecddb8',2);line(iso(x,y,.1),iso(x+(side?0:1),y+(side?1:0),.1),'#d5c59f',1.5)}}}
}
function draw(time){
 requestAnimationFrame(draw);const paintStarted=performance.now();
 if(frameTime!==null&&!paused&&!document.hidden){simAccumulator+=Math.min(1000,Math.max(0,time-frameTime));while(simAccumulator>=1000){simAccumulator-=1000;const produced=Object.values(state.productionTotals||{}).reduce((n,v)=>n+v,0),message=tick(state);if(message){toast(message);audio.effect('sale')}else if(Object.values(state.productionTotals||{}).reduce((n,v)=>n+v,0)>produced)audio.effect('harvest');runAutomation(state);ui(true)}}
 frameTime=time;animationSeconds=state.seconds+simAccumulator/1000;
 if(Math.floor(Date.now()/1000)!==challengeUiSecond){withFarmRead(state,()=>{renderRewardPanels();experience?.render();villageExperience?.render()});save(true)}
 if(document.hidden||marketActive||!sceneVisible||modal.open||W<=0||H<=0)return;
 const paintKey=[W,H,zoom,rotation,pan.x,pan.y,build,hover?.x,hover?.y,selectedBuilding?.x,selectedBuilding?.y,sceneRevision,languageUI.getLanguage()].join(':');
 if(paused&&paintKey===lastPaintKey||time-lastPaint<1000/60-2)return;const elapsed=time-lastPaint;lastPaint=Number.isFinite(elapsed)?time-(elapsed%(1000/60)):time;lastPaintKey=paintKey;
 tile=Math.min(W/(MAP_SIZE*2.25),H/(MAP_SIZE+5))*zoom;origin={x:W*.49+pan.x,y:H*.54-MAP_CENTER*tile+pan.y};
 const layerKey=[W,H,tile,rotation,origin.x,origin.y,pixelRatio,isDay(state),mapTopology].join(':');
 terrainCache.draw(mainContext,layerKey,W,H,pixelRatio,context=>paintOn(context,drawTerrain));
 const target=build&&hover?{...hover,assetId:placementAssetId}:selectedBuilding,targetModel=target&&modelFor(state,target);
 if(targetModel?.radius){for(let x=Math.max(1,target.x-targetModel.radius);x<=Math.min(MAP_SIZE-2,target.x+targetModel.radius);x++)for(let y=Math.max(1,target.y-targetModel.radius);y<=Math.min(MAP_SIZE-2,target.y+targetModel.radius);y++)if(Math.abs(x-target.x)+Math.abs(y-target.y)<=targetModel.radius)quad(x,y,1,1,.035,target.type==='tractor'?'#ecd98845':'#a8e5d348')}
 fenceCache.draw(mainContext,layerKey,W,H,pixelRatio,context=>paintOn(context,drawFence));
 const truck=sampleTruck(state.delivery,animationSeconds,MAP_SIZE,state.truckHome||{x:7.5,y:8.5},state.truckHeading||0),haulers=sampleHaulers(haulerJobs,simAccumulator/1000);
 haulers.forEach(drawHaulRoute);
 const all=[...haulers.map(p=>({type:'hauler',x:p.x-.5,y:p.y-.5,pose:p})),...(truck.visible?[{type:'deliveryTruck',x:truck.x-.5,y:truck.y-.5,pose:truck}]:[]),...visibleScenery,...state.buildings].map(b=>({b,z:depth(b.x+.5,b.y+.5)})).sort((a,b)=>a.z-b.z);
 withFarmRead(state,()=>all.forEach(({b})=>b.type==='deliveryTruck'?drawTruck(b.pose,animationSeconds*1000):b.type==='hauler'?drawHauler(b.pose):paintStructure(b,paused?0:time)));
 drawCargoLabels(haulers);effects.draw(ctx,iso,time,preferences(state).particles,paused,RIVER_COLUMN,MAP_SIZE);positionWarehouseStatuses();
 if(selectedBuilding&&!build)quad(selectedBuilding.x,selectedBuilding.y,1,1,.045,'#f6d99060','#b28b54');
 if(hover&&build){quad(hover.x,hover.y,1,1,.04,valid(hover.x,hover.y)?'#ecffb68c':'#e69a8eaa');build==='road'?road(hover.x,hover.y):building({...hover,type:build,assetId:placementAssetId,ordinary:!placementAssetId,modelId:placementAssetId?undefined:ordinaryItem(placementOrdinaryKey)?.id},time,true)}
 renderProbe.sample(time,performance.now()-paintStarted);
}
function valid(x,y){return build==='road'?canPlaceRoad(state,x,y):canPlace(state,x,y)}
function cell(e){const r=canvas.getBoundingClientRect(),dx=(e.clientX-r.left-origin.x)/tile,dy=((e.clientY-r.top-origin.y)/tile-MAP_CENTER)*2,c=Math.cos(rotation),s=Math.sin(rotation),u=(dx+dy)/2,v=(dy-dx)/2;return {x:Math.floor(MAP_CENTER+u*c+v*s),y:Math.floor(MAP_CENTER-u*s+v*c)}}
function storageAtPoint(e){
 const r=canvas.getBoundingClientRect(),p={x:e.clientX-r.left,y:e.clientY-r.top};
 const inside=points=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit}return hit};
 return state.buildings.filter(isStorage).sort((a,b)=>depth(b.x+.5,b.y+.5)-depth(a.x+.5,a.y+.5)).find(b=>{
  const inset=b.type==='silo'?.17:.08,h=b.type==='silo'?1.05:b.type==='barn'?.65:.6,coords=[[b.x+inset,b.y+inset],[b.x+1-inset,b.y+inset],[b.x+1-inset,b.y+1-inset],[b.x+inset,b.y+1-inset]],base=coords.map(q=>iso(...q)),top=coords.map(q=>iso(...q,h));
  const faces=base.map((q,i)=>[q,base[(i+1)%4],top[(i+1)%4],top[i]]);
  if(b.type==='silo'){const apex=iso(b.x+.5,b.y+.5,1.5);top.forEach((q,i)=>faces.push([q,top[(i+1)%4],apex]))}
  else{const a=iso(b.x+.5,b.y+.06,h+.5),c=iso(b.x+.5,b.y+.96,h+.5);faces.push([top[0],a,c,top[3]],[a,top[1],top[2],c],[top[0],top[1],a],[top[3],top[2],c])}
  return faces.some(inside);
 });
}
let drag=null,suppressClick=false;
canvas.style.touchAction='none';
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:rotation,panX:pan.x,panY:pan.y,rotate:e.button===2,moved:false};suppressClick=false;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){if(drag.rotate)rotation=drag.start-dx*.008;else{pan.x=drag.panX+dx;pan.y=drag.panY+dy}hover=null;canvas.style.cursor='grabbing';return}}hover=cell(e)});
function endDrag(e){if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved;drag=null;canvas.style.cursor='grab';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('lostpointercapture',()=>{if(drag){suppressClick=drag.moved;drag=null;canvas.style.cursor='grab'}});
canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1);zoomTo(zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.0015))},{passive:false});
canvas.addEventListener('pointerleave',()=>hover=null);
canvas.addEventListener('click',e=>{
 if(suppressClick){suppressClick=false;return}
 const p=cell(e);
 if(build){
  if(!valid(p.x,p.y))return toast('这里已被占用，请选择没有道路或建筑的空地。');
  if(placementAssetId){if(!placeAsset(state,placementAssetId,p.x,p.y))return toast('这件资产暂时无法放置。');toast('NFT 资产已放置，连接道路后即可开工。')}
  else{const t=ordinaryItem(placementOrdinaryKey||build);if(!buildOrdinary(state,placementOrdinaryKey||build,p.x,p.y))return toast('经营币不足或位置不可建造。');toast(t.name+'已建好，支付 '+t.cost+' 经营币。')}
  effects.burst(p.x,p.y);audio.effect('build');if(placementAssetId||build!=='road'&&!e.shiftKey)choose(null);ui();return;
 }
 const b=storageAtPoint(e)||state.buildings.find(b=>b.x===p.x&&b.y===p.y)||state.roads.find(r=>r.x===p.x&&r.y===p.y);selectedBuilding=b||null;dom.property($('#selected'),'hidden',!b);if(b)renderSelection();
});
function choose(t,assetId=null,ordinaryKey=null){
 build=t;placementAssetId=assetId;placementOrdinaryKey=assetId?null:ordinaryKey||t;dom.property($('#cancel'),'hidden',!t);
 const name=assetId?CATALOG.find(m=>m.id===state.assets.find(a=>a.id===assetId)?.modelId)?.name:ordinaryItem(placementOrdinaryKey)?.name;
 dom.text($('#hint'),t?`点击空地放置${name} · ${assetId?'持有 NFT，放置免费':ordinaryItem(placementOrdinaryKey).cost+' 经营币 / 座'} · Esc 取消`:'左键拖动平移 · 右键拖动旋转 · 滚轮缩放 · 点击设施可拆除');
 document.querySelectorAll('.buildcard').forEach(b=>b.classList.toggle('chosen',b.dataset.type===t));
}
function openOrdinaryShop(focusTypes=[]){
 shopFilters={group:'all',grade:'all',q:'',types:Array.isArray(focusTypes)?[...new Set(focusTypes)]:[]};
 dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">OPERATING CASH · COMPLETE FACILITIES</div><h1>经营币设施商店</h1><p>18 类设施 · 46 款 · 生产与工具设施各三档。当前 <b>${state.cash} 经营币</b>；每座按价购买，本轮使用。已有 NFT 仍可免费按件数放置。</p><div class="ordinary-shop-tools"><label>搜索设施<input id="ordinary-search" placeholder="例如：水井、风车磨坊、仓库、奶牛牧场" aria-label="搜索普通设施"></label><label>能力档位<select id="ordinary-grade" aria-label="普通设施能力档位"><option value="all">全部档位</option>${ORDINARY_GRADES.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}<option value="general">通用配套</option></select></label></div><div class="ordinary-groups">${[['all','全部'],['production','农业与生产'],['utilities','供水与能源'],['logistics','仓储与物流'],['construction','道路与装饰']].map(([id,label])=>`<button data-shop-group="${id}" class="${id==='all'?'active':''}">${label}</button>`).join('')}</div><div class="ordinary-summary"><span id="ordinary-count"></span><button id="ordinary-clear">显示全部设施</button></div><div id="ordinary-focus-note"></div><div class="ordinary-shop" id="ordinary-grid"></div>`);
 $('#ordinary-search').oninput=e=>{shopFilters.q=e.target.value;renderOrdinaryGallery()};$('#ordinary-grade').onchange=e=>{shopFilters.grade=e.target.value;renderOrdinaryGallery()};
 document.querySelectorAll('[data-shop-group]').forEach(button=>button.onclick=()=>{shopFilters.group=button.dataset.shopGroup;shopFilters.types=[];renderOrdinaryGallery()});
 $('#ordinary-clear').onclick=()=>{shopFilters={group:'all',grade:'all',q:'',types:[]};$('#ordinary-search').value='';$('#ordinary-grade').value='all';renderOrdinaryGallery()};
 renderOrdinaryGallery();if(!modal.open)modal.showModal();
}
function renderOrdinaryGallery(){
 const all=ordinaryShopItems(),f=shopFilters,q=f.q.trim().toLowerCase(),family=type=>TYPE_NAMES[type]||({barn:'综合仓库',wheat:'麦田',road:'道路',tree:'装饰'}[type]||type);
 const required=new Set(challengeReadiness(state,challengeView(state).plan.id).checks.flatMap(c=>c.buildTypes||[]));
 const items=all.filter(m=>(!f.types.length||f.types.includes(m.type))&&(f.group==='all'||ORDINARY_GROUPS[f.group]?.includes(m.type))&&(f.grade==='all'||f.grade==='general'&&m.grade===undefined||String(m.grade)===f.grade)&&(!q||[m.name,family(m.type),m.type,goodsText(m.outputs||{}),['barn','silo','warehouse'].includes(m.type)?'仓库 粮仓 粮食仓储 加工仓储':'',m.grade===undefined?'通用配套':ORDINARY_GRADES[m.grade]].some(value=>searchMatches(q,value))));
 dom.text($('#ordinary-count'),`显示 ${items.length} / ${all.length} 款`);dom.text($('#ordinary-focus-note'),f.types.length?'已定位任务所需设施；任一档都能满足类型要求，放置后需启用并接通道路。':'');
 document.querySelectorAll('[data-shop-group]').forEach(b=>b.classList.toggle('active',b.dataset.shopGroup===f.group));
 dom.html($('#ordinary-grid'),items.map(m=>{const desc=m.cycle?inputText(m)+' → '+goodsText(m.outputs):m.desc||effectText(m);return `<article data-shop-type="${m.type}"><div class="ordinary-card-top"><span>${TYPE_ICONS[m.type]||types[m.type].icon}</span><small>${m.grade===undefined?'通用配套':ORDINARY_GRADES[m.grade]}</small></div><span class="ordinary-family">${family(m.type)}${required.has(m.type)?' · 任务所需':''}</span><h3>${m.name}</h3><p>${desc}</p><small>${m.cycle?'每 '+m.cycle+' 秒 / 次 · 另计搬运时间':m.shippingTime?'每次运输 '+m.shippingTime+' 秒':m.handlingReduction?'范围 '+m.radius+' 格，搬运提速 '+Math.round(m.handlingReduction*100)+'%':m.storage?'容量 +'+Object.values(m.storage)[0]+(m.radius?' · 范围 '+m.radius+' 格':''):m.desc||''}</small><strong>${m.cost} <small>经营币</small></strong><button data-ordinary="${m.id}" ${state.cash<m.cost?'disabled':''}>${state.cash<m.cost?'还差 '+(m.cost-state.cash)+' 经营币':'选择建造 ↗'}</button></article>`}).join('')||'<p>没有符合筛选的设施，请点击“显示全部设施”。</p>');
 document.querySelectorAll('[data-ordinary]').forEach(button=>button.onclick=()=>{const item=ordinaryItem(button.dataset.ordinary);modal.close();selectedBuilding=null;dom.property($('#selected'),'hidden',true);choose(item.type,null,item.id)});
}
Object.entries(types).filter(([key])=>['wheat','vegetable','lumber','road','tree'].includes(key)).forEach(([key,t])=>{const b=document.createElement('button');b.className='buildcard';b.dataset.type=key;dom.property(b,'title',t.desc);dom.html(b,`<i>${t.icon}</i><span><b>${t.name}</b><small>◈ ${t.cost} 经营币</small></span>`);b.onclick=()=>choose(build===key?null:key);$('#buildings').append(b)});
const ordinaryButton=document.createElement('button');ordinaryButton.className='buildcard ordinarybuild';dom.html(ordinaryButton,'<i>◈</i><span><b>经营币设施商店</b><small>水井 · 能源 · 仓储 · 工坊 ↗</small></span>');ordinaryButton.onclick=openOrdinaryShop;$('#buildings').append(ordinaryButton);
const assetButton=document.createElement('button');assetButton.className='buildcard assetbuild';dom.html(assetButton,'<i>✦</i><span><b>NFT 背包</b><small id="nft-available">按持有数量免费放置 ↗</small></span>');assetButton.onclick=()=>market('owned');$('#buildings').append(assetButton);
$('#cancel').onclick=()=>choose(null);document.addEventListener('keydown',e=>{if(e.key==='Escape')choose(null)});
$('#deliver').onclick=()=>{if(startDelivery(state)){ui();toast(`货车出发！${state.delivery.fast?'电力快递':'普通货车'} ${state.delivery.duration} 秒后回到货运站结算。`)}else toast('货车暂时无法出发，请检查库存与通往地图边缘的道路或空地。')};
document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{state.selectedOrder=b.dataset.order;ui()});
for(const q of QUESTS)$('#quest-'+q.id).onclick=()=>{if(claimQuest(state,q.id)){ui();toast(q.name+'已达成，获得 '+q.reward+' '+CURRENCY.name+'。')}};
document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{exchangeFilters={...exchangeFilters,type:'all',tier:'all',min:'',max:'',q:'',group:b.dataset.route};market()});
$('#claim').onclick=async()=>{if(chainWallet?.active){try{await chainWallet.claim();audio.effect('reward');ui()}catch(error){toast(error.message)}return}const before=state.token,stage=challengeView(state).stage;if(claimReward(state)){audio.effect('reward');effects.burst(8,8,'#ffdc79');ui();toast(`第 ${stage} 阶段奖励已到账：＋${state.token-before} TOM。${stage===CHALLENGES.length?'今日五阶段全部完成！':'新开局建设后继续下一阶段。'}`)}};
$('#startchallenge').onclick=previewDailyChallenge;$('#retrychallenge').onclick=previewDailyChallenge;
function zoomTo(z){zoom=Math.max(.55,Math.min(3,z));dom.text($('#zoomvalue'),Math.round(zoom*100)+'%')}$('#zoomin').onclick=()=>zoomTo(zoom+.1);$('#zoomout').onclick=()=>zoomTo(zoom-.1);$('#pause').onclick=()=>{paused=!paused;dom.text($('#pause'),paused?'▶':'Ⅱ');dom.attribute($('#pause'),'aria-label',paused?'继续经营':'暂停');dom.text($('.pill'),paused?'● 生产已暂停':'● 自动生产中');audio.setPaused(paused);experience?.render();renderCargoFlow();if(selectedBuilding&&isStorage(selectedBuilding))renderSelection();toast(paused?'小镇休息一下，再次点击继续':'小镇恢复生产')};

const modal=$('#modal');$('#close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function record(kind,asset,price=0,seller=null){world.activity.unshift({kind,assetId:asset.id,modelId:asset.modelId,price,buyer:world.active,seller,time:new Date().toISOString()});world.activity=world.activity.slice(0,100);save()}
function allAssets(){if(chainWallet?.active)return chainWallet.assets;return Object.entries(world.accounts).flatMap(([owner,s])=>s.assets.map(asset=>({owner,asset,model:CATALOG.find(m=>m.id===asset.modelId)})))}
function showFarm(){document.body.classList.remove('market-mode');window.scrollTo({top:0,behavior:'instant'});marketActive=false;dom.property($('#farmmain'),'hidden',false);dom.property($('#marketpage'),'hidden',true);document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view==='farm'));requestAnimationFrame(resize)}
function refreshMarketStats(){const listings=allAssets().filter(e=>e.asset.listingPrice);if($('#marketbalance'))dom.text($('#marketbalance'),state.token);if($('#marketissued'))dom.text($('#marketissued'),chainWallet?.active?chainWallet.totalMinted:allAssets().length);if($('#marketfloor'))dom.text($('#marketfloor'),listings.length?Math.min(...listings.map(e=>e.asset.listingPrice)):'—');if($('#marketvolume'))dom.text($('#marketvolume'),world.activity.filter(e=>e.kind==='sale').reduce((n,e)=>n+e.price,0));const counts={catalog:CATALOG.length,listings:listings.length,owned:state.assets.length,favorites:state.favorites.length,activity:world.activity.length};for(const [key,count]of Object.entries(counts)){const label=document.querySelector('[data-extab="'+key+'"] small');if(label)dom.text(label,count)}}
function market(view='catalog'){
 document.body.classList.add('market-mode');marketView=view;marketActive=true;if(chainWallet?.active)chainWallet.refreshMarket();dom.property($('#farmmain'),'hidden',true);dom.property($('#marketpage'),'hidden',false);
 document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view==='market'));
 const tabs=[['catalog','发行商店'],['listings','正在出售'],['owned','我的 NFT'],['favorites','已收藏'],['activity','市场动态']];
 dom.replaceHTML($('#marketpage'),`<section class="exchangeintro"><div><div class="eyebrow">MEADOW FARM · ASSET MARKETPLACE</div><h1>拥有小镇的<span>下一种可能。</span></h1><p>从一座风车，到一整条生产线。发现、拥有、交易你的农场资产。</p><button class="exback" id="backfarm">← 返回我的农场</button></div><div class="exchangeintroart">${assetArt(CATALOG[1])}<small>BUILD. OWN. GROW.</small></div></section><section class="exstats"><div class="collectionidentity"><span>✳</span><div><b>云野生产 NFT</b><small>能源 / 农业 / 物流 / 仓储</small></div><i>✓</i></div><div><small>挂单地板价</small><b><span id="marketfloor">—</span> <em>${CURRENCY.symbol}</em></b></div><div><small>${chainWallet?.active?'本机记录成交额':'本地成交额'}</small><b><span id="marketvolume">0</span> <em>${CURRENCY.symbol}</em></b></div><div><small>已发行 NFT</small><b id="marketissued">0</b></div><div><small>我的余额</small><b><span id="marketbalance">${state.token}</span> <em>${CURRENCY.symbol}</em></b></div></section><div class="exchangeheading"><div><h2>${view==='activity'?'每一笔，都有迹可循':'探索 NFT 生产工具'}<span> .</span></h2><p>NFT 是生产资产；${CURRENCY.name} 是购买、交易与奖励使用的代币。</p></div><span>${chainWallet?.active?'Sepolia · '+(chainWallet.connected?esc(world.active.slice(0,6)+'…'+world.active.slice(-4)):localize('未连接钱包')):'农场主 '+world.active+' · 本地体验'}</span></div><div class="extabs">${tabs.map(([id,label])=>`<button data-extab="${id}" class="${view===id?'active':''}">${label}<small>${id==='catalog'?CATALOG.length:id==='listings'?allAssets().filter(e=>e.asset.listingPrice).length:id==='owned'?state.assets.length:id==='favorites'?state.favorites.length:world.activity.length}</small></button>`).join('')}</div>${view==='activity'?'<div id="exactivity"></div>':`<div class="exlayout"><aside class="exfilters"><div class="filterheading"><b>☷ 筛选条件</b><button id="clearfilters">重置</button></div><label>资产类型<select id="ex-type" aria-label="资产类型"><option value="all">全部类型</option>${Object.entries(TYPE_NAMES).map(([id,name])=>`<option value="${id}" ${exchangeFilters.type===id?'selected':''}>${name}</option>`).join('')}</select></label><label>品质<select id="ex-tier" aria-label="品质"><option value="all">全部品质</option>${TIERS.map((t,i)=>`<option value="${i}" ${String(exchangeFilters.tier)===String(i)?'selected':''}>${t}</option>`).join('')}</select></label><label>价格区间 · ${CURRENCY.name}<div class="expriceinputs"><input id="ex-min" type="number" min="0" placeholder="最低" aria-label="最低价格" value="${esc(exchangeFilters.min)}"><span>—</span><input id="ex-max" type="number" min="0" placeholder="最高" aria-label="最高价格" value="${esc(exchangeFilters.max)}"></div></label><div class="filterfoot">每件已发行 NFT 拥有独立编号。<br>生产属性固定，挂单售价由持有者设置。</div><div class="mintsidebar"><span>✧</span><b>为小镇添一份生产力</b><p>用 ${CURRENCY.name} 购买 NFT，再回到农场连接生产线。</p><button id="sidebarcatalog">浏览发行商店 ↗</button></div></aside><section class="exgallery"><div class="extoolbar"><label class="exsearch">⌕ <input id="ex-search" placeholder="搜索名称、型号或资产编号" aria-label="搜索资产" value="${esc(exchangeFilters.q)}"></label><select id="ex-sort" aria-label="排序资产"><option value="price-low">价格：从低到高</option><option value="price-high">价格：从高到低</option><option value="output">基础产能：从高到低</option><option value="name">名称排序</option></select></div><div class="toolgroups">${[['all','全部'],['energy','能源'],['storage','灌溉仓储'],['transport','运输'],['food','牧场甜品'],['harvest','种植与林业']].map(([id,name])=>`<button data-group="${id}" class="${(exchangeFilters.group||'all')===id?'active':''}">${name}</button>`).join('')}</div><div class="exsummary"><span id="excount"></span><span><i class="live"></i> ${chainWallet?.active?'Sepolia 链上数据':'本地模拟数据'}</span></div><div id="exgrid" class="exgrid"></div></section></div>`}<div class="exdisclaimer">${chainWallet?.active?'NFT 与 TOM 在 Sepolia 测试网发行和交易。市场动态仅记录此浏览器发起并确认的操作，完整记录请查看钱包中的区块浏览器链接。':'本地体验账户 A / B 可切换测试买卖。初始示例挂单不是实际市场行情，价格和产能均为试玩参数。'}</div>`);
 $('#backfarm').onclick=showFarm;document.querySelectorAll('[data-extab]').forEach(b=>b.onclick=()=>market(b.dataset.extab));
 if(view==='activity')renderActivity();else{
 $('#ex-sort').value=exchangeFilters.sort;
 [['type','change'],['tier','change'],['min','input'],['max','input'],['search','input'],['sort','change']].forEach(([key,event])=>$('#ex-'+key).addEventListener(event,e=>{exchangeFilters[key==='search'?'q':key]=e.target.value;renderGallery()}));
 $('#clearfilters').onclick=()=>{exchangeFilters={type:'all',tier:'all',min:'',max:'',q:'',sort:'price-low'};market(view)};
 $('#sidebarcatalog').onclick=()=>market('catalog');document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{exchangeFilters.group=b.dataset.group;renderGallery();document.querySelectorAll('[data-group]').forEach(q=>q.classList.toggle('active',q===b))});renderGallery();
 }
 refreshMarketStats();window.scrollTo({top:0,behavior:'instant'});
}
function renderGallery(){
 const f=exchangeFilters;let entries=marketView==='catalog'?CATALOG.map(model=>({model,price:model.price,key:'model:'+model.id})):allAssets().filter(e=>marketView==='listings'?e.asset.listingPrice:marketView==='owned'?e.owner===world.active:state.favorites.includes(e.asset.id)).map(e=>({...e,key:e.asset.id,price:e.asset.listingPrice||e.model.price}));
 if(marketView==='favorites')entries.push(...CATALOG.filter(m=>state.favorites.includes('model:'+m.id)).map(model=>({model,price:model.price,key:'model:'+model.id})));
 const groups={energy:['solar','wind'],storage:['tower','silo','warehouse','well'],transport:['tractor','depot'],food:['dairy','cakery','mill','bakery'],harvest:['vegetable','lumber']};const q=f.q.trim().toLowerCase();entries=entries.filter(e=>(!groups[f.group]||groups[f.group].includes(e.model.type))&&(f.type==='all'||e.model.type===f.type)&&(f.tier==='all'||e.model.tier===Number(f.tier))&&(f.min===''||e.price>=Number(f.min))&&(f.max===''||e.price<=Number(f.max))&&(!q||[e.model.name,e.model.id,goodsText(e.model.outputs||{}),e.asset?.id||'',displayNftId(e.asset?.id||''),TYPE_NAMES[e.model.type]].some(value=>searchMatches(q,value))));
 entries.sort((a,b)=>f.sort==='price-high'?b.price-a.price:f.sort==='output'?(b.model.cycle?(Object.values(b.model.outputs)[0]||0)/b.model.cycle:0)-(a.model.cycle?(Object.values(a.model.outputs)[0]||0)/a.model.cycle:0):f.sort==='name'?localize(a.model.name).localeCompare(localize(b.model.name),languageUI.getLanguage()):a.price-b.price);
 dom.text($('#excount'),`共 ${entries.length} ${marketView==='catalog'?'种型号':'件资产'}`);
 dom.html($('#exgrid'),entries.map(e=>{const m=e.model,a=e.asset,placed=a&&world.accounts[e.owner]?.buildings?.some(b=>b.assetId===a.id),favorite=state.favorites.includes(e.key);return `<article class="excard tier${m.tier}"><button class="excardart" data-detail="${e.key}" aria-label="查看${esc(a?displayNftId(a.id):m.name)}">${assetArt(m)}<span>${TIERS[m.tier]}</span><i>↗</i></button><div class="excardtitle"><button data-detail="${e.key}">${esc(a?displayNftId(a.id):m.name)}</button><button class="favorite ${favorite?'saved':''}" data-favorite="${e.key}" aria-label="${favorite?'取消收藏':'收藏'}${esc(a?displayNftId(a.id):m.name)}" aria-pressed="${favorite}">${favorite?'♥':'♡'}</button></div><p class="excardtraits">${a?esc(m.name):TYPE_NAMES[m.type]} <span>/</span> ${TIERS[m.tier]}</p><div class="excardproduction"><span>${summaryText(m)}</span><small>${m.cycle?'基础 '+m.cycle+' 秒 / 次':'需连接道路'}</small></div><div class="excardprice"><div><small>${a?.listingPrice?'挂单售价':a?'发行参考价':'发行价'}</small><b>${e.price} <em>${CURRENCY.symbol}</em></b></div><span>${!a?'可发行':a.listingPrice?e.owner===world.active?'我的挂单':'可购买':placed?a.enabled===false?'已暂停':'使用中':'仓库中'}</span></div></article>`}).join('')||'<div class="exempty"><span>✧</span><h3>还没有符合条件的资产</h3><p>试试调整筛选条件，或去发行商店看看。</p></div>');
 document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>assetDetail(b.dataset.detail));document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{const id=b.dataset.favorite;state.favorites=state.favorites.includes(id)?state.favorites.filter(k=>k!==id):[...state.favorites,id];save();renderGallery();refreshMarketStats()});
}
function assetDetail(key){
 const entry=key.startsWith('model:')?null:allAssets().find(e=>e.asset.id===key),m=entry?.model||CATALOG.find(m=>'model:'+m.id===key);if(!m)return;const a=entry?.asset,own=entry?.owner===world.active,placed=a&&world.accounts[entry.owner]?.buildings?.some(b=>b.assetId===a.id),price=a?.listingPrice||m.price;
 dom.replaceHTML($('#modalcontent'),`<div class="assetdetail"><div class="assetdetailart tier${m.tier}">${assetArt(m)}<div>${a?displayNftId(a.id):m.id.toUpperCase()} <span>${TIERS[m.tier]}</span></div></div><div class="assetdetailinfo"><div class="eyebrow">MEADOW FARM · PRODUCTIVE NFT</div><h1>${m.name}</h1><p>持有者：${a?'农场主 '+entry.owner+(own?'（你）':''):'尚未发行'}${placed?a.enabled===false?' · 农场中，已暂停':' · 农场使用中':''}</p><div class="assetdetailtraits"><div><small>类型</small><b>${TYPE_NAMES[m.type]}</b></div><div><small>${m.cycle?'基础周期':'工具模式'}</small><b>${m.cycle?m.cycle+' 秒':m.type==='tractor'?'通电生效':'常驻生效'}</b></div><div><small>${m.radius?'作用范围':'核心功能'}</small><b>${m.radius?m.radius+' 格':summaryText(m)}</b></div></div><p class="detailrecipe">${m.cycle?'消耗：'+inputText(m)+'<br>产出：'+goodsText(m.outputs)+'<br>':''}${effectText(m)}<br>放置并连接道路后使用；可单独暂停以分配原料，挂单期间不能使用。</p><div class="detailpurchase"><small>${a?.listingPrice?'当前售价':a?'发行参考价':'发行价'}</small><strong>${price} <em>${CURRENCY.name}</em></strong><div class="purchaseactions">${!a?`<button class="primary" id="detailmint" ${state.token<price?'disabled':''}>${state.token<price?'余额不足':'用 TOM 购买 NFT ↗'}</button>`:own?(a.listingPrice?'<button class="primary" id="detailcancel">取消挂单</button><button id="detailchange">修改售价</button>':placed?`<button class="primary" id="detailrecall">收回资产</button><button id="detailtoggle">${a.enabled===false?'启用':'暂停'}</button>`:'<button class="primary" id="detailplace">免费放置 NFT ↗</button><button id="detaillist">上架出售</button>'):a.listingPrice?`<button class="primary" id="detailbuy" ${state.token<price?'disabled':''}>${state.token<price?'余额不足':'立即购买 ↗'}</button>`:'<span>当前未上架</span>'}</div><p>${own&&placed?'出售前先收回资产，未完成的生产进度会保留。':own?'已拥有此 NFT，放置不再扣 TOM 或经营币；同一件只可放置一次。':chainWallet?.active?'NFT 归属与 TOM 余额来自 Sepolia 测试网。':'NFT 归属与 TOM 余额均为本地模拟。'}</p></div></div></div>`);
 if($('#detailmint'))$('#detailmint').onclick=async()=>{if(chainWallet?.active){try{const asset=await chainWallet.buy(m.id);if(!asset)return;record('mint',asset,m.price);modal.close();ui();showFarm();choose(m.type,asset.id)}catch(error){toast(error.message)}return}const asset=purchase(state,m.id);if(!asset)return;record('mint',asset,m.price);modal.close();ui();showFarm();choose(m.type,asset.id);toast(`已购买 ${displayNftId(asset.id)}，请选择空地放置。`)};
 if($('#detailbuy'))$('#detailbuy').onclick=async()=>{if(chainWallet?.active){try{await chainWallet.buyListing(a.id,price);record('sale',a,price,entry.owner);ui();assetDetail(a.id);renderGallery()}catch(error){toast(error.message)}return}if(!transferListing(world.accounts,world.active,entry.owner,a.id,price))return toast('挂单或余额发生变化，请重新查看。');record('sale',a,price,entry.owner);ui();assetDetail(a.id);renderGallery();toast(`购买成功，${displayNftId(a.id)} 已进入我的 NFT。`)};
 if($('#detailplace'))$('#detailplace').onclick=()=>{modal.close();showFarm();choose(m.type,a.id)};
 if($('#detailtoggle'))$('#detailtoggle').onclick=()=>{setAssetEnabled(state,a.id,a.enabled===false);ui();assetDetail(a.id);renderGallery()};
 if($('#detailrecall'))$('#detailrecall').onclick=()=>{recallAsset(state,a.id);ui();assetDetail(a.id);renderGallery();toast('已收回资产，可重新放置或上架出售。')};
 if($('#detaillist'))$('#detaillist').onclick=()=>listingForm(a.id);
 if($('#detailchange'))$('#detailchange').onclick=()=>listingForm(a.id);
 if($('#detailcancel'))$('#detailcancel').onclick=async()=>{if(chainWallet?.active){try{await chainWallet.cancelListing(a.id);record('cancelled',a);ui();assetDetail(a.id);renderGallery()}catch(error){toast(error.message)}return}delete a.listingPrice;record('cancelled',a);ui();assetDetail(a.id);renderGallery();toast('挂单已取消。')};
 if(chainWallet?.active&&!chainWallet.connected)for(const id of ['detailmint','detailbuy'])if($('#'+id)){dom.property($('#'+id),'disabled',false);dom.text($('#'+id),chainWallet.connectLabel)}
 if(!modal.open)modal.showModal();
}
function listingForm(id){const a=state.assets.find(a=>a.id===id),m=CATALOG.find(m=>m.id===a.modelId);dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">LIST YOUR NFT ASSET</div><h1>${a.listingPrice?'修改售价':'上架出售'}</h1><div class="listingasset">${assetArt(m)}<div><b>${displayNftId(a.id)}</b><p>${m.name} · ${TIERS[m.tier]}</p></div></div><form id="listingform"><label class="listinglabel">出售价格（TOM Token）<input id="listingprice" type="number" min="1" max="1000000" step="1" value="${a.listingPrice||m.price}" required></label><p>${chainWallet?.active?'挂单和成交将在 Sepolia 上确认，其他钱包可使用 TOM 购买。出售前请收回资产，挂单期间不能生产。':'挂单后其他本地体验账户可以按售价购买。成交时 NFT 所有权与 TOM Token 余额同时转移，挂单期间不能投入生产。'}</p><button class="primary" type="submit">确认上架</button><button class="backbutton" type="button" id="backmarket">返回资产详情</button></form>`);$('#backmarket').onclick=()=>assetDetail(id);$('#listingform').onsubmit=async e=>{e.preventDefault();const price=Number($('#listingprice').value);if(chainWallet?.active){try{await chainWallet.list(id,price);record('listed',a,price);ui();assetDetail(id);renderGallery()}catch(error){toast(error.message)}return}if(!listAsset(state,id,price))return toast('请输入有效售价，并先将资产收回。');record('listed',a,price);ui();assetDetail(id);renderGallery();toast('资产已上架，可切换另一体验账户购买。')}}
function renderActivity(){const labels={mint:'发行',listed:'上架',cancelled:'取消挂单',sale:'成交'};dom.html($('#exactivity'),world.activity.length?`<div class="exactivityhead"><span>资产</span><span>事件</span><span>价格</span><span>时间</span></div>`+world.activity.map(e=>{const m=CATALOG.find(m=>m.id===e.modelId);return `<div class="exactivityrow"><div>${assetArt(m)}<span><b>${displayNftId(e.assetId)}</b><small>${m.name}</small></span></div><span>${labels[e.kind]||e.kind}</span><b>${e.price||'—'} <small>${CURRENCY.symbol}</small></b><time>${new Date(e.time).toLocaleTimeString(languageUI.getLanguage(),{hour:'2-digit',minute:'2-digit',hour12:false})}</time></div>`}).join(''):'<div class="exempty"><span>✧</span><h3>小镇的第一笔交易，等你开启</h3><p>发行、挂单和成交会记录在这里。</p></div>')}
function switchAccount(id){if(!world.accounts[id])return;world.active=id;state=world.accounts[id];simAccumulator=0;animationSeconds=state.seconds;frameTime=null;selectedBuilding=null;dom.property($('#selected'),'hidden',true);choose(null);modal.close();ui();if(marketActive)market(marketView);toast(`已切换到农场主 ${id}，显示该账户的农场、资产与余额。`)}
function guide(){dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">THE MEADOW RULEBOOK</div><h1>先经营一座好小镇</h1><p>参考 Town Star 的布局、生产与贸易思路，使用云野自己的试玩配方与数值。</p>${chainWallet?.active?'<p class="chain-guide-note">先连接 MetaMask 并切换到 Sepolia，领取测试 ETH 支付 Gas，再在钱包窗口领取一次 200 测试 TOM。开始挑战和领取奖励各需确认链上交易；生产进度由服务端规则重放验证。农场按钱包地址保存在此浏览器，换设备不会同步地图。</p>':''}<div class="guidegrid"><section><h3>01 · NFT 与 TOM Token</h3><p>太阳能板、面包房、牧场等属于 NFT，每件有独立编号、归属和生产能力。${CURRENCY.name} 是你发行的代币，用于购买 NFT、玩家交易结算和挑战奖励。NFT 是资产，TOM 是支付单位。经营币用于购买所有普通基础设施，包括水井、太阳能板、仓库和加工工坊；每放置一座按价扣款。</p></section><section><h3>02 · 十四类 NFT，二十二种型号</h3><p>水井与水塔负责供水，太阳能板和风力机发电，拖拉机加速附近搬运。奶牛牧场消耗小麦与水产奶，蛋糕工坊使用面粉、牛奶、面包与电力制作蛋糕。普通设施采用木灰外观，本轮重开后消失；NFT 采用青绿金色与专属标识，性能更强。每件 NFT 有独立编号、发行价、产能及配方，可收回、重新放置和设价挂单；${chainWallet?.active?'连接不同钱包可进行链上买卖。':'切换本地体验账户可测试购买与成交。'}</p></section><section><h3>03 · 布局决定效率</h3><p>生产资产和仓库必须紧邻连接货运站的道路。水井范围内的麦田生长更快；高物体紧邻麦田会遮阴，建筑紧邻磨坊会挡风。距离仓库越远，搬运时间越长。</p></section><section><h3>04 · 仓储与贸易</h3><p>新开局须先接通仓储：综合仓库让粮食与加工品容量各增加 200，也可使用已有仓储 NFT；水箱和电池各 100。筒仓、货仓、水塔接通道路后扩容；收回时保留库存，超容后暂停增加该类物资。可出售面包、牛奶、蛋糕、蔬菜或木材；快递站每次消耗 1 电力，普通版运输 10 秒，NFT 版 7 秒，未通电时为 12 秒。</p></section><section><h3>05 · 每日经营挑战</h3><p>每天五个阶段依次解锁：面包保供 5 分钟 / 24 TOM、早餐扩产 7 分钟 / 32 TOM、牧场协作 9 分钟 / 44 TOM、甜品工坊 11 分钟 / 60 TOM、丰收庆典 15 分钟 / 80 TOM。每阶段有独立奖励，只能领取一次。准备时间不限，先赚经营币补齐产线再计时；未完成可以保留建设重试，不丢失已领奖励。每轮只结算一个阶段。下一次领取 TOM 前需新开局，可用经营币一键重建原布局；TOM 与 NFT 永久保留，NFT 放置不扣经营币，持有几件就能同时放几件。需完成本轮新生产与货车回站交付目标。超时未达标可以重试；达标后奖励锁定，可在当天领取。暂停、关页仍计时，北京时间 00:00 重置当日五阶段进度。</p></section><section><h3>06 · 本版采用轻量规则</h3><p>白天 120 秒、夜晚 60 秒，太阳能夜间暂停，风力机可持续发电。搬运提速取范围内最强效果，不叠加；仓储容量可以叠加。首次发电、产奶和蛋糕委托各有一次性 ${CURRENCY.symbol} 奖励，与当轮限时挑战奖励一起结算。暂不收取工资或燃油，关闭页面后生产暂停。货车出售时沿道路出镇、交货后空车返回，回到货运站时结算；暂停会冻结运输动画。村民在生产结束后抱货沿路送到仓库，货物到达时增加库存；虚线与图标显示货物流向。清水与电力不由村民搬运。${chainWallet?.active?'TOM 与 NFT 在 Sepolia 链上结算；经营币、库存与地图存储于当前浏览器。':'所有资产和交易均为本地模拟。'}</p></section></div><p>参考资料：<a href="https://news.gala.com/common-ground-world/the-town-star-rulebook/" target="_blank" rel="noopener">Town Star 官方规则书（2022）</a> · <a href="https://support.gala.com/hc/en-us/articles/22441184787483-Town-Star-Town-Star-Mode" target="_blank" rel="noopener">官方模式说明</a> · <a href="https://support.gala.com/hc/en-us/articles/22440841171355-Proximity-Effects-In-Town-Star" target="_blank" rel="noopener">建筑邻近影响说明</a></p>`);modal.showModal()}
$('#openassets').onclick=()=>market('owned');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='market')market();else if(b.dataset.view==='guide')guide();else if(b.dataset.view==='farm')showFarm()});
$('#wallet').onclick=()=>{dom.replaceHTML($('#modalcontent'),`<div class="eyebrow">LOCAL DEMO ACCOUNTS</div><h1>选择一位农场主</h1><p>两个本地体验账户拥有独立农场和余额，可互相买卖已挂单的 NFT 资产。</p>${Object.entries(world.accounts).map(([id,s])=>`<button class="accountoption" data-account="${id}"><span>🌱</span><div><b>农场主 ${id} ${world.active===id?'· 当前账户':''}</b><small>${s.token} ${CURRENCY.name} · ${s.assets.length} 件资产</small></div><i>↗</i></button>`).join('')}<p>仅用于本地试玩，不连接钱包或真实资产。</p>`);document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>switchAccount(b.dataset.account));modal.showModal()};
function previewNewRound(){
 const quote=roundLayoutQuote(state),t=(cn,en)=>languageUI.getLanguage()==='en'?en:cn;
 dom.replaceHTML($('#modalcontent'),`<div data-i18n-ignore><div class="eyebrow">A FRESH ROUND, A FAMILIAR FARM</div><h1>${t('新一轮，沿用你的好布局','A fresh round, your familiar layout')}</h1><p>${t('每轮获得 3,000 经营币。可以继续原有布局，也可以从空地自由建设。','Each round starts with 3,000 farm coins. Rebuild your layout or start with clear land.')}</p><label class="reuse-layout"><input id="reuse-layout" type="checkbox" ${quote.allowed?'checked':''} ${quote.allowed?'':'disabled'}><span><b>${t('沿用上一轮布局','Reuse the previous layout')}</b><small>${t('按当前标价重新购买普通设施；已有 NFT 免费原位放置。','Repurchase ordinary buildings at current prices; place owned NFTs for free.')}</small></span></label><div class="reuse-summary"><div><span>${t('布局设施与道路','Buildings & roads')}</span><b>${quote.count||quote.items.length}</b></div><div><span>${t('重建费用','Rebuild cost')}</span><b id="reuse-cost">${quote.allowed?quote.cost:0} ◈</b></div><div><span>${t('重建后余额','Balance after rebuild')}</span><b id="reuse-balance">${quote.allowed?ROUND_CASH-quote.cost:ROUND_CASH} ◈</b></div></div>${!quote.allowed?`<p class="demolition-note">${t('此布局暂时无法复用：','Cannot reuse this layout: ')}${esc(localize(quote.reason))}${t('。可选择空地开局。','. You can start with clear land.')}</p>`:''}<div class="round-keeps"><b>${t('永久保留','Keep permanently')}</b><p>${state.token} TOM · ${state.assets.length} NFT · ${t('收藏、交易、销售报表与偏好设置','favorites, trades, sales reports & preferences')}</p></div><p>${t('新一轮清空农产品、水电、在制批次及本轮进度。每日已领奖阶段不重置；新奖励仍需在新一轮完成生产与交付。','Stock, water, power, batches and round progress reset. Paid daily stages remain paid; earn the next reward with fresh production and deliveries.')}</p><button class="primary" id="confirmreset">${t('确认开始新一轮','Start this new round')}</button></div>`);
 if(!modal.open)modal.showModal();
 $('#reuse-layout').onchange=()=>{const cost=$('#reuse-layout').checked?quote.cost:0;dom.text($('#reuse-cost'),cost+' ◈');dom.text($('#reuse-balance'),(ROUND_CASH-cost)+' ◈')};
 $('#confirmreset').onclick=async()=>{
  const original=state;if(chainWallet?.active){try{await chainWallet.checkpoint();if(state!==original)return}catch(error){toast(error.message);return}}
  const reuse=$('#reuse-layout').checked,freshQuote=roundLayoutQuote(state);
  if(reuse&&(!freshQuote.allowed||freshQuote.cost!==quote.cost)){previewNewRound();return}
  const next=startNewRound(state,reuse);if(!next){previewNewRound();return}
  state=next;world.accounts[world.active]=state;simAccumulator=0;animationSeconds=0;frameTime=null;paused=false;audio.setPaused(false);dom.text($('#pause'),'Ⅱ');dom.text($('.pill'),'● 自动生产中');selectedBuilding=null;dom.property($('#selected'),'hidden',true);choose(null);ui();modal.close();showFarm();audio.effect('build');toast(t(reuse?'新一轮开始：布局已重建，库存从零开始。':'新一轮开始：3,000 经营币已就绪。',reuse?'New round: layout rebuilt, stock reset.':'New round: 3,000 farm coins ready.'));
 };
}
$('#reset').onclick=previewNewRound;$('#newround').onclick=previewNewRound;
document.addEventListener('visibilitychange',()=>{frameTime=null;lastPaintKey='';if(document.hidden)save();else ui()});
window.addEventListener('pagehide',()=>save());
document.addEventListener('languagechange',()=>{if(marketActive&&exchangeFilters.sort==='name')renderGallery();if($('#reuse-layout')){const reuse=$('#reuse-layout').checked;previewNewRound();if(!$('#reuse-layout').disabled){dom.property($('#reuse-layout'),'checked',reuse);$('#reuse-layout').dispatchEvent(new Event('change'))}}});
function resetCamera(){pan={x:0,y:0};rotation=0;zoomTo(1.25);resize()}
experience=mountFarmExperience({getState:()=>state,refresh:ui,localize,notify:toast,isPaused:()=>paused,audio,
 start:previewDailyChallenge,togglePause:()=>$('#pause').click(),shop:()=>openOrdinaryShop(),newRound:previewNewRound,
 resetCamera,graphicsChanged:resize,guide:()=>{if(modal.open)modal.close();guide()},dialog:html=>{dom.replaceHTML($('#modalcontent'),html);if(!modal.open)modal.showModal()}});
villageExperience=mountVillage({getState:()=>state,refresh:ui,localize,notify:toast,audio,dialog:html=>{dom.replaceHTML($('#modalcontent'),html);if(!modal.open)modal.showModal()}});
farmShell=mountFarmShell({getState:()=>state,refresh:ui,village:tab=>villageExperience.open(tab),help:()=>experience.open('help')});
chainWallet=mountChainWallet({getState:()=>state,getWorld:()=>world,refresh:ui,notify:toast,marketUpdated:()=>{if(marketActive){refreshMarketStats();renderGallery()}},
 dialog:html=>{dom.replaceHTML($('#modalcontent'),html);if(!modal.open)modal.showModal()},
 switchWorld:(next,key)=>{save();world=next;state=world.accounts[world.active];activeSaveKey=key;simAccumulator=0;animationSeconds=state.seconds;frameTime=null;selectedBuilding=null;dom.property($('#selected'),'hidden',true);choose(null);showFarm();ui()}});
$('#rotateleft').onclick=()=>rotation-=Math.PI/12;$('#rotateright').onclick=()=>rotation+=Math.PI/12;$('#homeview').onclick=resetCamera;$('#fitmap').onclick=()=>{pan={x:0,y:0};zoomTo(1)};
if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{sceneVisible=entries[0].isIntersecting;if(sceneVisible)lastPaintKey=''}).observe(canvas);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();if(r.width!==W||r.height!==H)resize()}).observe(canvas);
window.addEventListener('resize',resize);zoomTo(zoom);resize();ui();requestAnimationFrame(draw);
