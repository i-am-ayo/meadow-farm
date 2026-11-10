import test from 'node:test';
import assert from 'node:assert/strict';
import {newFarmAccount,buildOrdinary,layout,capacity,roomFor,withFarmRead,tick,
  haulerSnapshot,sampleHaulers,activeHaulers,normalizeState} from '../dist/rules.mjs';
import {createLayerCache,createSpriteCache,renderPixelRatio} from '../dist/render-cache.mjs';
import {createDOMUpdates} from '../dist/dom-updates.mjs';
import {routeMetrics,returnRoute} from '../dist/path-metrics.mjs';
import {buildStarter} from '../dist/round-layout.mjs';
const BASE=Date.parse('2030-05-12T10:00:00+08:00');
const farm=()=>{const s=newFarmAccount('A',BASE);buildStarter(s);return s;};

test('one read pass shares topology while the next sees newly disconnected or rebuilt roads',()=>{
  const s=farm();withFarmRead(s,()=>{assert.equal(layout(s),layout(s));assert.equal(capacity(s,'flour'),200);});
  const road=s.roads.find(r=>r.x===7&&r.y===8);s.roads.splice(s.roads.indexOf(road),1);
  withFarmRead(s,()=>assert.equal(capacity(s,'flour'),0));
  s.roads.push(road);withFarmRead(s,()=>assert.equal(capacity(s,'vegetables'),200));
});
test('read scopes do not cache live stock or survive exceptions and account switches',()=>{
  const s=farm();withFarmRead(s,()=>{s.flour=200;assert.equal(roomFor(s,{wood:3}),false);s.flour=0;assert.equal(roomFor(s,{wood:3}),true);});
  assert.throws(()=>withFarmRead(s,()=>{capacity(s,'wood');throw Error('read cancelled');}));
  s.buildings.find(b=>b.type==='barn').enabled=false;assert.equal(capacity(s,'wood'),0);
  const other=farm();assert.equal(capacity(other,'wood'),200);assert.equal(capacity(s,'wood'),0);
});
test('the indexed road network matches adjacency-based connectivity on varied layouts',()=>{
  let seed=417;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let trial=0;trial<12;trial++){
    const roads=[];for(let x=1;x<23;x++)for(let y=1;y<23;y++)if(y===8||random()<.35)roads.push({x,y});
    const s={roads,buildings:[{type:'trade',x:8,y:9}]},seen=new Set(),queue=roads.filter(p=>Math.abs(p.x-8)+Math.abs(p.y-9)===1);
    for(const p of queue)seen.add(`${p.x},${p.y}`);
    for(let i=0;i<queue.length;i++)for(const p of roads)if(Math.abs(p.x-queue[i].x)+Math.abs(p.y-queue[i].y)===1&&!seen.has(`${p.x},${p.y}`)){seen.add(`${p.x},${p.y}`);queue.push(p);}
    const indexed=layout(s);assert.deepEqual([...indexed.reached].sort(),[...seen].sort());
    for(let x=1;x<23;x++)for(let y=1;y<23;y++)assert.equal(indexed.connected({x,y}),roads.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)===1&&seen.has(`${p.x},${p.y}`)));
  }
});
test('animation interpolates a read-only snapshot and refreshes correctly after pausing a facility',()=>{
  const s=farm();s.water=20;tick(s,BASE+1000);const crop=s.buildings.find(b=>b.type==='wheat');crop.job.remaining=crop.job.haul.duration;
  const before=JSON.stringify(s),snapshot=haulerSnapshot(s);
  for(const fraction of [0,.25,.75])assert.deepEqual(sampleHaulers(snapshot,fraction),activeHaulers(s,fraction));
  assert.equal(JSON.stringify(s),before);
  crop.enabled=false;assert.ok(!sampleHaulers(haulerSnapshot(s)).some(h=>h.sourceId===`${crop.x},${crop.y}`));
  crop.enabled=true;const restored=normalizeState(JSON.parse(JSON.stringify(s)));assert.deepEqual(activeHaulers(restored,.5),activeHaulers(s,.5));
});
test('unchanged source strings do not rewrite translated DOM, and explicit replacement starts a fresh dialog',()=>{
  let textWrites=0,htmlWrites=0,attributeWrites=0,text='',html='';
  const node={set textContent(v){textWrites++;text=v;},get textContent(){return text;},set innerHTML(v){htmlWrites++;html=v;},get innerHTML(){return html;},setAttribute(){attributeWrites++;}};
  const dom=createDOMUpdates();dom.text(node,'清水');dom.text(node,'清水');assert.equal(textWrites,1);
  text='Water';dom.text(node,'清水');assert.equal(textWrites,1);assert.equal(text,'Water');
  dom.html(node,'<b>库存</b>');html='<b>Inventory</b>';dom.html(node,'<b>库存</b>');assert.equal(htmlWrites,1);
  dom.attribute(node,'title','status');dom.attribute(node,'title','status');assert.equal(attributeWrites,1);
  dom.replaceHTML(node,'<input>');dom.replaceHTML(node,'<input>');assert.equal(htmlWrites,3);
});
function fakeCanvas(){return {width:0,height:0,getContext:()=>({setTransform(){},clearRect(){}})};}
test('terrain cache reuses stationary frames and repaints after camera, size, quality or topology changes',()=>{
  const layer=createLayerCache(fakeCanvas),target={drawImage(){}},calls={paint:0},paint=()=>calls.paint++;
  layer.draw(target,'camera-0/roads-0',400,300,1.5,paint);
  for(let n=0;n<60;n++)layer.draw(target,'camera-0/roads-0',400,300,1.5,paint);
  assert.equal(calls.paint,1);
  layer.draw(target,'camera-1/roads-0',400,300,1.5,paint);
  layer.draw(target,'camera-1/roads-1',400,300,1.5,paint);
  layer.draw(target,'camera-1/roads-1',500,300,1.5,paint);
  layer.draw(target,'camera-1/roads-1',500,300,1,paint);assert.equal(calls.paint,5);
  layer.clear();layer.draw(target,'camera-1/roads-1',500,300,1,paint);assert.equal(calls.paint,6);
});
test('sprite memory remains bounded through repeated camera angles and pixel ratios',()=>{
  const sprites=createSpriteCache(30000,fakeCanvas);let paints=0;
  const a=sprites.get('well/0',40,40,1,()=>paints++);
  assert.equal(sprites.get('well/0',40,40,1,()=>paints++),a);assert.equal(paints,1);
  assert.notEqual(sprites.get('well/0',40,40,2,()=>paints++),a);
  for(let n=0;n<200;n++){sprites.get(`well/${n}`,60,60,1.5,()=>paints++);assert.ok(sprites.pixels<=30000);}
  assert.equal(a.width,0,'eviction releases the old GPU backing surface');sprites.clear();assert.equal(sprites.pixels,0);
});
test('graphics quality caps backing resolution without changing the logical map size',()=>{
  assert.equal(renderPixelRatio(832,638,2,'auto'),1.5);assert.equal(renderPixelRatio(832,638,2,'smooth'),1);
  assert.equal(renderPixelRatio(832,638,2,'sharp'),2);
  const ratio=renderPixelRatio(3840,2160,2,'auto');assert.ok(3840*2160*ratio*ratio<=2500001);
  assert.equal(renderPixelRatio(832,638,1,'auto'),1);
});
test('route geometry is reused by animation and newly created routes get independent metrics',()=>{
  const route=[{x:0,y:0},{x:3,y:0},{x:3,y:4}],other=[{x:0,y:0},{x:6,y:8}];
  assert.equal(routeMetrics(route).total,7);assert.equal(routeMetrics(route),routeMetrics(route));
  assert.equal(routeMetrics(other).total,10);assert.equal(returnRoute(route),returnRoute(route));
  assert.deepEqual(route,[{x:0,y:0},{x:3,y:0},{x:3,y:4}]);
});
