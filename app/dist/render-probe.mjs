// Opt-in local diagnostic: append ?perf=1 to compare the same farm and viewport.
// Frame work measures CPU command time, not GPU completion or network latency.
export function createRenderProbe() {
  if (!new URLSearchParams(location.search).has('perf')) return {sample(){}};
  const output=document.createElement('output');output.id='render-performance';output.dataset.i18nIgnore='';
  output.style.cssText='position:fixed;bottom:8px;left:8px;z-index:7;padding:8px 12px;background:#183b2ee8;color:#fff;font:12px monospace;border-radius:6px;pointer-events:none';
  document.body.append(output);
  let last=0,published=0,frames=0;const times=[],work=[];
  return {sample(time,cpu){
    frames++;if(last&&time-last<1000){times.push(time-last);work.push(cpu);}last=time;
    if(times.length>240){times.shift();work.shift();}
    if(time-published<2000||times.length<20)return;published=time;
    const sorted=[...work].sort((a,b)=>a-b),intervals=[...times].sort((a,b)=>a-b);
    const data={frames,samples:times.length,fps:Math.round(1000/(times.reduce((a,b)=>a+b,0)/times.length)),
      workMs:Number((work.reduce((a,b)=>a+b,0)/work.length).toFixed(2)),p95WorkMs:Number(sorted[Math.floor(sorted.length*.95)].toFixed(2)),
      p95FrameMs:Number(intervals[Math.floor(intervals.length*.95)].toFixed(2)),slowFrames:times.filter(n=>n>34).length};
    output.dataset.metrics=JSON.stringify(data);output.textContent=`${data.fps} FPS · CPU ${data.workMs} ms · p95 ${data.p95WorkMs} ms`;
  }};
}
