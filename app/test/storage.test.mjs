import test from 'node:test';
import assert from 'node:assert/strict';
import {storageOverview} from '../dist/storage.mjs';
import {normalizeState,mint,placeAsset,tick,setAssetEnabled,startDelivery} from '../dist/rules.mjs';

const farm=()=>normalizeState({accountId:'A',token:128,seconds:0,orders:0,wheat:20,flour:0,bread:9,water:20,buildings:[{type:'barn',x:3,y:7},{type:'trade',x:8,y:8},{type:'mill',x:7,y:3}]});
const barn=s=>s.buildings.find(b=>b.type==='barn');
test('one full inventory category marks the warehouse full even when combined capacity is not full',()=>{
 const s=farm();s.wheat=200;s.flour=10;const v=storageOverview(s,barn(s));assert.equal(v.status,'full');assert.equal(v.groups[0].free,0);assert.equal(v.groups[1].used,19);assert.equal(v.groups[1].free,181);
 s.wheat=170;assert.equal(storageOverview(s,barn(s)).status,'tight');s.wheat=10;assert.equal(storageOverview(s,barn(s)).status,'normal');
});
test('storage buildings show the same shared inventory, with their own capacity contribution',()=>{
 const s=farm(),a=mint(s,'warehouse-logistics');assert.ok(placeAsset(s,a.id,7,7));s.flour=30;s.milk=8;
 const before=JSON.stringify(s),base=storageOverview(s,barn(s)),extra=storageOverview(s,s.buildings.at(-1));
 assert.equal(extra.groups.length,1);assert.equal(extra.groups[0].used,47);assert.equal(extra.groups[0].capacity,360);assert.equal(extra.groups[0].contribution,160);assert.equal(base.groups[1].used,47);assert.equal(JSON.stringify(s),before,'overview does not duplicate or mutate inventory');
});
test('only goods actually being carried to this warehouse appear in transit, and arrival moves them into stock',()=>{
 const s=farm();tick(s);const a=s.assets.find(a=>a.modelId==='mill-rustic');assert.equal(storageOverview(s,barn(s)).incoming.length,0);
 while(a.job.remaining>a.job.haul.duration)tick(s);
 const carrying=storageOverview(s,barn(s));assert.equal(carrying.incoming.length,1);assert.equal(carrying.groups[1].stocks.find(r=>r.resource==='flour').incoming,1);assert.equal(carrying.groups[1].stocks.find(r=>r.resource==='flour').amount,0);
 const far={type:'barn',x:14,y:14};s.buildings.push(far);assert.equal(storageOverview(s,far).incoming.length,0);
 const remaining=a.job.remaining;for(let i=0;i<remaining;i++)tick(s);
 const arrived=storageOverview(s,barn(s));assert.equal(arrived.incoming.length,0);assert.equal(arrived.groups[1].stocks.find(r=>r.resource==='flour').amount,1);
});
test('dispatch updates warehouse goods immediately and does not count sold goods as inbound cargo',()=>{
 const s=farm();assert.equal(storageOverview(s,barn(s)).groups[1].used,9);assert.ok(startDelivery(s));const v=storageOverview(s,barn(s));assert.equal(v.groups[1].used,6);assert.equal(v.incoming.length,0);assert.equal(v.groups[1].free,194);
});
test('paused, disconnected and removed storage preserve stock while exposing the actual capacity and overflow',()=>{
 const s=farm(),a=mint(s,'warehouse-logistics');assert.ok(placeAsset(s,a.id,7,7));const b=s.buildings.at(-1);s.flour=300;
 setAssetEnabled(s,a.id,false);let v=storageOverview(s,b);assert.equal(v.status,'paused');assert.equal(v.groups[0].contribution,0);assert.equal(v.groups[0].used,309);assert.equal(v.groups[0].overflow,109);
 setAssetEnabled(s,a.id,true);s.roads=s.roads.filter(r=>!(r.x===7&&r.y===8)&&!(r.x===6&&r.y===7));v=storageOverview(s,b);assert.equal(v.status,'disconnected');assert.equal(v.groups[0].contribution,0);
 s.buildings=s.buildings.filter(q=>q!==b);assert.equal(storageOverview(s,barn(s)).groups[1].used,309);s.roads.push({x:7,y:8},{x:6,y:7});assert.equal(storageOverview(s,barn(s)).status,'overflow');
});
