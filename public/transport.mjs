import {routeMetrics,returnRoute} from './path-metrics.mjs?v=8.1';
import {RIVER_COLUMN} from './geography.mjs?v=8.1';
const cellKey=(x,y)=>`${x},${y}`;
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

// Prefer the player's connected roads; use clear land only for the last
// country-road connection to the edge. Never drive through buildings or water.
export function findTruckRoute(s,size){
 const station=s.buildings.find(b=>b.type==='trade');if(!station)return null;
 const roadSet=new Set(s.roads.map(p=>cellKey(p.x,p.y)));
 const blocked=new Set(s.buildings.map(p=>cellKey(p.x,p.y)));
 const starts=s.roads.filter(p=>Math.abs(p.x-station.x)+Math.abs(p.y-station.y)===1);
 const dist=new Map(),previous=new Map(),open=[],visited=new Set();
 for(const p of starts){const k=cellKey(p.x,p.y);if(!dist.has(k)){dist.set(k,0);open.push({...p,cost:0})}}
 let end=null;
 while(open.length){open.sort((a,b)=>a.cost-b.cost);const current=open.shift(),k=cellKey(current.x,current.y);if(visited.has(k))continue;visited.add(k);
  if(current.x===0||current.y===0||current.x===size-1||current.y===size-1){end=current;break}
  for(const [dx,dy]of[[0,-1],[-1,0],[1,0],[0,1]]){const x=current.x+dx,y=current.y+dy,nk=cellKey(x,y);if(x<0||y<0||x>=size||y>=size||x===RIVER_COLUMN&&!roadSet.has(nk)||blocked.has(nk))continue;const cost=current.cost+(roadSet.has(nk)?1:5);if(cost<(dist.get(nk)??Infinity)){dist.set(nk,cost);previous.set(nk,current);open.push({x,y,cost})}}
 }
 if(!end)return null;const cells=[];for(let p=end;p;p=previous.get(cellKey(p.x,p.y)))cells.unshift({x:p.x+.5,y:p.y+.5});
 const edge=cells.at(-1),outside={...edge};if(end.y===0)outside.y=-2;else if(end.x===0)outside.x=-2;else if(end.y===size-1)outside.y=size+2;else outside.x=size+2;cells.push(outside);return cells;
}
export function tripProgress(d,now){return clamp((now-(d.started??d.arrives-(d.duration??12)))/(d.duration??12))}
export function deliveryStage(d,now){if(!d)return 'parked';const p=tripProgress(d,now);return p<.04?'loading':p<.32?'outbound':p<.62?'away':p<.98?'returning':'parking'}
function along(path,t){
 const {lengths,total}=routeMetrics(path);let remaining=clamp(t)*total;
 for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const f=lengths[i]?Math.min(1,remaining/lengths[i]):0,a=path[i],b=path[i+1];let heading=Math.atan2(b.y-a.y,b.x-a.x);if(i>0&&f<.18){const before=path[i-1],old=Math.atan2(a.y-before.y,a.x-before.x);heading=old+angleDelta(old,heading)*smooth(f/.18)}return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,heading}}
  remaining-=lengths[i];
 }
 return {...path[0],heading:0};
}
export function sampleTruck(d,now,size,home={x:7.5,y:8.5},parkedHeading=0){
 if(!d?.route?.length)return {...home,heading:parkedHeading,visible:true,moving:false,loaded:false,stage:'parked',alpha:1};
 const path=d.route,p=tripProgress(d,now),stage=deliveryStage(d,now),outHeading=Math.atan2(path[1].y-path[0].y,path[1].x-path[0].x);let pose;
 if(stage==='loading')pose={...path[0],heading:(d.parkedHeading??0)+angleDelta(d.parkedHeading??0,outHeading)*smooth(p/.04)};
 else if(stage==='outbound')pose=along(path,(p-.04)/.28);
 else if(stage==='away')return {...path.at(-1),heading:outHeading,visible:false,moving:false,loaded:false,stage,alpha:0};
 else if(stage==='returning')pose=along(returnRoute(path),(p-.62)/.36);
 else{const first=path[0],second=path[1];pose={...first,heading:Math.atan2(first.y-second.y,first.x-second.x)}}
 const boundary=Math.min(pose.x,pose.y,size-pose.x,size-pose.y);
 return {...pose,visible:boundary>-.5,alpha:clamp((boundary+.5)/.8),moving:stage==='outbound'||stage==='returning',loaded:stage==='loading'||stage==='outbound',stage};
}
