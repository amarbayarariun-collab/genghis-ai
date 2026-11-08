// Procedural sound for the steppe: everything is synthesized with WebAudio, no files.
// createAudio() must be started from a user gesture (start button / first key).
//   audio.start() | unlock()        resume / create the context (user gesture)
//   audio.update(dt, { t, speed, riding, grounded, riverDist, fireDist })
//   audio.neigh() chime() jump() splash() toggleMute()
//   audio.duck(amount, seconds)     lower music + ambience during dialogue
//   audio.setMode('day'|'dawn'|'night'|'ger')  ambience colour per chapter
export function createAudio() {
  let ctx = null, master, musicBus, sfxBus, ambBus;
  let wind, river, fire, stepPhase = 0, hoofPhase = 0, muted = false, musicTimer = null;
  let duckK = 1, mode = 'day';
  const MODE = {
    day:   { wind: 1,    music: 0.32, river: 1 },
    dawn:  { wind: 0.7,  music: 0.26, river: 1 },
    night: { wind: 0.55, music: 0.18, river: 0.6 },
    ger:   { wind: 0.15, music: 0.22, river: 0 },
  };
  function applyBuses(secs = 0.6) {
    if (!ctx) return;
    const m = MODE[mode] || MODE.day;
    musicBus.gain.setTargetAtTime(m.music * duckK, ctx.currentTime, secs);
    ambBus.gain.setTargetAtTime(0.7 * duckK, ctx.currentTime, secs);
  }

  function noiseBuffer(sec = 2, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function loopNoise(brown, type, freq, q, bus) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(3, brown); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(bus); src.start();
    return { f, g };
  }

  function start() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.7; ambBus.connect(master);
    // simple reverb for the music: feedback delay
    const dl = ctx.createDelay(); dl.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    musicBus.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(master);
    wind = loopNoise(true, 'bandpass', 500, 0.6, ambBus);
    river = loopNoise(false, 'bandpass', 1400, 0.9, ambBus);
    fire = loopNoise(false, 'highpass', 2500, 0.5, ambBus);
    startMusic();
    applyBuses(0.01);
  }

  // morin khuur-like bowed string: sawtooth + vibrato through a body filter
  function bow(freq, t0, dur, vol = 0.18) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.003;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = 0; vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(freq * 0.012, t0 + dur * 0.5);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.35, dur * 0.3));
    g.gain.setValueAtTime(vol * 0.85, t0 + dur * 0.75); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(f); o2.connect(f); f.connect(g).connect(musicBus);
    [o, o2, vib].forEach((x) => { x.start(t0); x.stop(t0 + dur + 0.05); });
  }
  function drone(freq, t0, dur) { bow(freq, t0, dur, 0.07); bow(freq * 1.5, t0, dur, 0.04); }

  // Mongolian pentatonic (D minor pentatonic) phrases
  const SCALE = [146.8, 174.6, 196.0, 220.0, 261.6, 293.7, 349.2, 392.0, 440.0];
  function phrase() {
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.1;
    drone(73.4, t, 12);
    let at = t + 0.5, idx = 4 + Math.floor(Math.random() * 3);
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      const d = [0.6, 0.9, 1.2, 1.8][Math.floor(Math.random() * 4)];
      bow(SCALE[idx], at, d * 1.1);
      at += d;
    }
    bow(SCALE[Math.random() < 0.5 ? 0 : 5], at, 2.6); // resolve on the tonic
  }
  function startMusic() { phrase(); musicTimer = setInterval(phrase, 13000); }

  function thump(freq, vol, len = 0.09, noise = 0.5) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + len + 0.02);
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.1);
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900 + Math.random() * 600;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(vol * noise, t); ng.gain.exponentialRampToValueAtTime(0.001, t + len * 0.8);
    n.connect(nf).connect(ng).connect(sfxBus); n.start(t);
  }

  function neigh() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1100, t + 0.15);
    o.frequency.linearRampToValueAtTime(500, t + 0.9);
    const trem = ctx.createOscillator(); trem.frequency.value = 22;
    const tg = ctx.createGain(); tg.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 1.0);
    trem.connect(tg).connect(g.gain);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3;
    o.connect(f).connect(g).connect(sfxBus);
    o.start(t); trem.start(t); o.stop(t + 1.05); trem.stop(t + 1.05);
  }
  function chime() { // dialogue / pickup
    if (!ctx) return;
    const t = ctx.currentTime;
    [587, 880].forEach((fq, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.15, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.8);
      o.connect(g).connect(sfxBus); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.85);
    });
  }
  function jump() { if (ctx) thump(220, 0.25, 0.12, 0.8); }
  function splash() {
    if (!ctx) return;
    const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    n.connect(f).connect(g).connect(sfxBus); n.start(t);
  }

  // per frame: speed (m/s), riding, distances to river and fire, time
  function update(dt, { speed = 0, riding = false, grounded = true, riverDist = 99, fireDist = 99, t = 0 }) {
    if (!ctx) return;
    const now = ctx.currentTime, k = 0.15;
    const m = MODE[mode] || MODE.day;
    const gust = (0.12 + 0.08 * Math.sin(t * 0.31) + 0.05 * Math.sin(t * 1.7)) * m.wind;
    wind.g.gain.setTargetAtTime(gust + (riding ? speed * 0.012 : 0), now, k);
    wind.f.frequency.setTargetAtTime(380 + gust * 900 + speed * 15, now, k);
    river.g.gain.setTargetAtTime(Math.max(0, 1 - riverDist / 22) * 0.16 * m.river, now, k);
    fire.g.gain.setTargetAtTime(Math.max(0, 1 - fireDist / 9) * 0.06 * (0.6 + Math.random() * 0.8), now, 0.03);
    if (riding && speed > 0.5) {
      hoofPhase += dt * (speed > 8 ? 3.2 : 2.2);
      const beats = speed > 8 ? [0, 0.12, 0.24, 0.5] : [0, 0.25, 0.5, 0.75];
      const prev = (hoofPhase - dt * (speed > 8 ? 3.2 : 2.2)) % 1, cur = hoofPhase % 1;
      for (const b of beats) if ((prev < b && cur >= b) || (prev > cur && b < cur)) thump(95 + Math.random() * 20, 0.35, 0.08);
    } else if (!riding && grounded && speed > 0.5) {
      const before = stepPhase; stepPhase += dt * speed * 0.62;
      if (Math.floor(stepPhase) !== Math.floor(before)) thump(140 + Math.random() * 30, 0.12, 0.06, 1.2);
    }
  }

  function toggleMute() {
    muted = !muted;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.1);
    return muted;
  }
  function duck(amount = 0.4, seconds = 0.6) { duckK = amount; applyBuses(seconds); }
  function setMode(id) { mode = MODE[id] ? id : 'day'; applyBuses(1.2); }
  function attachUnlock() {
    const EVS = ['pointerdown', 'keydown', 'touchend'];
    const once = () => { start(); for (const ev of EVS) removeEventListener(ev, once); };
    for (const ev of EVS) addEventListener(ev, once, { passive: true });
  }
  return { start, unlock: start, attachUnlock, update, neigh, chime, jump, splash, toggleMute, duck, setMode, get muted() { return muted; } };
}
