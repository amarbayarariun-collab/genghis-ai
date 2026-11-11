// Lightweight WebAudio. createAudio is the unused wind bed.
// createSfx is the quiet one-shots. Neither reads or replaces assets/audio/theme.mp3.
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
    if (wind) {
      wind.filter.frequency.value = mode === 'night' ? 180 : mode === 'dawn' ? 240 : 300;
      wind.g.gain.value = mode === 'night' ? 0.28 : 0.4;
    }
    if (fire) fire.g.gain.value = mode === 'night' ? 0.22 : mode === 'ger' ? 0.3 : 0.08;
  }

  return { unlock, setMode };
}

/** Quiet one-shots: hooves, bow, hit, chime. No looping bed. */
export function createSfx() {
  let ctx = null;
  let master = null;
  let noise = null;
  let started = false;
  let last = '';

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
  }

  function noiseBuf() {
    if (noise) return noise;
    const n = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    return noise;
  }

  function burst(freq, dur, peak) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  function tone(freq, dur, peak) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  function ready(name) {
    if (!started || !ctx) return '';
    last = name;
    return name;
  }

  return {
    async unlock() {
      try {
        ensure();
        if (!ctx) return;
        if (ctx.state === 'suspended') await ctx.resume();
        started = true;
      } catch { /* a blocked context stays silent */ }
    },
    hoof(gait) {
      if (!ready('Туурай')) return '';
      const heavy = gait === 'gallop' || gait === 'canter';
      burst(heavy ? 160 : 280, 0.07, heavy ? 0.05 : 0.035);
      return last;
    },
    bow() {
      if (!ready('Нум')) return '';
      burst(1600, 0.09, 0.04);
      tone(740, 0.08, 0.03);
      return last;
    },
    hit() {
      if (!ready('Онив')) return '';
      burst(140, 0.12, 0.06);
      return last;
    },
    chime() {
      if (!ready('Болсон')) return '';
      tone(523, 0.18, 0.03);
      tone(784, 0.22, 0.02);
      return last;
    },
    get last() { return last; },
  };
}
