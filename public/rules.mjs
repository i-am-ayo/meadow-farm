import {trace,enableTrace} from './trace.mjs?v=8.1';
import {villageState,recordVillageProduction,recordVillageTrip,advanceVillage,researchRank,productionMultiplier} from './village.mjs?v=8.1';
import {shouldYieldIngredients} from './production-planner.mjs?v=8.1';
import {ordinaryCatalog} from './ordinary.mjs?v=8.1';
import {nftId} from './economy.mjs?v=8.1';
import {findHaulRoute,isCargo,sampleHauler} from './hauling.mjs?v=8.1';
import {CHALLENGES,today,dailyState,activeChallengeId,beginChallenge,retryChallenge,recordChallengeProduction,recordChallengeDelivery,dailyCleared,claimDailyReward} from './daily-challenge.mjs?v=8.1';
export {CHALLENGES,today,dailyState,challengePlan,challengeView,dailyCleared,goalValue} from './daily-challenge.mjs?v=8.1';
import {findTruckRoute} from './transport.mjs?v=8.1';
import {MAP_SIZE,MAP_CENTER,RIVER_COLUMN,ROUND_CASH} from './geography.mjs?v=8.1';
export {MAP_SIZE,MAP_CENTER,RIVER_COLUMN,ROUND_CASH} from './geography.mjs?v=8.1';
import {recordSale} from './sales.mjs?v=8.1';
import {RESOURCE_NAMES,RESOURCE_ICONS,WAREHOUSE_GOODS,warehouseStock} from './goods.mjs?v=8.1';
export {RESOURCE_NAMES,RESOURCE_ICONS,WAREHOUSE_GOODS,warehouseStock} from './goods.mjs?v=8.1';
import {findTimberTree,fellTree,treeReady} from './forestry.mjs?v=8.1';
export const CATALOG=[
 {id:'mill-rustic',type:'mill',name:'田园风车磨坊',tier:0,price:28,cycle:8,inputs:{wheat:2},outputs:{flour:1}},
 {id:'mill-breeze',type:'mill',name:'晨风精制磨坊',tier:1,price:75,cycle:7,inputs:{wheat:4},outputs:{flour:3}},
 {id:'mill-gale',type:'mill',name:'金翼高效磨坊',tier:2,price:180,cycle:6,inputs:{wheat:6},outputs:{flour:5}},
 {id:'bakery-hearth',type:'bakery',name:'暖炉面包房',tier:0,price:36,cycle:10,inputs:{flour:2,water:1},outputs:{bread:1}},
 {id:'bakery-artisan',type:'bakery',name:'匠心面包工坊',tier:1,price:95,cycle:9,inputs:{flour:4,water:2},outputs:{bread:3}},
 {id:'bakery-sunrise',type:'bakery',name:'金麦烘焙坊',tier:2,price:220,cycle:8,inputs:{flour:6,water:3},outputs:{bread:5}},
 {id:'well-stone',type:'well',name:'石砌水井',tier:0,price:10,cycle:6,inputs:{},outputs:{water:6},radius:2},
 {id:'well-spring',type:'well',name:'泉涌水井',tier:1,price:35,cycle:6,inputs:{},outputs:{water:12},radius:3},
 {id:'well-deep',type:'well',name:'深泉水井',tier:2,price:90,cycle:5,inputs:{},outputs:{water:24},radius:4},

 {id:'solar-garden',type:'solar',name:'庭院太阳能板',tier:0,price:24,cycle:8,inputs:{},outputs:{energy:2},dayOnly:true},
 {id:'solar-array',type:'solar',name:'追光光伏阵列',tier:1,price:65,cycle:8,inputs:{},outputs:{energy:5},dayOnly:true},
 {id:'wind-meadow',type:'wind',name:'原野风力机',tier:1,price:48,cycle:10,inputs:{},outputs:{energy:3}},
 {id:'tower-rain',type:'tower',name:'雨露灌溉水塔',tier:0,price:26,cycle:0,inputs:{},outputs:{},radius:3,storage:{water:100}},
 {id:'silo-bulk',type:'silo',name:'丰收筒仓',tier:0,price:38,cycle:0,inputs:{},outputs:{},storage:{wheat:200}},
 {id:'warehouse-logistics',type:'warehouse',name:'集配货仓',tier:1,price:50,cycle:0,inputs:{},outputs:{},storage:{processed:160}},
 {id:'tractor-field',type:'tractor',name:'田野电动拖拉机',tier:0,price:34,cycle:0,inputs:{},outputs:{},radius:3,handlingReduction:.5,chargeCost:1},
 {id:'tractor-ranger',type:'tractor',name:'巡野运输机器人',tier:1,price:78,cycle:0,inputs:{},outputs:{},radius:5,handlingReduction:.75,chargeCost:2},
 {id:'depot-express',type:'depot',name:'闪送快递站',tier:1,price:44,cycle:0,inputs:{},outputs:{},shippingTime:7},
 {id:'dairy-clover',type:'dairy',name:'苜蓿奶牛牧场',tier:0,price:42,cycle:12,inputs:{wheat:3,water:2},outputs:{milk:2}},
 {id:'garden-verde',type:'vegetable',name:'青畦蔬菜园',tier:0,price:18,cycle:10,inputs:{water:2},outputs:{vegetables:3}},
 {id:'lumber-grove',type:'lumber',name:'林间伐木场',tier:0,price:32,cycle:12,inputs:{},outputs:{wood:3},radius:4},
 {id:'cakery-cloud',type:'cakery',name:'云朵蛋糕工坊',tier:1,price:58,cycle:16,inputs:{flour:2,milk:1,bread:1,energy:1},outputs:{cake:2}}
];
export const TIERS=['普通','精良','珍稀'];
export const TYPE_NAMES={mill:'风车磨坊',bakery:'面包房',well:'水井',solar:'太阳能',wind:'风力机',tower:'灌溉水塔',silo:'粮仓',warehouse:'货仓',tractor:'运输工具',depot:'快递站',dairy:'奶牛牧场',cakery:'蛋糕工坊',vegetable:'蔬菜种植',lumber:'伐木场'};
export const TYPE_ICONS={mill:'🏡',bakery:'🥖',well:'💧',solar:'🔆',wind:'🌬️',tower:'🚰',silo:'🌾',warehouse:'📦',tractor:'🚜',depot:'🚚',dairy:'🐄',cakery:'🍰',vegetable:'🥬',lumber:'🪓'};
export const TOOL_TYPES=['solar','wind','tower','silo','warehouse','tractor','depot','dairy','cakery','vegetable','lumber'];
export const BASE_ROADS=[...Array.from({length:9},(_,i)=>({x:i+1,y:5})),...Array.from({length:9},(_,i)=>({x:6,y:i+1})),...Array.from({length:5},(_,i)=>({x:i+1,y:6})),{x:7,y:8}].filter((p,i,a)=>a.findIndex(q=>q.x===p.x&&q.y===p.y)===i);
export const BASIC_BUILDINGS={wheat:{name:'麦田',icon:'🌾',cost:30,desc:'消耗 1 清水，产出 2 小麦。'},road:{name:'乡间道路',icon:'🛤️',cost:5,desc:'连接工坊、仓库和货运站；铺在溪流上可搭建木桥。'},tree:{name:'果树',icon:'🌳',cost:20,desc:'可供附近伐木场采伐，砍后 90 秒再生；靠近作物会遮阴。'}};
export const ORDINARY_CATALOG=ordinaryCatalog(CATALOG);
export const ORDINARY_BY_ID=Object.fromEntries(ORDINARY_CATALOG.map(m=>[m.id,m]));
export const ORDINARY_MODELS=Object.fromEntries(ORDINARY_CATALOG.filter(m=>m.grade===0).map(m=>[m.type,m]));
for(const [type,m]of Object.entries(ORDINARY_MODELS))BASIC_BUILDINGS[type]={name:m.name,icon:TYPE_ICONS[type],cost:m.cost,desc:m.cycle?inputText(m)+' → '+goodsText(m.outputs):effectText(m)};
BASIC_BUILDINGS.barn={name:'普通综合仓库',icon:'📦',cost:160,desc:'粮食与加工品容量各增加 200，需要连接道路。'};
export const ORDERS=[{id:'bread',name:'面包店的清晨',icon:'🥖',resource:'bread',amount:3,cash:90,stars:40,desc:'为村里的早餐铺送去新鲜面包。'},{id:'milk',name:'牧场鲜奶直送',icon:'🥛',resource:'milk',amount:3,cash:120,stars:55,desc:'收集牧场鲜奶，送往溪谷集市。'},{id:'cake',name:'小镇庆典蛋糕',icon:'🍰',resource:'cake',amount:2,cash:240,stars:100,desc:'用蛋糕工坊的手艺，为庆典添一份甜。'},{id:'vegetables',name:'清晨蔬菜集市',icon:'🥬',resource:'vegetables',amount:6,cash:60,stars:18,desc:'收获新鲜蔬菜，送往镇上的蔬菜摊。'},{id:'wood',name:'木工坊的订单',icon:'🪵',resource:'wood',amount:3,cash:75,stars:25,desc:'将采伐入库的木材运往木工坊。'}];
export const QUESTS=[{id:'energy',name:'点亮小镇',desc:'累计生产 6 电力',resource:'energy',target:6,reward:8},{id:'milk',name:'牧场初营业',desc:'累计生产 6 牛奶',resource:'milk',target:6,reward:12},{id:'cake',name:'第一家甜品店',desc:'累计生产 4 蛋糕',resource:'cake',target:4,reward:20}];
const models=new Map(CATALOG.map(m=>[m.id,m]));
// A read scope lasts for one synchronous simulation/UI pass. Only topology
// and capacities are shared; stocks, jobs and tree maturity stay live. Nothing
// survives into the next pass, so building, recalling and account changes do
// not need a fragile collection of persistent cache invalidation flags.
const readScopes=new WeakMap();
export function withFarmRead(s,read){
 if(readScopes.has(s))return read();
 const scope={assets:new Map((s.assets||[]).map(a=>[a.id,a])),capacities:new Map()};
 readScopes.set(s,scope);try{return read()}finally{readScopes.delete(s)}
}

export const ownerFor=(s,b)=>b.assetId?(readScopes.get(s)?.assets.get(b.assetId)||s.assets.find(a=>a.id===b.assetId)):b;
export const modelFor=(s,b)=>b.ordinary?(ORDINARY_BY_ID[b.modelId]||ORDINARY_MODELS[b.type]):models.get(ownerFor(s,b)?.modelId);
export const isDay=s=>s.seconds%180<120;
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const key=p=>`${p.x},${p.y}`;
export function mint(s,modelId,paid=null){const m=models.get(modelId);if(!m)throw Error('Unknown model');const a={id:nftId(s.accountId,s.nextAsset++),modelId,paid:paid??m.price,totalProduced:0,enabled:true};s.assets.push(a);return a}
export function normalizeState(s){
 s.cash??=500;s.water??=20;s.stars??=(s.orders||0)*40;s.assets??=[];s.nextAsset??=1;s.roads??=BASE_ROADS.map(p=>({...p}));s.daily??={date:today(),deliveries:0,claimed:false};
 for(const k of Object.keys(RESOURCE_NAMES))s[k]??=0;
 s.productionTotals??={};s.questsClaimed??=[];s.selectedOrder??='bread';
 if(s.pending){s.token+=s.pending.price;s.pending=null}
 for(const b of s.buildings)if(TYPE_NAMES[b.type]&&!b.ordinary&&!s.assets.some(a=>a.id===b.assetId)){const m=CATALOG.find(m=>m.type===b.type&&m.tier===(b.collectible?1:0))||CATALOG.find(m=>m.type===b.type);b.assetId=mint(s,m.id).id}
 if(s.delivery&&(!s.delivery.route||s.delivery.route.at(-1)?.x>=0&&s.delivery.route.at(-1)?.y>=0&&s.delivery.route.at(-1)?.x<MAP_SIZE&&s.delivery.route.at(-1)?.y<MAP_SIZE)){s.delivery.duration??=s.delivery.fast?7:12;s.delivery.started??=s.delivery.arrives-s.delivery.duration;s.delivery.route=findTruckRoute(s,MAP_SIZE)}
 s.favorites??=[];villageState(s);s.rulesVersion=6;return s;
}
export function layout(s){
 const scope=readScopes.get(s);if(scope?.network)return scope.network;
 const roads=new Set(s.roads.map(key)),reached=new Set(),trade=s.buildings.find(b=>b.type==='trade'),queue=[];
 const neighbors=p=>[[p.x+1,p.y],[p.x-1,p.y],[p.x,p.y+1],[p.x,p.y-1]];
 if(trade)for(const [x,y]of neighbors(trade)){const k=`${x},${y}`;if(roads.has(k)){reached.add(k);queue.push({x,y})}}
 for(let i=0;i<queue.length;i++)for(const [x,y]of neighbors(queue[i])){const k=`${x},${y}`;if(roads.has(k)&&!reached.has(k)){reached.add(k);queue.push({x,y})}}
 const network={connected:b=>neighbors(b).some(([x,y])=>reached.has(`${x},${y}`)),reached};
 if(scope)scope.network=network;return network;
}
function connectedTools(s,network=layout(s)){
 const scope=readScopes.get(s);if(scope?.network===network&&scope.tools)return scope.tools;
 const tools=s.buildings.filter(b=>modelFor(s,b)&&network.connected(b)&&ownerFor(s,b)?.enabled!==false).map(b=>({b,m:modelFor(s,b),a:ownerFor(s,b)}));
 if(scope?.network===network)scope.tools=tools;return tools;
}
export function capacity(s,resource,network=layout(s)){
 const group=WAREHOUSE_GOODS.includes(resource)?'processed':resource,scope=readScopes.get(s);
 if(scope?.network===network&&scope.capacities.has(group))return scope.capacities.get(group);
 const base=resource==='water'||resource==='energy'?100:s.roundMode?s.buildings.filter(b=>b.type==='barn'&&network.connected(b)&&b.enabled!==false).length*200:200;
 const result=Math.floor((base+connectedTools(s,network).reduce((n,{m})=>n+(m?.storage?.[group]||0),0))*(1+researchRank(s,'storage')*.12));
 if(scope?.network===network)scope.capacities.set(group,result);return result;
}
export function roomFor(s,outputs,inputs={}){return withFarmRead(s,()=>{
 const projected=k=>(s[k]||0)-(inputs[k]||0)+(outputs[k]||0),processed=WAREHOUSE_GOODS;
 return ['water','energy','wheat'].every(k=>projected(k)<=capacity(s,k)||projected(k)<=(s[k]||0))&&(processed.reduce((n,k)=>n+projected(k),0)<=capacity(s,'flour')||processed.reduce((n,k)=>n+projected(k),0)<=processed.reduce((n,k)=>n+(s[k]||0),0));
})}
export function goodsText(items){const entries=Object.entries(items);return entries.length?entries.map(([k,v])=>`${v} ${RESOURCE_NAMES[k]}`).join(' ＋ '):'无需原料'}
export function inputText(m){return m.type==='lumber'?'采伐 1 棵成熟林木':goodsText(m.inputs)}
export function effectText(m){
 if(m.type==='tower')return `水箱 +${m.storage.water}，灌溉半径 ${m.radius} 格，仍需水井供水`;
 if(m.type==='silo')return `小麦容量 +${m.storage.wheat}，可作为附近麦田的入库点`;
 if(m.type==='warehouse')return `加工仓容量 +${m.storage.processed}，缩短附近工坊的搬运距离`;
 if(m.type==='tractor')return `范围 ${m.radius} 格内搬运时间减少 ${m.handlingReduction*100}%，每 12 秒消耗 ${m.chargeCost} 电力`;
 if(m.type==='depot')return `每次消耗 1 电力，贸易运输从 12 秒缩短为 ${m.shippingTime} 秒；没电时走普通货车`;
 if(m.type==='solar')return '白天发电、夜间暂停；储存电力供运输工具和蛋糕工坊使用';
 if(m.type==='wind')return '昼夜发电；邻近高建筑挡风时周期加倍';
 if(m.type==='dairy')return '用小麦饲料与清水产奶，牛奶可出售或加工蛋糕';
 if(m.type==='vegetable')return '消耗清水种植蔬菜；灌溉范围、遮阴和仓库距离影响收获效率';
 if(m.type==='lumber')return `采伐半径 ${m.radius} 格内的成熟林木，砍后 90 秒再生；装饰景观树不作为木材来源`;
 if(m.type==='cakery')return '面粉、牛奶、面包与电力组成甜品生产链';
 return m.radius?`灌溉半径 ${m.radius} 格`:'道路、原料和仓库距离决定实际生产效率';
}
export function summaryText(m){if(m.cycle)return goodsText(m.outputs);if(m.type==='tractor')return `搬运 −${m.handlingReduction*100}%`;if(m.type==='tower')return `灌溉 ${m.radius} 格`;if(m.storage)return `容量 +${Object.values(m.storage)[0]}`;return `运输 ${m.shippingTime||12} 秒`}
export function productionInfo(s,b,network){return withFarmRead(s,()=>productionDetails(s,b,network||layout(s)))}
function productionDetails(s,b,network){
 const m=modelFor(s,b),a=ownerFor(s,b),job=a?.job||b.job;let cycle=m?.cycle||6,notes=[];
 if(b.type==='tree')return {label:treeReady(s,b)?'成熟林木 · 可供伐木':`林木再生中 · ${Math.max(0,b.regrowsAt-s.seconds)} 秒`,cycle:0,notes};
 if(a?.enabled===false)return {label:'手动暂停',blocked:true,reason:'启用资产后从保留的生产进度继续。',cycle:m?.cycle||0,notes};
 if(!job&&shouldYieldIngredients(s,b))return {label:'任务原料调度中',blocked:true,reason:'蛋糕产量已达标，暂缓新批次以保留面包与牛奶完成交付。',cycle:m?.cycle||0,notes};
 if(!m&&b.type!=='wheat')return {label:'基础设施',cycle:0,notes};
 if(m&&!network.connected(b))return {label:'未连接道路',blocked:true,reason:'需要紧邻通往货运站的道路。',cycle:m.cycle,notes};
 if(m&&!m.cycle){let active=true,label='工具已生效';if(m.type==='tractor'){active=(a.chargeRemaining||0)>0;label=active?'电驱运输中':'等待电力'}if(m.type==='depot')label=s.energy>0?'快速运输就绪':'普通货车待命';if(m.type==='tower'&&s.water<=0)label='水箱缺水，等待水井';return {label,blocked:!active,cycle:0,notes:[effectText(m)]}}
 if(m?.dayOnly&&!isDay(s))return {label:'夜间暂停发电',blocked:true,reason:'天亮后自动恢复，已存电力仍可使用。',cycle,notes};
 const stores=s.buildings.filter(q=>network.connected(q)&&ownerFor(s,q)?.enabled!==false&&(q.type==='barn'||(b.type==='wheat'?q.type==='silo':q.type==='warehouse')));
 if(!stores.length)return {label:'仓库未连接',blocked:true,reason:'仓库需要接入货运站的道路网络。',cycle,notes};
 const tools=connectedTools(s,network);
 if(['wheat','vegetable'].includes(b.type)){
  const irrigated=tools.some(({b:q,m})=>['well','tower'].includes(q.type)&&s.water>0&&distance(q,b)<=m.radius);
  if(!irrigated){cycle*=2;notes.push('超出灌溉范围：生长 ×2')}
  if(s.buildings.some(q=>q!==b&&!['wheat','vegetable','well','solar','tractor','depot'].includes(q.type)&&distance(q,b)<=1)){cycle*=2;notes.push('邻近高物体遮阴：生长 ×2')}
 }
 if(['mill','wind'].includes(b.type)&&s.buildings.some(q=>q!==b&&['mill','bakery','barn','house','silo','warehouse','tower','dairy','cakery'].includes(q.type)&&distance(q,b)<=1)){cycle*=2;notes.push('邻近建筑挡风：周期 ×2')}
 const reducer=Math.max(0,...tools.filter(({b:q,m,a})=>m.type==='tractor'&&(a.chargeRemaining||0)>0&&distance(q,b)<=m.radius).map(({m})=>m.handlingReduction));
 const store=[...stores].sort((a,c)=>distance(a,b)-distance(c,b))[0];
 cycle=Math.max(1,Math.ceil(cycle*productionMultiplier(s,b.type)));
 const rawHandling=Math.max(1,Math.ceil(distance(store,b)*.5)),handling=Math.max(1,Math.ceil(rawHandling*(1-reducer)*(1-researchRank(s,'logistics')*.1)));cycle+=handling;notes.push(`仓库搬运 +${handling} 秒${reducer?'（电驱运输提速）':''}`);
 const recipe=m||{inputs:{water:1},outputs:{wheat:2}};
 if(job){if(job.remaining<=0&&!roomFor(s,job.outputs))return {label:'等待仓储空间',cycle,notes,job,handling,store};return {label:job.haul&&job.remaining<=job.haul.duration?`搬运入库 · ${job.remaining} 秒`:job.remaining>0?`生产中 · ${job.remaining} 秒`:'准备入库',cycle,notes,job,handling,store}}
 const missing=Object.entries(recipe.inputs).filter(([k,v])=>(s[k]||0)<v).map(([k])=>RESOURCE_NAMES[k]);if(missing.length)return {label:`等待${missing.join('、')}`,blocked:true,reason:`补足${missing.join('、')}后自动开工。`,cycle,notes};
 if(!roomFor(s,recipe.outputs,recipe.inputs))return {label:'仓储已满',blocked:true,reason:'出售产品、增加仓储或消耗材料后继续。',cycle,notes};
 const tree=b.type==='lumber'?findTimberTree(s,b,m.radius):null;
 if(b.type==='lumber'&&!tree)return {label:'等待成熟林木',blocked:true,reason:'请在采伐范围内种植果树；已砍伐的林木会在 90 秒后再生，且需有可通行路径。',cycle,notes};
 return {label:'等待开工',cycle,notes,handling,store,tree};
}
export const storageName=b=>({barn:'谷物与加工仓库',silo:'丰收筒仓',warehouse:'集配货仓'}[b.type]||'仓库');
function haulPlan(s,b,outputs,info){
 if(!isCargo(outputs)||!info.store)return null;
 const route=findHaulRoute(s,b,info.store,MAP_SIZE);if(!route)return null;
 return {route,duration:info.handling,source:{x:b.x,y:b.y},destination:{x:info.store.x,y:info.store.y},sourceName:b.type==='wheat'?'麦田':modelFor(s,b)?.name||TYPE_NAMES[b.type],destinationName:modelFor(s,info.store)?.name||storageName(info.store)};
}
// Eligibility is sampled after each game update. Animation only interpolates
// these paid jobs; it never repeats production/capacity checks at display FPS.
export function haulerSnapshot(s){return withFarmRead(s,()=>{
 const network=layout(s);return s.buildings.flatMap(b=>{const a=ownerFor(s,b),job=a?.job||b.job;
  if(!job?.haul||a?.enabled===false||productionInfo(s,b,network).blocked)return [];
  return [{job,sourceId:b.assetId||`${b.x},${b.y}`}];
 });
})}
export function sampleHaulers(snapshot,fraction=0){return snapshot.flatMap(({job,sourceId})=>{const pose=sampleHauler(job,fraction);return pose?[{...pose,sourceId}]:[]})}
export function activeHaulers(s,fraction=0){return sampleHaulers(haulerSnapshot(s),fraction)}
export function tick(s,now=Date.now()){trace(s,'tick',[now]);return withFarmRead(s,()=>advanceFarm(s,now))}
function advanceFarm(s,now){
 s.seconds++;dailyState(s,now);advanceVillage(s);const network=layout(s);
 s.haulArrivals=(s.haulArrivals||[]).filter(e=>s.seconds-e.at<6);
 // Charge only deployed, connected transport tools. A charge never mints energy.
 for(const {m,a}of connectedTools(s,network))if(m.type==='tractor'){a.chargeRemaining=Math.max(0,(a.chargeRemaining||0)-1);if(!a.chargeRemaining&&s.energy>=m.chargeCost){s.energy-=m.chargeCost;a.chargeRemaining=12}}
 const order={solar:0,wind:0,well:1,wheat:2,vegetable:2,lumber:2,mill:3,dairy:3,bakery:4,cakery:5};
 for(const b of [...s.buildings].sort((a,b)=>(order[a.type]??9)-(order[b.type]??9))){if(!(b.type in order))continue;const m=modelFor(s,b),owner=ownerFor(s,b),info=productionInfo(s,b,network);if(info.blocked)continue;
  if(!owner.job){if(b.type==='lumber'&&!fellTree(s,info.tree))continue;const recipe=m||{inputs:{water:1},outputs:{wheat:2}};for(const [k,v]of Object.entries(recipe.inputs))s[k]-=v;owner.job={remaining:info.cycle,outputs:{...recipe.outputs},challengeId:activeChallengeId(s,now)};const haul=haulPlan(s,b,recipe.outputs,info);if(haul)owner.job.haul=haul}
  // Old saves and a recalled/traded NFT retain their paid batch; rebuild only
  // its visual route when its source, storage destination or path has changed.
  if(isCargo(owner.job.outputs)){
   const h=owner.job.haul,changed=!h||h.source.x!==b.x||h.source.y!==b.y||h.destination.x!==info.store?.x||h.destination.y!==info.store?.y||h.route.some(p=>s.buildings.some(q=>q!==b&&q!==info.store&&q.x===Math.floor(p.x)&&q.y===Math.floor(p.y)));
   if(changed){delete owner.job.haul;const haul=haulPlan(s,b,owner.job.outputs,info);if(haul)owner.job.haul=haul}
  }
  owner.job.remaining=Math.max(0,owner.job.remaining-1);
  if(owner.job.remaining===0&&roomFor(s,owner.job.outputs)){for(const [k,v]of Object.entries(owner.job.outputs)){s[k]+=v;s.productionTotals[k]=(s.productionTotals[k]||0)+v}if(owner.job.haul)s.haulArrivals.push({...owner.job.haul,outputs:{...owner.job.outputs},at:s.seconds});recordVillageProduction(s,owner.job.outputs);recordChallengeProduction(s,owner.job.outputs,owner.job.challengeId,now);if(m){owner.totalProduced=(owner.totalProduced||0)+Object.values(owner.job.outputs).reduce((a,b)=>a+b,0);owner.lastProducedDate=today()}delete owner.job}
 }
 if(s.delivery&&s.seconds>=s.delivery.arrives){const cash=s.delivery.cash??90,stars=s.delivery.stars??40,route=s.delivery.route;if(route?.length>1){s.truckHome=route[0];s.truckHeading=Math.atan2(route[0].y-route[1].y,route[0].x-route[1].x)}s.cash+=cash;s.stars+=stars;s.orders++;s.daily.deliveries++;recordSale(s,s.delivery,now);recordVillageTrip(s);const order=ORDERS.find(o=>o.id===s.delivery.orderId)||ORDERS.find(o=>o.id==='bread');recordChallengeDelivery(s,s.delivery,s.delivery.resource||order.resource,s.delivery.amount||order.amount,now);s.delivery=null;return `货车回来了：＋${cash} 经营币、＋${stars} 星星。`}
}
export function purchase(s,id){const m=models.get(id);if(!m||s.token<m.price)return null;s.token-=m.price;return mint(s,id,m.price)}
function clearCell(s,x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=1&&y>=1&&x<MAP_SIZE-1&&y<MAP_SIZE-1&&!s.roads.some(p=>p.x===x&&p.y===y)&&!s.buildings.some(b=>b.x===x&&b.y===y)&&!(x===9&&y===8)&&!s.delivery?.route?.some(p=>Math.floor(p.x)===x&&Math.floor(p.y)===y)}
export const canPlace=(s,x,y)=>x!==RIVER_COLUMN&&clearCell(s,x,y);
export const canPlaceRoad=(s,x,y)=>clearCell(s,x,y);
export function placeAsset(s,id,x,y){const a=s.assets.find(a=>a.id===id);if(!a||a.listingPrice||s.buildings.some(b=>b.assetId===id)||!canPlace(s,x,y))return false;s.buildings.push({x,y,type:models.get(a.modelId).type,assetId:id});if(s.round)s.round.builds++;trace(s,'place',[id,x,y]);return true}
export function selectedOrder(s){return ORDERS.find(o=>o.id===s.selectedOrder)||ORDERS.find(o=>o.id==='bread')}
export function startDelivery(s,now=Date.now()){const o=selectedOrder(s),network=layout(s);if(s.delivery||s[o.resource]<o.amount||!s.buildings.some(b=>['barn','warehouse'].includes(b.type)&&network.connected(b)&&ownerFor(s,b)?.enabled!==false))return false;const route=findTruckRoute(s,MAP_SIZE);if(!route)return false;const depots=connectedTools(s,network).filter(({m})=>m.type==='depot'),fast=depots.length>0&&s.energy>=1,duration=Math.max(4,Math.ceil((fast?Math.min(...depots.map(({m})=>m.shippingTime)):12)*(1-researchRank(s,'logistics')*.1)));if(fast)s.energy--;s[o.resource]-=o.amount;s.truckRoute=route;s.truckHome=route[0];s.delivery={started:s.seconds,arrives:s.seconds+duration,duration,route,parkedHeading:s.truckHeading||0,cash:o.cash,stars:o.stars,orderId:o.id,resource:o.resource,amount:o.amount,challengeId:activeChallengeId(s,now),fast};trace(s,'deliver',[o.id,now]);return true}
export function challengeReadiness(s,id){
 const plan=(s.daily?.challenge?.planId===id&&s.daily.challenge.planSnapshot)||CHALLENGES.find(p=>p.id===id);if(!plan)return {ready:false,missing:['挑战不存在'],checks:[{label:'挑战',ready:false,reason:'挑战不存在'}]};
 const network=layout(s),checks=plan.requires.map(types=>{
  const candidates=s.buildings.filter(b=>types.includes(b.type)),ready=candidates.some(b=>network.connected(b)&&ownerFor(s,b)?.enabled!==false);
  return {label:types.map(t=>TYPE_NAMES[t]).join(' / '),buildTypes:types,ready,reason:ready?'已启用并接通道路':!candidates.length?'尚未建造或放置':candidates.every(b=>ownerFor(s,b)?.enabled===false)?'设施已暂停，请先启用':'未接通通往货运站的道路'};
 });
 if(s.roundMode){
  const grain=capacity(s,'wheat',network)>0,processed=capacity(s,'flour',network)>0,crop=s.buildings.some(b=>b.type==='wheat');
  checks.push({label:'粮食仓储（综合仓库 / 筒仓）',buildTypes:['barn','silo'],ready:grain,reason:grain?'粮食仓储已接通':'需建造或放置粮仓／筒仓，并启用接通道路'},{label:'加工仓储（综合仓库 / 货仓）',buildTypes:['barn','warehouse'],ready:processed,reason:processed?'加工仓储已接通':'需建造或放置综合仓库／货仓，并启用接通道路'},{label:'麦田',buildTypes:['wheat'],ready:crop,reason:crop?'已建造麦田':'尚未建造麦田'});
 }
 const missing=checks.filter(c=>!c.ready).map(c=>c.label);return {ready:missing.length===0,missing,checks};
}
export function retryDailyChallenge(s,now=Date.now()){const d=dailyState(s,now),id=d.challenge?.planId;if(!id||!challengeReadiness(s,id).ready)return false;const ok=retryChallenge(s,now);if(ok)trace(s,'start',[id,now,s.chainAttempt?.nonce||0,true]);return ok}
export function startDailyChallenge(s,id,now=Date.now()){if(!challengeReadiness(s,id).ready)return false;const ok=beginChallenge(s,id,now);if(ok)trace(s,'start',[id,now,s.chainAttempt?.nonce||0,false]);return ok}
export function rewardQuote(s){const bonuses=s.roundMode?QUESTS.filter(q=>!s.questsClaimed.includes(q.id)&&(s.productionTotals[q.resource]||0)>=q.target):[];return {bonuses,bonus:bonuses.reduce((n,q)=>n+q.reward,0)}}
export function claimReward(s,now=Date.now()){const quote=rewardQuote(s);if(!claimDailyReward(s,now))return false;if(s.roundMode){s.token+=quote.bonus;s.questsClaimed.push(...quote.bonuses.map(q=>q.id));s.round.rewardClaimed=true}trace(s,'claim',[now]);return true}
export function claimQuest(s,id,now=Date.now()){if(s.roundMode)return false;if(!dailyCleared(s,now))return false;const q=QUESTS.find(q=>q.id===id);if(!q||s.questsClaimed.includes(id)||(s.productionTotals[q.resource]||0)<q.target)return false;s.token+=q.reward;s.questsClaimed.push(id);return true}
export function listAsset(s,id,price){const a=s.assets.find(a=>a.id===id);if(!a||s.buildings.some(b=>b.assetId===id)||!Number.isSafeInteger(price)||price<1||price>1000000)return false;a.listingPrice=price;return true}
export function transferListing(accounts,buyerId,sellerId,id,expectedPrice){const buyer=accounts[buyerId],seller=accounts[sellerId],a=seller?.assets.find(a=>a.id===id);if(!buyer||!seller||buyerId===sellerId||!a||!Number.isSafeInteger(a.listingPrice)||a.listingPrice<=0||a.listingPrice!==expectedPrice||buyer.token<expectedPrice||seller.buildings.some(b=>b.assetId===id)||buyer.assets.some(a=>a.id===id))return false;buyer.token-=expectedPrice;seller.token+=expectedPrice;seller.assets=seller.assets.filter(a=>a.id!==id);delete a.listingPrice;buyer.assets.push(a);return true}

export function setAssetEnabled(s,id,enabled){const a=s.assets.find(a=>a.id===id);if(!a)return false;a.enabled=!!enabled;trace(s,'assetEnable',[id,!!enabled]);return true}

export function ordinaryItem(key){return ORDINARY_BY_ID[key]||ORDINARY_MODELS[key]||(BASIC_BUILDINGS[key]?{...BASIC_BUILDINGS[key],id:key,type:key,ordinary:true}:null)}
export const ordinaryShopItems=()=>[...['wheat','road','tree','barn'].map(ordinaryItem),...ORDINARY_CATALOG];
export function buildOrdinary(s,key,x,y){const item=ordinaryItem(key);if(!item||!Number.isSafeInteger(s.cash)||s.cash<item.cost||!(item.type==='road'?canPlaceRoad(s,x,y):canPlace(s,x,y)))return false;s.cash-=item.cost;if(item.type==='road')s.roads.push({x,y,ordinary:true,purchaseCost:item.cost});else s.buildings.push({x,y,type:item.type,ordinary:true,modelId:ORDINARY_BY_ID[item.id]?item.id:undefined,purchaseCost:item.cost,enabled:true});if(s.round)s.round.builds++;trace(s,'build',[key,x,y]);return true}
export const DEMOLITION_REFUND_RATE=.5;
export function demolitionQuote(s,b){
 const road=s.roads.includes(b),present=road||s.buildings.includes(b);
 if(!present||b.assetId)return {eligible:false,allowed:false,reason:b?.assetId?'NFT 请收回背包。':'设施已不在当前地图上。'};
 const type=road?'road':b.type,item=ordinaryItem(b.modelId||type);
 if(!item)return {eligible:false,allowed:false,reason:'货运站和住宅为开局配套，需要保留。'};
 // Old rounds started without roads; the legacy map included free base roads.
 const inferredPaid=b.ordinary||road&&(s.roundMode&&!s.round?.legacy||!BASE_ROADS.some(p=>p.x===b.x&&p.y===b.y));
 const paid=b.purchaseCost??(inferredPaid?item.cost:0),refund=Math.floor(paid*DEMOLITION_REFUND_RATE);
 const valid=Number.isSafeInteger(paid)&&paid>=0&&Number.isSafeInteger(s.cash)&&s.cash>=0&&Number.isSafeInteger(s.cash+refund);
 const onRoute=s.delivery?.route?.some(p=>Math.floor(p.x)===b.x&&Math.floor(p.y)===b.y);
 return {eligible:true,allowed:valid&&!onRoute,type,name:item.name,paid,refund,rate:DEMOLITION_REFUND_RATE,priceKnown:b.purchaseCost!=null||!!inferredPaid,reason:!valid?'设施购置记录或余额异常，暂时无法拆除。':onRoute?'货车正在使用这段路线，请等货车返回后再拆除。':''};
}
export function demolishOrdinary(s,b){
 const quote=demolitionQuote(s,b);if(!quote.allowed)return false;trace(s,'demolish',[s.roads.includes(b)?'road':b.type,b.x,b.y]);
 const items=s.roads.includes(b)?s.roads:s.buildings;items.splice(items.indexOf(b),1);s.cash+=quote.refund;
 // Clear the old decorative exit route so removed roads do not reappear.
 if(quote.type==='road'&&!s.delivery)delete s.truckRoute;
 return quote;
}
export function upgradeRoundEconomy(s){if(s.roundMode)return s;s.roundMode=true;s.roundSerial??=0;s.round={id:`${s.accountId||'local'}:legacy`,legacy:true,builds:0,rewardClaimed:!!s.daily?.claimed};return s}
export function restartFarm(s,now=Date.now()){
 const daily=structuredClone(dailyState(s,now));if(daily.challenge?.status==='active'||daily.challenge?.status==='completed')daily.challenge.status='expired';
 const assets=(s.assets||[]).map(a=>{const next={...a};delete next.job;delete next.chargeRemaining;return next}),serial=(s.roundSerial||0)+1;
 const fresh=normalizeState({accountId:s.accountId,token:s.token??128,cash:ROUND_CASH,water:0,wheat:0,flour:0,bread:0,milk:0,cake:0,energy:0,seconds:0,orders:0,stars:0,assets,nextAsset:s.nextAsset||1,roads:[],buildings:[{x:8,y:8,type:'trade'},{x:10,y:9,type:'house'}],preferences:structuredClone(s.preferences||{}),salesBook:structuredClone(s.salesBook),village:structuredClone(s.village),savedLayout:structuredClone(s.savedLayout||[]),supportGrantApplied:true,favorites:[...(s.favorites||[])],questsClaimed:[...(s.questsClaimed||[])],daily,challengeClock:s.challengeClock,roundMode:true,roundSerial:serial,round:{id:`${s.accountId||'local'}:round:${serial}`,legacy:false,builds:0,rewardClaimed:false,startedAt:now}});if(s.proof)enableTrace(fresh,s.proof.nextCheckpoint||s.proof.initial.checkpoint);return fresh;
}
export function newFarmAccount(accountId='A',now=Date.now()){return restartFarm({accountId,token:128,assets:[],buildings:[],questsClaimed:[]},now)}

// Upgrade existing accounts once; preserve their exact layout, stock and TOM.
export function applySupportGrant(s){if(s.supportGrantApplied)return false;if(!Number.isSafeInteger(s.cash)||s.cash<0||!Number.isSafeInteger(s.cash+2000))return false;s.cash+=2000;s.supportGrantApplied=true;return true}
