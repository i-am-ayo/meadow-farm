export function createFarmEffects() {
  let bursts = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function burst(x, y, color = '#efd17c') {
    if (reduced.matches) return;
    bursts.push({x, y, color, born: performance.now()});
    bursts = bursts.slice(-12);
  }
  function draw(ctx, iso, time, enabled, paused, river, size) {
    if (!enabled || reduced.matches || paused) return;
    ctx.save();
    // Shallow concentric ripples and leaves follow the world projection.
    for (let i = 0; i < 8; i++) {
      const phase = (time / 2200 + i * .31) % 1, p = iso(river + .62, (i * 3 + 1) % size + phase * .2, .02);
      ctx.strokeStyle = `rgba(235,255,244,${(1-phase)*.55})`;ctx.lineWidth = 1;
      ctx.beginPath();ctx.ellipse(p.x,p.y,2+phase*8,1+phase*3,0,0,Math.PI*2);ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const drift = (time / 9000 + i * .13) % 1;
      const p = iso((i * 7 + drift * 3) % size, (i * 5 + drift * size) % size, .5 + Math.sin(time/1500+i)*.2);
      ctx.fillStyle = i % 2 ? '#9aab6570' : '#d0b66b75';
      ctx.beginPath();ctx.ellipse(p.x,p.y,3.5,1.5,time/2000+i,0,Math.PI*2);ctx.fill();
    }
    bursts = bursts.filter(b => time - b.born < 1000);
    for (const b of bursts) {
      const age = (time-b.born)/1000, p = iso(b.x+.5,b.y+.5,.7);
      ctx.globalAlpha = 1-age;ctx.fillStyle = b.color;
      for (let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*age*35,p.y+Math.sin(a)*age*23-age*25,2*(1-age)+.5,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
  return {burst, draw};
}
