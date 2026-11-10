// Locally synthesized music: no downloads, autoplay, or external audio files.
export function createFarmAudio(getPreferences, getDay) {
  let context, master, paused = false, beat = 0, busy = false, lastEffect = 0;
  const Context = window.AudioContext || window.webkitAudioContext;
  async function unlock() {
    if (!Context || busy) return;
    busy = true;
    try {
      context ??= new Context();
      if (!master) {master = context.createGain(); master.connect(context.destination);}
      if (context.state === 'suspended') await context.resume();
      update();
    } catch { /* Audio is optional; a blocked device must not stop the game. */ }
    finally {busy = false;}
  }
  function update() {
    if (!master) return;
    const p = getPreferences();
    master.gain.setTargetAtTime(paused || document.hidden ? 0 : Math.max(0, Math.min(1, p.volume)), context.currentTime, .12);
  }
  function note(frequency, at, duration, volume, type = 'sine') {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + .025);
    envelope.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(envelope); envelope.connect(master);
    oscillator.start(at); oscillator.stop(at + duration + .05);
    oscillator.onended = () => {oscillator.disconnect(); envelope.disconnect();};
  }
  function effect(kind) {
    if (!context || context.state !== 'running' || paused || document.hidden || !getPreferences().effects) return;
    const at = context.currentTime;
    if (kind === 'harvest' && at - lastEffect < .7) return;
    lastEffect = at;
    const notes = {build: [262, 392, 523], harvest: [659, 784], reward: [523, 659, 784, 1047], sale: [392, 523, 659]};
    (notes[kind] || notes.build).forEach((frequency, i) => note(frequency, at + i * .09, .3, .09, 'triangle'));
  }
  const timer = setInterval(() => {
    update();
    if (!context || context.state !== 'running' || paused || document.hidden || !getPreferences().music) return;
    const day = getDay();
    // The night phrase is slower and an octave lower than the daytime flute.
    const melody = day ? [523,659,784,659,587,0,659,523,392,523,587,659,523,0,392,0]
      : [262,0,330,0,392,0,330,0,294,0,262,0,196,0,0,0];
    const frequency = melody[beat % melody.length];
    if (frequency) note(frequency, context.currentTime + .015, day ? .6 : 1.2, day ? .045 : .035);
    if (beat % 8 === 0) note(day ? 131 : 98, context.currentTime, 2.5, .03);
    beat++;
  }, 420);
  document.addEventListener('pointerdown', unlock, {once: true});
  document.addEventListener('keydown', unlock, {once: true});
  document.addEventListener('visibilitychange', update);
  return {unlock, effect, update, setPaused(value) {paused = value; update();},
    supported: !!Context, destroy() {clearInterval(timer); context?.close();}};
}
