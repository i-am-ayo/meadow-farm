import test from 'node:test';
import assert from 'node:assert/strict';
import {findHaulRoute} from '../dist/hauling.mjs';
import {normalizeState,tick,activeHaulers,productionInfo,mint,placeAsset,setAssetEnabled,MAP_SIZE} from '../dist/rules.mjs';

const farm=()=>normalizeState({accountId:'A',token:128,seconds:0,orders:0,wheat:20,flour:0,bread:0,water:20,buildings:[{type:'barn',x:3,y:7},{type:'trade',x:8,y:8},{type:'mill',x:7,y:3}]});
const owner=s=>s.assets.find(a=>a.id===s.buildings.find(b=>b.type==='mill').assetId);
const advance=(s,n)=>{for(let i=0;i<n;i++)tick(s)};

test('a real batch produces a loaded worker, follows its route, then increments stock exactly once at arrival',()=>{
 const s=farm(),b=s.buildings.find(b=>b.type==='mill'),cycle=productionInfo(s,b).cycle;
 tick(s);const a=owner(s);assert.ok(a.job.haul);assert.equal(activeHaulers(s).length,0);
 while(a.job.remaining>a.job.haul.duration)tick(s);
 const start=activeHaulers(s)[0];assert.ok(start);assert.equal(s.flour,0);assert.deepEqual(start.outputs,{flour:1});
 const halfway=activeHaulers(s,.5)[0];assert.notDeepEqual([halfway.x,halfway.y],[start.x,start.y]);
 const remaining=a.job.remaining;advance(s,remaining-1);assert.equal(s.flour,0);
 tick(s);assert.equal(s.seconds,cycle);assert.equal(s.flour,1);assert.equal(s.haulArrivals.length,1);assert.equal(s.haulArrivals[0].destinationName,'谷物与加工仓库');
 assert.equal(activeHaulers(s).length,0);tick(s);assert.equal(s.flour,1);assert.equal(s.productionTotals.flour,1);
});
test('hauling prefers actual roads and avoids other buildings and the river',()=>{
 const s=farm(),source=s.buildings.find(b=>b.type==='mill'),target=s.buildings[0];
 s.buildings.push({type:'tree',x:5,y:4});
 const route=findHaulRoute(s,source,target,MAP_SIZE);assert.ok(route.length>3);
 const middle=route.slice(1,-1);assert.ok(middle.some(p=>s.roads.some(r=>r.x===Math.floor(p.x)&&r.y===Math.floor(p.y))));
 for(const p of middle){assert.notEqual(Math.floor(p.x),MAP_SIZE-2);assert.ok(!s.buildings.some(b=>b!==source&&b!==target&&b.x===Math.floor(p.x)&&b.y===Math.floor(p.y)))}
 const enclosed={roads:[],buildings:[source,target,...[[6,3],[8,3],[7,2],[7,4]].map(([x,y])=>({type:'tree',x,y}))]};assert.equal(findHaulRoute(enclosed,source,target,MAP_SIZE),null);
});
test('pause, save and reload preserve the same cargo and position without paying inputs again',()=>{
 const s=farm();tick(s);const a=owner(s);while(a.job.remaining>a.job.haul.duration)tick(s);
 const pose=activeHaulers(s,.3)[0],wheat=s.wheat;
 const reloaded=normalizeState(JSON.parse(JSON.stringify(s)));assert.deepEqual(activeHaulers(reloaded,.3)[0],pose);
 setAssetEnabled(s,a.id,false);advance(s,10);assert.equal(activeHaulers(s).length,0);assert.equal(s.wheat,wheat);
 setAssetEnabled(s,a.id,true);assert.deepEqual(activeHaulers(s,.3)[0],pose);advance(s,a.job.remaining);assert.equal(s.flour,1);assert.equal(s.wheat,wheat);
});
test('a full warehouse holds the worker at its destination and unloads once space is available',()=>{
 const s=farm();tick(s);const a=owner(s);while(a.job.remaining>a.job.haul.duration)tick(s);
 s.flour=200;advance(s,a.job.remaining);assert.equal(s.flour,200);assert.equal(a.job.remaining,0);assert.ok(activeHaulers(s)[0].waiting);assert.equal(s.haulArrivals.length,0);
 s.flour=199;tick(s);assert.equal(s.flour,200);assert.equal(s.haulArrivals.length,1);tick(s);assert.equal(s.haulArrivals.length,1);
});
test('recalled jobs and old saves rebuild routes for the current farm without resetting production',()=>{
 const s=farm();tick(s);const a=owner(s),remaining=a.job.remaining,paidWheat=s.wheat;
 delete a.job.haul;tick(s);assert.ok(a.job.haul);assert.equal(a.job.remaining,remaining-1);
 s.buildings=s.buildings.filter(b=>b.assetId!==a.id);assert.equal(activeHaulers(s).length,0);assert.ok(placeAsset(s,a.id,7,4));tick(s);
 assert.deepEqual(a.job.haul.source,{x:7,y:4});assert.equal(s.wheat,paidWheat);
});
test('wheat goes to a nearby silo, processed goods to a warehouse, and water or power are not carried as crates',()=>{
 const s=farm(),silo=mint(s,'silo-bulk'),warehouse=mint(s,'warehouse-logistics');assert.ok(placeAsset(s,silo.id,4,4));assert.ok(placeAsset(s,warehouse.id,7,4));s.buildings.push({type:'wheat',x:4,y:3});
 for(const [model,x,y] of [['well-stone',2,7],['solar-garden',5,7]]){const a=mint(s,model);assert.ok(placeAsset(s,a.id,x,y))}
 tick(s);assert.equal(owner(s).job.haul.destinationName,'集配货仓');assert.equal(s.buildings.find(b=>b.type==='wheat').job.haul.destinationName,'丰收筒仓');
 for(const type of ['well','solar']){const b=s.buildings.find(b=>b.type===type),a=s.assets.find(a=>a.id===b.assetId);assert.equal(a.job.haul,undefined)}
});
