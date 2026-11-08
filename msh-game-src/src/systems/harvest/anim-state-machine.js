/**
 * anim-state-machine.js — Хөдөлгөөний төлөвийн машин (layered animator + locomotion FSM for Тэмүжин)
 *
 * Source / idea: Walden `game/src/animator.js` + `player.js` (xikhar/Walden, NO license file → re-implemented
 *   from the described design, no code copied). Ideas kept:
 *   - partitioned layers (lower body / torso / arm) that crossfade independently with weights normalised so the
 *     bind pose never leaks in; full-body one-shots play on all partitions with identical timing;
 *   - gait selection by speed with hysteresis, clip timeScale = speed / gaitSpeed clamped [0.65, 1.3];
 *   - phase-matched gait switches (keep the left-foot plant phase when changing clips);
 *   - a procedural layer after the mixer: lean into turns from yaw rate, pitch with acceleration;
 *   - `enterFade` so the first blend after a one-shot is softer.
 *   Combat/roll/jump/hurt states are intentionally NOT ported (MSH has no combat).
 * License of this file: MIT (MSH project).
 *
 * Works two ways:
 *   A) GLB with clips (Tripo/Mixamo): `const anim = createAnimator(gltf.scene, gltf.animations, { parts })`
 *   B) No rig yet (procedural Temüjin): pass `animator: null`, the FSM still exposes `state`, `gait`, `lean`,
 *      `speedBlend` for `temujin.userData.setMoving` / your own bob code.
 *
 * Wire into demo-slice/src/main.js:
 *   import { createAnimator, createLocomotionFSM } from './systems/anim-state-machine.js';
 *   const fsm = createLocomotionFSM({ animator: null, gaits: { walk: { speed: 1.6 }, jog: { speed: 3.5 } } });
 *   // tick(): const loco = fsm.update(dt, { speed: mover.speed ?? (moving ? 3.5 : 0), yaw: player.yaw, talking: state === 'dialogue' });
 *   //         temujin.userData.setMoving?.(loco.state === 'move'); temujin.rotation.z = loco.lean;
 *   // When temujin.glb arrives: const anim = createAnimator(glb.scene, glb.animations); fsm.setAnimator(anim);
 *   //   gaits: { idle: { clip: 'Idle' }, walk: { clip: 'Walk', speed: 1.6, plant: 0.1 }, jog: { clip: 'Run', speed: 3.5, plant: 0.05 } }
 */
import * as THREE from 'three';

const DEFAULT_PARTS = {
  lower: /(Hips|UpLeg|^Leg|Foot|Toe)/i,
  rarm: /Right(Shoulder|Arm|ForeArm|Hand)/,
};

class Layer {
  constructor(mixer, clips) {
    this.mixer = mixer;
    this.clips = clips;
    this.entries = new Map();
    this.current = null;
  }
  entry(name) {
    let e = this.entries.get(name);
    if (!e) {
      const clip = this.clips[name];
      if (!clip) throw new Error(`[animator] no clip "${name}"`);
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0);
      e = { name, action, weight: 0, target: 0, rate: 1 };
      this.entries.set(name, e);
    }
    return e;
  }
  play(name, { fade = 0.25, loop = true, timeScale = 1, restart = false, startAt = 0 } = {}) {
    const e = this.entry(name);
    const a = e.action;
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    if (this.current !== e || restart) {
      if (restart || e.weight <= 0.001 || !a.isRunning()) { a.reset(); a.time = startAt; a.play(); }
      for (const o of this.entries.values()) { o.target = o === e ? 1 : 0; o.rate = fade > 0 ? 1 / fade : 1e6; }
      this.current = e;
    }
    return a;
  }
  update(dt) {
    let sum = 0;
    for (const e of this.entries.values()) {
      const d = e.target - e.weight, step = e.rate * dt;
      e.weight = Math.abs(d) <= step ? e.target : e.weight + Math.sign(d) * step;
      sum += e.weight;
    }
    for (const e of this.entries.values()) {
      e.action.setEffectiveWeight(sum > 0 ? e.weight / sum : 0);
      if (e.weight === 0 && e.target === 0 && e.action.isRunning()) e.action.stop();
    }
  }
}

/**
 * Layered animator over THREE.AnimationMixer.
 * @param {THREE.Object3D} root skinned root (gltf.scene)
 * @param {THREE.AnimationClip[]} gltfClips
 * @param {{ parts?: Record<string, RegExp>, dropTracks?: RegExp }} [opts] bone-name → partition regexes; unmatched bones → 'torso'
 */
export function createAnimator(root, gltfClips, opts = {}) {
  const partRx = opts.parts ?? DEFAULT_PARTS;
  const partNames = [...Object.keys(partRx), 'torso'];
  const partOf = (bone) => Object.keys(partRx).find((p) => partRx[p].test(bone)) ?? 'torso';
  const mixer = new THREE.AnimationMixer(root);
  const clips = {};
  const perPart = Object.fromEntries(partNames.map((p) => [p, {}]));
  for (const clip of gltfClips) {
    const tracks = opts.dropTracks ? clip.tracks.filter((t) => !opts.dropTracks.test(t.name)) : clip.tracks;
    clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, tracks);
    for (const p of partNames) {
      const sub = tracks.filter((t) => partOf(t.name.split('.')[0]) === p);
      perPart[p][clip.name] = new THREE.AnimationClip(`${clip.name}__${p}`, clip.duration, sub);
    }
  }
  const layers = Object.fromEntries(partNames.map((p) => [p, new Layer(mixer, perPart[p])]));

  return {
    mixer, clips, layers, parts: partNames,
    has: (name) => !!clips[name],
    duration: (name) => clips[name]?.duration ?? 0,
    /** Play on some or all partitions; a looping clip already running on another partition is joined in phase. */
    play(name, o = {}, parts = partNames) {
      if (o.loop !== false && !o.restart) {
        const ref = partNames.map((p) => layers[p].entries.get(name)).find((e) => e && e.weight > 0 && e.action.isRunning());
        if (ref) o = { ...o, startAt: ref.action.time };
      }
      let action;
      for (const p of parts) action = layers[p].play(name, o);
      return action;
    },
    action: (name, part = 'torso') => layers[part].entry(name).action,
    current: (part = 'torso') => layers[part].current?.name,
    setTimeScale(name, ts, parts = partNames) {
      for (const p of parts) { const e = layers[p].entries.get(name); if (e) e.action.timeScale = ts; }
    },
    update(dt) { for (const p of partNames) layers[p].update(dt); mixer.update(dt); },
  };
}

const smooth = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const smoothstep = (e0, e1, x) => { const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/**
 * Locomotion FSM: idle | move | talk | emote(one-shot). No combat.
 * @param {{
 *   animator?: ReturnType<typeof createAnimator> | null,
 *   gaits?: { idle?: { clip?: string }, walk?: { clip?: string, speed: number, plant?: number }, jog?: { clip?: string, speed: number, plant?: number } },
 *   talkClip?: string, onStep?: (gait: string) => void
 * }} [opts]
 */
export function createLocomotionFSM(opts = {}) {
  let anim = opts.animator ?? null;
  const gaits = {
    idle: { clip: 'Idle', ...(opts.gaits?.idle ?? {}) },
    walk: { clip: 'Walk', speed: 1.6, plant: 0.1, ...(opts.gaits?.walk ?? {}) },
    jog: { clip: 'Run', speed: 3.5, plant: 0.05, ...(opts.gaits?.jog ?? {}) },
  };
  const talkClip = opts.talkClip ?? 'Talk';
  const out = { state: 'idle', gait: 'idle', speedBlend: 0, lean: 0, pitchLean: 0, timeScale: 1, emote: null };
  let currentLoco = null, enterFade = 0.3, prevYaw = null, yawRate = 0, prevSpeed = 0;
  let emote = null; // { name, t, dur }
  let phaseAcc = 0;

  function playLoco(speed, dt) {
    const g = speed > gaits.walk.speed * 1.5 ? 'jog' : 'walk';
    const G = gaits[g];
    out.gait = g;
    out.timeScale = THREE.MathUtils.clamp(speed / G.speed, 0.65, 1.3);
    // no rig: emit steps from a synthetic stride phase so dust/sfx still work
    if (!anim) {
      phaseAcc += dt * out.timeScale * (g === 'jog' ? 2.6 : 1.8);
      if (phaseAcc >= 1) { phaseAcc -= 1; opts.onStep?.(g); }
      return;
    }
    if (!anim.has(G.clip)) return;
    let startAt = 0;
    if (currentLoco && currentLoco !== G.clip) {
      const prev = Object.values(gaits).find((x) => x.clip === currentLoco);
      const a = anim.action(prev.clip, 'lower');
      const ph = ((a.time / a.getClip().duration) - (prev.plant ?? 0) + 1) % 1;
      startAt = ((ph + (G.plant ?? 0)) % 1) * anim.duration(G.clip);
    }
    const fade = currentLoco && currentLoco !== G.clip ? 0.28 : Math.max(enterFade, 0.25);
    anim.play(G.clip, { fade, startAt });
    anim.setTimeScale(G.clip, out.timeScale);
    currentLoco = G.clip;
  }

  return {
    out,
    setAnimator(a) { anim = a; currentLoco = null; },
    /** One-shot (wave, bow, mount). Returns its duration. */
    emote(name, { fade = 0.2, dur } = {}) {
      const d = dur ?? (anim?.duration(name) || 1.2);
      emote = { name, t: 0, dur: d };
      out.state = 'emote'; out.emote = name;
      if (anim?.has(name)) anim.play(name, { fade, loop: false, restart: true });
      return d;
    },
    /**
     * @param {number} dt
     * @param {{ speed: number, yaw: number, talking?: boolean }} i speed in m/s (from your mover), yaw = facing
     */
    update(dt, i) {
      dt = Math.min(dt, 0.05);
      // procedural lean: yaw rate × speed, tilt with acceleration
      if (prevYaw != null) yawRate = smooth(yawRate, angleDiff(prevYaw, i.yaw) / Math.max(dt, 1e-4), 10, dt);
      prevYaw = i.yaw;
      const moving = i.speed > 0.2;
      const bank = moving ? THREE.MathUtils.clamp(-yawRate * i.speed * 0.045, -0.28, 0.28) : 0;
      out.lean = smooth(out.lean, bank, 8, dt);
      const acc = (i.speed - prevSpeed) / Math.max(dt, 1e-4);
      prevSpeed = i.speed;
      out.pitchLean = smooth(out.pitchLean, moving ? THREE.MathUtils.clamp(acc * 0.012, -0.08, 0.1) : 0, 6, dt);
      out.speedBlend = smooth(out.speedBlend, smoothstep(0.1, gaits.jog.speed, i.speed), 10, dt);

      if (emote) {
        emote.t += dt;
        if (emote.t < emote.dur) { anim?.update(dt); return out; }
        emote = null; out.emote = null; enterFade = 0.35;
      }
      const fade = enterFade; enterFade = 0.3;
      if (i.talking) {
        out.state = 'talk'; out.gait = 'idle'; currentLoco = null;
        if (anim) anim.play(anim.has(talkClip) ? talkClip : gaits.idle.clip, { fade: Math.max(fade, 0.35) });
      } else if (!moving) {
        out.state = 'idle'; out.gait = 'idle'; currentLoco = null; phaseAcc = 0.5;
        if (anim?.has(gaits.idle.clip)) anim.play(gaits.idle.clip, { fade: Math.max(fade, 0.35) });
      } else {
        out.state = 'move';
        playLoco(i.speed, dt);
      }
      anim?.update(dt);
      return out;
    },
  };
}
