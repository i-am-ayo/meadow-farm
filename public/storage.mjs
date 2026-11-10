import {ownerFor,activeHaulers,capacity,layout,modelFor,storageName,WAREHOUSE_GOODS} from './rules.mjs?v=8.1';

export const STORAGE_TYPES=['barn','silo','warehouse'];
const GROUPS={grain:{name:'粮仓',resource:'wheat',goods:['wheat'],icon:'🌾'},processed:{name:'加工仓',resource:'flour',goods:WAREHOUSE_GOODS,icon:'📦'}};
export const isStorage=b=>!!b&&STORAGE_TYPES.includes(b.type);
export const storageKey=b=>b.assetId||`${b.type}:${b.x},${b.y}`;

// The farm already pools inventory. Report that pool accurately rather than
// inventing a separate copy of the same goods inside every storage building.
export function storageOverview(s,b,{haulers}={}){
 if(!isStorage(b))return null;
 const network=layout(s),asset=ownerFor(s,b),model=modelFor(s,b),connected=network.connected(b),enabled=asset?.enabled!==false;
 const incoming=(haulers||activeHaulers(s)).filter(h=>h.destination.x===b.x&&h.destination.y===b.y);
 const ids=b.type==='silo'?['grain']:b.type==='warehouse'?['processed']:['grain','processed'];
 const groups=ids.map(id=>{
  const g=GROUPS[id],stocks=g.goods.map(resource=>({resource,amount:s[resource]||0,incoming:incoming.reduce((n,h)=>n+(h.outputs[resource]||0),0)}));
  const used=stocks.reduce((n,r)=>n+r.amount,0),limit=capacity(s,g.resource,network);
  return {id,name:g.name,icon:g.icon,used,capacity:limit,free:Math.max(0,limit-used),overflow:Math.max(0,used-limit),ratio:limit?used/limit:0,stocks,contribution:b.type==='barn'?200:connected&&enabled?(model?.storage?.[id==='grain'?'wheat':'processed']||0):0,incoming:stocks.reduce((n,r)=>n+r.incoming,0)};
 });
 const ratio=Math.max(...groups.map(g=>g.ratio));
 const status=!connected?'disconnected':!enabled?'paused':ratio>1?'overflow':ratio>=1?'full':ratio>=.8?'tight':'normal';
 const labels={disconnected:'未连路',paused:'已暂停',overflow:'超容量',full:'已满',tight:'将满',normal:'可入库'};
 return {key:storageKey(b),name:model?.name||storageName(b),connected,enabled,status,label:labels[status],ratio,groups,incoming,waiting:incoming.filter(h=>h.waiting).length};
}
