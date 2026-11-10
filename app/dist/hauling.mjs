import {routeMetrics} from './path-metrics.mjs?v=8.1';
import {RIVER_COLUMN} from './geography.mjs?v=8.1';
const key=p=>`${p.x},${p.y}`;
const clamp=n=>Math.max(0,Math.min(1,n));
export const CARGO_COLORS={wheat:'#b5923f',flour:'#9a876a',bread:'#ba7645',milk:'#6b9c98',cake:'#b57c91',vegetables:'#6b9748',wood:'#9a724b'};
export const isCargo=outputs=>Object.keys(outputs).some(k=>k in CARGO_COLORS);

// Roads are preferred, but a farmer may cross clear grass to reach a field.
// Only the source and destination building cells can be entered.
export function findHaulRoute(s,source,destination,size){
 const start=key(source),end=key(destination),roads=new Set(s.roads.map(key));
 const blocked=new Set(s.buildings.filter(b=>key(b)!==start&&key(b)!==end).map(key));
 const open=[{x:source.x,y:source.y,cost:0}],costs=new Map([[start,0]]),previous=new Map(),visited=new Set();
 while(open.length){
  open.sort((a,b)=>a.cost-b.cost);const p=open.shift(),pk=key(p);if(visited.has(pk))continue;visited.add(pk);
  if(pk===end){
   const cells=[];for(let q=p;q;q=previous.get(key(q)))cells.unshift({x:q.x+.5,y:q.y+.5});
   if(cells.length<2)return null;
   const first=cells[0],next=cells[1],last=cells.at(-1),before=cells.at(-2);
   cells[0]={x:first.x+(next.x-first.x)*.4,y:first.y+(next.y-first.y)*.4};
   cells[cells.length-1]={x:last.x+(before.x-last.x)*.4,y:last.y+(before.y-last.y)*.4};
   return cells;
  }
  for(const [dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]]){
   const q={x:p.x+dx,y:p.y+dy},qk=key(q);
   if(q.x<1||q.y<1||q.x>=size-1||q.y>=size-1||q.x===RIVER_COLUMN&&!roads.has(qk)||blocked.has(qk))continue;
   const cost=p.cost+(roads.has(qk)?1:4);
   if(cost<(costs.get(qk)??Infinity)){costs.set(qk,cost);previous.set(qk,p);open.push({...q,cost})}
  }
 }
 return null;
}
export function sampleHauler(job,fraction=0){
 const h=job?.haul;if(!h?.route?.length||job.remaining>h.duration)return null;
 const progress=clamp((h.duration-job.remaining+fraction)/h.duration),route=h.route;
 const {lengths,total}=routeMetrics(route);
 let remaining=progress*total;
 for(let i=0;i<lengths.length;i++){
  if(remaining<=lengths[i]||i===lengths.length-1){const f=lengths[i]?clamp(remaining/lengths[i]):0,a=route[i],b=route[i+1];return {...h,x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,dx:b.x-a.x,dy:b.y-a.y,progress,outputs:job.outputs,waiting:job.remaining===0}}
  remaining-=lengths[i];
 }
 return null;
}
