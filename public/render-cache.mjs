export function renderPixelRatio(width,height,deviceRatio=1,quality='auto') {
  const cap=quality==='smooth'?1:quality==='sharp'?2:1.5;
  const budget=quality==='sharp'?6000000:2500000;
  return Math.max(.5,Math.min(deviceRatio,cap,Math.sqrt(budget/Math.max(1,width*height))));
}
// Backing surfaces are bounded by the viewport, even when the map is zoomed in.
export function createLayerCache(makeCanvas=()=>document.createElement('canvas')) {
  let canvas,context,lastKey;
  return {draw(target,key,width,height,ratio,paint){
    if(!canvas){canvas=makeCanvas();context=canvas.getContext('2d');}
    const signature=[key,width,height,ratio].join('|');
    if(lastKey!==signature){
      const w=Math.ceil(width*ratio),h=Math.ceil(height*ratio);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
      paint(context);lastKey=signature;
    }
    target.drawImage(canvas,0,0,width,height);
  },clear(){lastKey=undefined;if(canvas){canvas.width=0;canvas.height=0;}}};
}
export function createSpriteCache(maxPixels=3000000,makeCanvas=()=>document.createElement('canvas')) {
  const items=new Map();let pixels=0;
  return {get(key,width,height,ratio,paint){
    key=[key,width,height,ratio].join('|');
    if(items.has(key)){const entry=items.get(key);items.delete(key);items.set(key,entry);return entry.canvas;}
    const canvas=makeCanvas();canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
    const area=canvas.width*canvas.height;
    while(items.size&&(pixels+area>maxPixels||items.size>=96)){
      const first=items.keys().next().value,evicted=items.get(first);pixels-=evicted.area;items.delete(first);evicted.canvas.width=0;evicted.canvas.height=0;
    }
    const context=canvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);paint(context);
    if(area<=maxPixels){items.set(key,{canvas,area});pixels+=area;}
    return canvas;
  },clear(){for(const {canvas}of items.values()){canvas.width=0;canvas.height=0;}items.clear();pixels=0;},get pixels(){return pixels;}};
}
