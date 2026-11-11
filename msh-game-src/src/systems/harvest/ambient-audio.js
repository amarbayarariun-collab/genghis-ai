/**
 * ambient-audio.js — Хээрийн дуу чимээ (WebAudio synth soundscape: wind, horses, eagles, морин хуур drone)
 *
 * Source / idea (all NO-license repos → architecture re-implemented, no code copied):
 *   - Sumiro bundle `audio-*.js`: a *data-driven soundscape per chapter* — `beds` (looping filtered noise with a
 *     dB level, a wander `range`, and a slow filter `sweep`), `events` (random one-shots, `every: [min,max]`,
 *     `first`, `far`), `music` (a `voice`, a pentatonic-ish `scale`, 2–4 `notes` per phrase, `gap`, `drone`
 *     pairs [Hz, dB]) and `space` (reverb send + decay). Also: unlock on pointerdown/keydown/touchend, `audio.duck`,
 *     footstep "surface" kit, suspend when the tab hides.
 *   - Walden `game/src/music.js` / `sfx.js`: filtered-noise impulse response for the hall, look-ahead scheduler on
 *     the audio clock, detuned-saw ensemble with an opening lowpass, "swell never struck" envelopes, noiseBurst/tone
 *     primitives.
 *   - sisyphus README: music softens while paused and silences in a hidden tab.
 *   Sumiro v2 note: xikhar moved *final* music to Lyria 3.5 + ElevenLabs voices (see xikhar-harvest.md); this synth
 *   is the $0 placeholder until Suno/Lyria tracks exist — swap `music` for a looped buffer then.
 * License of this file: MIT (MSH project). Themed Mongolian: no bells/temple/sea cues.
 *
 * Wire into demo-slice/src/main.js:
 *   import { createSteppeAudio } from './systems/ambient-audio.js';
 *   const audio = createSteppeAudio();  audio.attachUnlock();          // starts on first click/key (browser rule)
 *   // loadScene(id): audio.setChapter(id);     // 'camp' | 'burkhan' | 'act2' | 'act3'
 *   // dialogue start/end: audio.duck(0.4, 0.6) / audio.duck(1, 1.2)
 *   // footsteps: stride.update(..., (p, dir) => { dust.step(p, dir); audio.step(sceneId === 'burkhan' ? 'rock' : 'grass'); });
 *   // M key: audio.toggleMute();
 */

const PENTA_D = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99]; // D E F# A B (anhemitonic, long-song feel)
const PENTA_G_LOW = [98.0, 110.0, 123.47, 146.83, 164.81, 196.0, 220.0];

/** Chapter soundscapes. Levels in dB (0 = full). Edit freely; nothing else needs to change. */
export const SCAPES = {
  camp: {
    beds: [
      { noise: 'brown', filters: [{ type: 'lowpass', f: 240 }, { type: 'highpass', f: 40 }], level: -30, range: 5, sweep: [170, 340], lag: 0.8 },
      { noise: 'pink', filters: [{ type: 'bandpass', f: 720, Q: 0.5 }, { type: 'lowpass', f: 2100 }], level: -36, range: 7, sweep: [520, 1150], lag: 1.4 },
    ],
    events: [
      { play: 'fireCrackle', every: [1.2, 3.5], first: 1, level: -18 },
      { play: 'horseSnort', every: [12, 30], first: 6, level: -8, far: true },
      { play: 'feltFlap', every: [9, 22], first: 4, level: -14 },
      { play: 'horseNeigh', every: [45, 100], first: 28, level: -12, far: true },
      { play: 'eagleCry', every: [35, 80], first: 20, level: -14, far: true },
      { play: 'windGust', every: [14, 32], first: 9, level: -10 },
    ],
    music: { voice: 'khuur', level: -24, every: [18, 34], first: 7, notes: [2, 4], gap: [1.2, 2.6], scale: PENTA_D, drone: [[73.42, -36], [110.0, -42]] },
    space: { send: 0.28, seconds: 2.0, decay: 0.45 },
  },
  burkhan: {
    beds: [
      { noise: 'brown', filters: [{ type: 'lowpass', f: 320 }, { type: 'highpass', f: 45 }], level: -26, range: 7, sweep: [220, 520], lag: 0.6 },
      { noise: 'pink', filters: [{ type: 'bandpass', f: 1100, Q: 0.6 }, { type: 'lowpass', f: 3000 }], level: -32, range: 9, sweep: [700, 1900], lag: 1.0 },
    ],
    events: [
      { play: 'eagleCry', every: [14, 38], first: 5, level: -10, far: true },
      { play: 'windGust', every: [8, 20], first: 3, level: -6 },
      { play: 'rockfall', every: [40, 90], first: 30, level: -16, far: true },
    ],
    music: { voice: 'khuur', level: -26, every: [26, 48], first: 12, notes: [2, 3], gap: [2.0, 3.5], scale: PENTA_G_LOW, drone: [[49.0, -34]] },
    space: { send: 0.4, seconds: 3.2, decay: 0.55 },
  },
  act2: {
    beds: [
      { noise: 'brown', filters: [{ type: 'lowpass', f: 260 }, { type: 'highpass', f: 40 }], level: -29, range: 6, sweep: [180, 400], lag: 0.9 },
      { noise: 'pink', filters: [{ type: 'bandpass', f: 800, Q: 0.5 }, { type: 'lowpass', f: 2400 }], level: -35, range: 8, sweep: [560, 1300], lag: 1.3 },
    ],
    events: [
      { play: 'hoofRhythm', every: [25, 60], first: 10, level: -14, far: true },
      { play: 'horseNeigh', every: [30, 70], first: 16, level: -12, far: true },
      { play: 'horseSnort', every: [10, 26], first: 4, level: -9, far: true },
      { play: 'windGust', every: [12, 28], first: 7, level: -9 },
      { play: 'eagleCry', every: [40, 90], first: 33, level: -15, far: true },
    ],
    music: { voice: 'khuur', level: -24, every: [16, 30], first: 5, notes: [3, 4], gap: [1.0, 2.2], scale: PENTA_D, drone: [[73.42, -36], [146.83, -44]] },
    space: { send: 0.3, seconds: 2.2, decay: 0.45 },
  },
  act3: {
    beds: [
      { noise: 'brown', filters: [{ type: 'lowpass', f: 230 }, { type: 'highpass', f: 40 }], level: -31, range: 5, sweep: [170, 330], lag: 0.9 },
      { noise: 'pink', filters: [{ type: 'bandpass', f: 420, Q: 0.4 }, { type: 'lowpass', f: 1400 }], level: -34, range: 4, sweep: [360, 560], lag: 2.0 }, // crowd murmur-ish
    ],
    events: [
      { play: 'drumFar', every: [18, 40], first: 6, level: -12, far: true },
      { play: 'horseSnort', every: [8, 20], first: 3, level: -10, far: true },
      { play: 'feltFlap', every: [6, 16], first: 2, level: -13 },
      { play: 'hoofRhythm', every: [30, 70], first: 20, level: -15, far: true },
    ],
    music: { voice: 'khuur', level: -22, every: [14, 26], first: 4, notes: [3, 5], gap: [0.9, 1.8], scale: PENTA_D, drone: [[73.42, -34], [110.0, -40], [146.83, -44]] },
    space: { send: 0.34, seconds: 2.6, decay: 0.5 },
  },
};

const db = (v) => Math.pow(10, v / 20);
const rand = (a, b) => a + Math.random() * (b - a);

function makeNoise(ctx, kind, seconds = 2.5) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') { // 3-pole approximation
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else { brown = (brown + 0.02 * w) / 1.02; d[i] = brown * 3.5; }
  }
  return buf;
}

function makeImpulse(ctx, seconds, decay) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * 0.12;            // dark tail
      d[i] = lp * Math.pow(1 - i / n, 2.0 + decay * 3) * Math.min(1, i / (ctx.sampleRate * 0.03));
    }
  }
  return buf;
}

export function createSteppeAudio(opts = {}) {
  const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  const noop = () => {};
  if (!Ctx) {
    return { ready: false, attachUnlock: noop, unlock: noop, setChapter: noop, step: noop, cue: noop, duck: noop, toggleMute: () => false, setWind: noop, dispose: noop };
  }

  let ctx = null, master, comp, busAmb, busFx, busMusic, reverb, revGain, noises = {};
  let muted = false, chapter = null, timer = null;
  let beds = [], events = [], music = null, windK = 1;
  const volume = opts.volume ?? 0.8;

  function init() {
    if (ctx) return;
    ctx = new Ctx();
    master = ctx.createGain(); master.gain.value = volume;
    comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    busAmb = ctx.createGain(); busFx = ctx.createGain(); busMusic = ctx.createGain();
    for (const b of [busAmb, busFx, busMusic]) b.connect(master);
    reverb = ctx.createConvolver(); revGain = ctx.createGain(); revGain.gain.value = 0.3;
    reverb.connect(revGain).connect(master);
    noises = { white: makeNoise(ctx, 'white'), pink: makeNoise(ctx, 'pink'), brown: makeNoise(ctx, 'brown') };
    document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : (!muted && ctx.resume()); });
    timer = setInterval(schedule, 300);
    if (chapter) applyChapter(chapter);
  }

  // ---------- primitives (Walden-style) ----------
  function noiseBurst({ kind = 'white', f0, f1, q = 1, dur = 0.2, peak = 0.3, type = 'bandpass', attack = 0.01, at = 0, out = busFx, far = false, pan = 0 }) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = noises[kind]; src.playbackRate.value = rand(0.85, 1.15);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(out);
    if (far) g.connect(reverb);
    src.start(t, Math.random()); src.stop(t + dur + attack + 0.05);
  }
  function tone({ f0, f1 = f0, dur = 0.3, peak = 0.2, type = 'sine', attack = 0.01, at = 0, out = busFx, far = false, vib = 0, vibHz = 5.5, pan = 0 }) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib > 0) { const v = ctx.createOscillator(); v.frequency.value = vibHz; const vg = ctx.createGain(); vg.gain.value = f0 * vib; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + dur + 0.1); }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
    if (far) g.connect(reverb);
    o.start(t); o.stop(t + attack + dur + 0.1);
  }

  // ---------- one-shot kit (Mongolian steppe) ----------
  const KIT = {
    fireCrackle(k, far) { const n = 2 + (Math.random() * 3) | 0; for (let i = 0; i < n; i++) noiseBurst({ f0: 3200, f1: 1800, q: 1.2, dur: 0.012 + Math.random() * 0.02, peak: 0.35 * k * rand(0.4, 1), type: 'highpass', attack: 0.002, at: i * rand(0.03, 0.12), far }); },
    horseSnort(k, far) { const pan = rand(-0.6, 0.6); noiseBurst({ kind: 'pink', f0: 380, f1: 900, q: 1.1, dur: 0.28, peak: 0.5 * k, attack: 0.03, far, pan }); noiseBurst({ kind: 'pink', f0: 900, f1: 300, q: 1.4, dur: 0.22, peak: 0.35 * k, attack: 0.01, at: 0.12, far, pan }); },
    horseNeigh(k, far) {
      const pan = rand(-0.7, 0.7), base = rand(820, 980);
      tone({ type: 'sawtooth', f0: base, f1: base * 0.55, dur: 0.9, peak: 0.08 * k, attack: 0.08, vib: 0.045, vibHz: 7.5, far, pan });
      tone({ type: 'triangle', f0: base * 2, f1: base * 1.1, dur: 0.8, peak: 0.03 * k, attack: 0.08, vib: 0.045, vibHz: 7.5, far, pan });
      noiseBurst({ kind: 'pink', f0: 1400, f1: 700, q: 2.5, dur: 0.9, peak: 0.12 * k, attack: 0.1, far, pan });
    },
    feltFlap(k, far) { noiseBurst({ kind: 'brown', f0: 420, f1: 140, q: 0.6, dur: 0.18, peak: 0.6 * k, type: 'lowpass', attack: 0.015, far }); tone({ f0: 72, f1: 50, dur: 0.1, peak: 0.08 * k, attack: 0.005, far }); },
    eagleCry(k, far) {
      const pan = rand(-0.8, 0.8), n = 1 + (Math.random() * 2) | 0;
      for (let i = 0; i < n; i++) {
        const f = rand(2200, 2600), at = i * rand(0.45, 0.7);
        tone({ f0: f, f1: f * 0.62, dur: 0.42, peak: 0.055 * k, attack: 0.04, vib: 0.02, vibHz: 9, at, far, pan });
        tone({ type: 'triangle', f0: f * 1.01, f1: f * 0.6, dur: 0.4, peak: 0.02 * k, attack: 0.04, at, far, pan });
      }
    },
    windGust(k) { noiseBurst({ kind: 'pink', f0: 380, f1: 1500, q: 0.5, dur: 1.6, peak: 0.18 * k, attack: 1.2, out: busAmb }); noiseBurst({ kind: 'pink', f0: 1500, f1: 300, q: 0.5, dur: 1.8, peak: 0.16 * k, attack: 0.2, at: 2.6, out: busAmb }); },
    hoofRhythm(k, far) { const n = 6 + (Math.random() * 5) | 0, pan = rand(-0.6, 0.6); for (let i = 0; i < n; i++) { const at = i * 0.15 + (i % 2) * 0.03, a = k * (1 - i / n) * 0.7; noiseBurst({ kind: 'brown', f0: 260, f1: 90, q: 0.7, dur: 0.09, peak: 0.6 * a, type: 'lowpass', attack: 0.004, at, far, pan }); tone({ f0: 68, f1: 42, dur: 0.1, peak: 0.1 * a, attack: 0.004, at, far, pan }); } },
    drumFar(k, far) { for (const at of [0, 0.55, 0.82, 1.35]) { tone({ f0: 95, f1: 46, dur: 0.42, peak: 0.16 * k, attack: 0.006, at, far }); noiseBurst({ kind: 'brown', f0: 320, f1: 120, q: 0.6, dur: 0.14, peak: 0.3 * k, type: 'lowpass', attack: 0.004, at, far }); } },
    rockfall(k, far) { for (let i = 0; i < 5; i++) noiseBurst({ kind: 'brown', f0: 900, f1: 220, q: 1.5, dur: 0.08, peak: 0.4 * k * rand(0.3, 1), type: 'bandpass', attack: 0.003, at: i * rand(0.05, 0.2), far }); },
  };

  // ---------- beds ----------
  function startBeds(def) {
    for (const b of def.beds) {
      const src = ctx.createBufferSource(); src.buffer = noises[b.noise]; src.loop = true;
      let node = src;
      const filters = b.filters.map((fd) => { const f = ctx.createBiquadFilter(); f.type = fd.type; f.frequency.value = fd.f; f.Q.value = fd.Q ?? 0.7; node.connect(f); node = f; return f; });
      const g = ctx.createGain(); g.gain.value = 0;
      node.connect(g).connect(busAmb);
      g.connect(reverb);
      src.start(ctx.currentTime, Math.random() * 2);
      g.gain.linearRampToValueAtTime(db(b.level) * windK, ctx.currentTime + 2.5);
      beds.push({ def: b, src, g, filters, next: 0, targetDb: b.level, targetF: b.filters[0].f });
    }
  }
  function stopBeds(fade = 1.5) {
    const t = ctx.currentTime;
    for (const b of beds) { b.g.gain.cancelScheduledValues(t); b.g.gain.setValueAtTime(b.g.gain.value, t); b.g.gain.linearRampToValueAtTime(0, t + fade); b.src.stop(t + fade + 0.1); }
    beds = [];
  }

  // ---------- music: морин хуур-ish bowed voice over a drone ----------
  function startDrone(def) {
    const m = opts.music === false ? null : def.music; if (!m) return;
    const t = ctx.currentTime, nodes = [];
    for (const [hz, lvl] of m.drone) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(db(lvl) * db(m.level) * 3, t + 6);
      lp.connect(g).connect(busMusic); g.connect(reverb);
      for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det; o.connect(lp); o.start(t); nodes.push(o); }
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = hz; const sg = ctx.createGain(); sg.gain.value = 0.8; sub.connect(sg).connect(g); sub.start(t); nodes.push(sub);
      nodes.push(g);
    }
    music = { def: m, nodes, next: t + m.first };
  }
  function stopDrone(fade = 2) {
    if (!music) return;
    const t = ctx.currentTime;
    for (const n of music.nodes) { if (n.gain) { n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(0, t + fade); } else n.stop?.(t + fade + 0.1); }
    music = null;
  }
  /** One bowed phrase: 2–5 notes with portamento, the last one often a long slide down (уртын дуу). */
  function khuurPhrase(m, t0) {
    const n = Math.round(rand(m.notes[0], m.notes[1]));
    const lvl = db(m.level);
    let t = t0, prev = m.scale[(Math.random() * m.scale.length) | 0];
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = 0; vib.connect(vg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 640; bp.Q.value = 1.1; // body formant
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    const pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.3, 0.3);
    o.connect(bp).connect(lp).connect(g).connect(pan).connect(busMusic); g.connect(reverb);
    o.frequency.setValueAtTime(prev, t);
    for (let i = 0; i < n; i++) {
      const note = m.scale[(Math.random() * m.scale.length) | 0];
      const dur = rand(1.1, 2.4) * (i === n - 1 ? 1.6 : 1);
      // bowed swell per note, never struck
      g.gain.linearRampToValueAtTime(lvl * 0.9, t + 0.35);
      g.gain.setValueAtTime(lvl * 0.9, t + dur * 0.7);
      g.gain.linearRampToValueAtTime(lvl * 0.5, t + dur);
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(note * 0.006, t + dur * 0.5);
      o.frequency.setValueAtTime(prev, t);
      o.frequency.exponentialRampToValueAtTime(note, t + (i === n - 1 ? Math.min(0.8, dur * 0.5) : 0.14));
      prev = note; t += dur;
    }
    g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    o.start(t0); vib.start(t0); o.stop(t + 0.8); vib.stop(t + 0.8);
    return t - t0;
  }

  // ---------- scheduler ----------
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const e of events) {
      if (now + 0.5 < e.next) continue;
      const k = db(e.level ?? 0);
      KIT[e.play]?.(k, !!e.far);
      e.next = now + rand(e.every[0], e.every[1]);
    }
    if (music && now + 0.5 >= music.next) {
      const len = khuurPhrase(music.def, now + 0.1);
      music.next = now + len + rand(music.def.every[0], music.def.every[1]);
    }
    for (const b of beds) { // slow wander of level and filter (Sumiro `range` / `sweep`)
      if (now < b.next) continue;
      b.next = now + rand(2, 5) * b.def.lag;
      const lvl = db(b.def.level + rand(-b.def.range, b.def.range) * 0.5) * windK;
      b.g.gain.cancelScheduledValues(now); b.g.gain.setValueAtTime(b.g.gain.value, now); b.g.gain.linearRampToValueAtTime(lvl, now + rand(2, 5) * b.def.lag);
      if (b.def.sweep) { const f = b.filters[0].frequency; f.cancelScheduledValues(now); f.setValueAtTime(f.value, now); f.linearRampToValueAtTime(rand(b.def.sweep[0], b.def.sweep[1]), now + rand(3, 7) * b.def.lag); }
    }
  }

  function applyChapter(id) {
    const def = SCAPES[id] ?? SCAPES.camp;
    stopBeds(); stopDrone();
    reverb.buffer = makeImpulse(ctx, def.space.seconds, def.space.decay);
    revGain.gain.value = def.space.send;
    startBeds(def);
    events = def.events.map((e) => ({ ...e, next: ctx.currentTime + e.first }));
    startDrone(def);
  }

  const api = {
    get ready() { return !!ctx; },
    /** Browsers need a gesture: call once; the first pointerdown/keydown/touchend starts the context. */
    attachUnlock() {
      const once = () => { api.unlock(); for (const ev of EVS) removeEventListener(ev, once); };
      const EVS = ['pointerdown', 'keydown', 'touchend'];
      for (const ev of EVS) addEventListener(ev, once);
    },
    unlock() { init(); if (!muted) ctx.resume(); },
    setChapter(id) { chapter = id; if (ctx) applyChapter(id); },
    /** Footstep on a surface: 'grass' | 'rock' | 'snow' | 'wood'. */
    step(surface = 'grass', heavy = 1) {
      if (!ctx) return;
      const k = 0.5 + 0.5 * heavy;
      if (surface === 'rock') { noiseBurst({ f0: 1600, f1: 500, q: 0.9, dur: 0.05, peak: 0.12 * k, attack: 0.002 }); tone({ f0: 180, f1: 90, dur: 0.05, peak: 0.03 * k, attack: 0.002 }); }
      else if (surface === 'snow') noiseBurst({ kind: 'pink', f0: 900, f1: 300, q: 0.6, dur: 0.12, peak: 0.1 * k, type: 'lowpass', attack: 0.01 });
      else if (surface === 'wood') { noiseBurst({ kind: 'brown', f0: 500, f1: 200, q: 0.8, dur: 0.07, peak: 0.2 * k, type: 'lowpass', attack: 0.003 }); tone({ f0: 140, f1: 90, dur: 0.08, peak: 0.05 * k, attack: 0.003 }); }
      else noiseBurst({ kind: 'pink', f0: 700, f1: 250, q: 0.8, dur: 0.07, peak: 0.1 * k, type: 'lowpass', attack: 0.004 });
    },
    /** Trigger a kit sound by name now (e.g. audio.cue('horseNeigh')). */
    cue(name, level = 0, far = false) { if (ctx) KIT[name]?.(db(level), far); },
    /** Lower everything but effects (dialogue): duck(0.35, 0.6); restore: duck(1, 1.2). */
    duck(amount = 0.4, seconds = 0.6) {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const b of [busAmb, busMusic]) { b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(amount, t + seconds); }
    },
    setWind(k) { windK = k; },
    toggleMute() {
      muted = !muted;
      if (ctx) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(muted ? 0 : volume, t + 0.6); if (!muted) ctx.resume(); }
      return muted;
    },
    dispose() { if (!ctx) return; clearInterval(timer); stopBeds(0.1); stopDrone(0.1); ctx.close(); ctx = null; },
  };
  return api;
}
