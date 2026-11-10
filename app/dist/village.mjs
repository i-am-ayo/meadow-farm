import {trace} from './trace.mjs?v=8.1';
// The village career belongs to the farmer. Stock, paid batches and visitor
// requests belong to the current round. None of these systems award TOM.
export const LEVEL_XP = [0,60,160,320,600,1000,1600,2400,3600,5200];
export const RESEARCH = [
  {id:'cultivation',icon:'🌱',zh:'精细生产',en:'Careful cultivation',description:['每级缩短基础生产周期 6%，最多 18%。','Each rank reduces base production time by 6%, up to 18%.']},
  {id:'storage',icon:'📦',zh:'仓储规划',en:'Storage planning',description:['每级增加所有已接通仓储容量 12%，最多 36%。','Each rank adds 12% to connected storage capacity, up to 36%.']},
  {id:'logistics',icon:'🚚',zh:'高效物流',en:'Efficient logistics',description:['每级缩短搬运与货车运输时间 10%，最多 30%。','Each rank reduces hauling and truck time by 10%, up to 30%.']}
];
export const WEATHER = [
  {id:'sun',icon:'☀',zh:'晴朗',en:'Clear skies',types:['solar'],factor:.8,description:['太阳能基础周期缩短 20%','Solar base cycles are 20% shorter']},
  {id:'rain',icon:'🌦',zh:'春雨',en:'Spring rain',types:['wheat','vegetable','well'],factor:.8,description:['作物与水井基础周期缩短 20%','Crop and well base cycles are 20% shorter']},
  {id:'breeze',icon:'🍃',zh:'微风',en:'Gentle breeze',types:['mill','wind'],factor:.8,description:['磨坊与风力机基础周期缩短 20%','Mill and wind turbine base cycles are 20% shorter']},
  {id:'mild',icon:'🌤',zh:'温润',en:'Mild weather',types:['wheat','vegetable','dairy'],factor:.9,description:['作物与牧场基础周期缩短 10%','Crop and dairy base cycles are 10% shorter']}
];
const weights={wheat:1,flour:2,bread:6,milk:4,cake:12,vegetables:2,wood:3};
const finite=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function villageState(s){
  const v=s.village??={};v.xp??=0;v.points??=0;v.awardedLevel??=1;v.research??={};v.produced??={};v.trips??=0;v.contracts??=0;v.claimed??=[];v.weatherEnabled??=false;
  return v;
}
export const farmLevel=s=>Math.max(1,LEVEL_XP.filter(n=>n<=finite(s.village?.xp)).length);
export const researchRank=(s,id)=>Math.min(3,finite(s.village?.research?.[id]));
export function awardExperience(s,amount){
  if(!Number.isSafeInteger(amount)||amount<=0)return false;
  const v=villageState(s);v.xp+=amount;
  const level=farmLevel(s);if(level>v.awardedLevel){v.points+=(level-v.awardedLevel)*2;v.awardedLevel=level;}
  return true;
}
// Award only for actual unloading, not for starting a batch or animating it.
export function recordVillageProduction(s,outputs){
  const v=villageState(s);let xp=0;
  for(const [key,amount]of Object.entries(outputs))if(weights[key]&&Number.isSafeInteger(amount)&&amount>0){v.produced[key]=(v.produced[key]||0)+amount;xp+=weights[key]*amount;}
  awardExperience(s,xp);
}
export function recordVillageTrip(s){villageState(s).trips++;awardExperience(s,8);}
export function researchQuote(s,id){
  const model=RESEARCH.find(r=>r.id===id),rank=researchRank(s,id),level=farmLevel(s),cost=rank+1,requiredLevel=rank+2;
  return {model,rank,cost,requiredLevel,allowed:!!model&&rank<3&&level>=requiredLevel&&(s.village?.points||0)>=cost};
}
export function buyResearch(s,id){
  const q=researchQuote(s,id);if(!q.allowed)return false;
  const v=villageState(s);v.points-=q.cost;v.research[id]=q.rank+1;trace(s,'research',[id]);return true;
}
export function weatherView(s,offset=0){
  const day=Math.floor(Math.max(0,s.seconds||0)/180)+offset;
  return {...WEATHER[day%WEATHER.length],day:day+1,remaining:180-(Math.max(0,s.seconds||0)%180),enabled:!!s.village?.weatherEnabled};
}
export function productionMultiplier(s,type){
  const weather=weatherView(s);
  return (1-researchRank(s,'cultivation')*.06)*(weather.enabled&&weather.types.includes(type)?weather.factor:1);
}

const REQUESTS=[
  {id:'breakfast',icon:'🥐',zh:'早餐铺备货',en:'Breakfast provisions',visitor:['莉莉 · 早餐铺','Lily · breakfast café'],goods:{wheat:8,bread:2},cash:115,xp:24,requires:[]},
  {id:'baker',icon:'🥖',zh:'面包师的委托',en:'The baker’s request',visitor:['奥利 · 面包师','Ollie · baker'],goods:{flour:4,bread:3},cash:155,xp:32,requires:[]},
  {id:'pantry',icon:'🧺',zh:'邻里的食物篮',en:'A basket for a neighbor',visitor:['米娅 · 邻居','Mia · neighbor'],goods:{wheat:6,bread:1},cash:65,xp:20,requires:[]},
  {id:'flour',icon:'🌾',zh:'磨坊补货日',en:'Restocking the mill',visitor:['乔 · 镇上磨坊','Joe · village mill'],goods:{wheat:14,flour:3},cash:75,xp:26,requires:[]},
  {id:'lunch',icon:'🥪',zh:'工人的午餐篮',en:'The workers’ lunch basket',visitor:['山姆 · 工头','Sam · foreman'],goods:{bread:4,wheat:4},cash:175,xp:40,requires:[]},
  {id:'greens',icon:'🥬',zh:'当季蔬菜篮',en:'Seasonal vegetable basket',visitor:['安娜 · 市集摊主','Anna · market vendor'],goods:{vegetables:6,bread:2},cash:145,xp:40,requires:['vegetable']},
  {id:'carpenter',icon:'🪚',zh:'木匠的午间订单',en:'The carpenter’s lunch order',visitor:['诺亚 · 木匠','Noah · carpenter'],goods:{wood:6,bread:2},cash:255,xp:48,requires:['lumber']},
  {id:'dairy',icon:'🥛',zh:'溪谷早餐配送',en:'Valley breakfast basket',visitor:['艾拉 · 旅店老板','Ella · innkeeper'],goods:{milk:4,bread:3},cash:290,xp:52,requires:['dairy']},
  {id:'party',icon:'🎂',zh:'生日派对餐篮',en:'A birthday picnic',visitor:['本 · 庆典组织者','Ben · party planner'],goods:{cake:2,milk:3,bread:2},cash:520,xp:80,requires:['cakery','dairy']}
];
const roundKey=s=>s.round?.id||'legacy';
function boardState(s){
  if(!s.villageBoard||s.villageBoard.roundId!==roundKey(s))s.villageBoard={roundId:roundKey(s),revision:0,used:[],refreshAt:0,active:null};
  return s.villageBoard;
}
export function contractOffers(s){
  const board=s.villageBoard?.roundId===roundKey(s)?s.villageBoard:{revision:0,used:[]};
  const pool=REQUESTS.filter(r=>r.requires.every(type=>s.buildings.some(b=>b.type===type))),day=Math.floor((s.seconds||0)/180);
  // Refreshes use deterministic identifiers. Reopening, reloading and changing
  // language cannot reroll rewards or make the same request payable twice.
  const start=(day+(board.revision||0)*3)%pool.length;
  return Array.from({length:Math.min(3,pool.length)},(_,i)=>{
    const r=pool[(start+i)%pool.length],id=`${roundKey(s)}:${day}:${board.revision||0}:${r.id}`;
    return {...r,goods:{...r.goods},id,used:(board.used||[]).includes(id)};
  });
}
export function activeContract(s){
  const active=s.villageBoard?.roundId===roundKey(s)?s.villageBoard.active:null;
  return active&&active.endsAt>s.seconds?active:null;
}
export function acceptContract(s,id){
  if(activeContract(s))return false;
  const offer=contractOffers(s).find(o=>o.id===id&&!o.used);if(!offer)return false;
  const board=boardState(s);board.used.push(id);board.used=board.used.slice(-64);
  board.active={...offer,endsAt:s.seconds+300,startedAt:s.seconds};board.lastResult=null;trace(s,'accept',[id]);return true;
}
export function advanceVillage(s){
  const board=s.villageBoard;if(board?.active&&board.active.endsAt<=s.seconds){board.active=null;board.lastResult='expired';}
}
export function abandonContract(s){
  if(!activeContract(s))return false;const b=boardState(s);b.active=null;b.lastResult='abandoned';trace(s,'abandon');return true;
}
export function fulfillContract(s,id){
  const a=activeContract(s);if(!a||a.id!==id||!Object.entries(a.goods).every(([k,n])=>(s[k]||0)>=n))return false;
  // Validate everything first. A partial handover never deducts goods or pays.
  for(const [k,n]of Object.entries(a.goods))s[k]-=n;
  const v=villageState(s);s.cash+=a.cash;v.contracts++;v.points++;awardExperience(s,a.xp);
  const board=boardState(s);board.active=null;board.lastResult='completed';trace(s,'fulfill',[id]);return {cash:a.cash,xp:a.xp,points:1};
}
export function refreshContracts(s){
  const board=boardState(s);if(s.cash<25||s.seconds<board.refreshAt)return false;
  s.cash-=25;board.revision++;board.refreshAt=s.seconds+120;trace(s,'refresh');return true;
}
export const ACHIEVEMENTS=[
  {id:'bread',icon:'🥖',zh:'第一炉好面包',en:'The first good loaf',target:12,cash:80,points:1,value:v=>v.produced.bread||0},
  {id:'produce',icon:'🥬',zh:'菜园好收成',en:'A thriving garden',target:30,cash:100,points:1,value:v=>v.produced.vegetables||0},
  {id:'timber',icon:'🌳',zh:'可持续林场',en:'A renewable grove',target:18,cash:120,points:1,value:v=>v.produced.wood||0},
  {id:'trade',icon:'🚚',zh:'熟悉集市的路',en:'The road to market',target:10,cash:120,points:1,value:v=>v.trips||0},
  {id:'neighbor',icon:'🤝',zh:'可靠的邻居',en:'A reliable neighbor',target:3,cash:150,points:2,value:v=>v.contracts||0},
  {id:'research',icon:'📚',zh:'学以致用',en:'Learning by doing',target:3,cash:160,points:1,value:v=>Object.values(v.research||{}).reduce((n,r)=>n+r,0)},
  {id:'dessert',icon:'🍰',zh:'甜品小镇',en:'A sweet little town',target:20,cash:200,points:2,value:v=>v.produced.cake||0},
  {id:'level',icon:'🏡',zh:'初具规模',en:'A growing town',target:5,cash:200,points:2,value:(v,s)=>farmLevel(s)}
];
export function achievementRows(s){
  const v=s.village||{produced:{},claimed:[]};return ACHIEVEMENTS.map(a=>({...a,value:a.value(v,s),claimed:(v.claimed||[]).includes(a.id)}));
}
export function claimAchievement(s,id){
  const a=achievementRows(s).find(a=>a.id===id);if(!a||a.claimed||a.value<a.target)return false;
  const v=villageState(s);v.claimed.push(id);s.cash+=a.cash;v.points+=a.points;trace(s,'achievement',[id]);return true;
}
