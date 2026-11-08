// Lightweight WebAudio ambience (no asset files) — wind + fire crackle.
export function createAudio() {
  let ctx = null;
  let master = null;
  let wind = null;
  let fire = null;
  let started = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }

  function noiseBuffer(seconds = 2) {
    const n = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startWind() {
    if (!ctx || wind) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(3);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 280;
    filter.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    wind = { src, filter, g };
  }

  function startFire() {
    if (!ctx || fire) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    fire = { src, filter, g };
  }

  async function unlock() {
    ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    if (!started) {
      startWind();
      startFire();
      started = true;
    }
  }

  function setMode(mode) {
    if (!master) return;
    // night / dawn / day balances
    if (wind) {
      wind.filter.frequency.value = mode === 'night' ? 180 : mode === 'dawn' ? 240 : 300;
      wind.g.gain.value = mode === 'night' ? 0.28 : 0.4;
    }
    if (fire) fire.g.gain.value = mode === 'night' ? 0.22 : mode === 'ger' ? 0.3 : 0.08;
  }

  return { unlock, setMode };
}
