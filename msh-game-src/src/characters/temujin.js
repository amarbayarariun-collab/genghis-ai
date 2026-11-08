// Тэмүжин (player) on the shared Mixamo body (see mixamoBody.js).
//
// Interface used by the scenes / main.js:
//   createTemujin() -> THREE.Group   (feet at y=0, facing +Z)
//   group.userData.setMoving(bool) / setSpeed(m/s) / setMode('walk'|'air'|'ride')
//   group.userData.update(dt, t)   called every frame by the scene
//   group.userData.seatOffset  pelvis height in the ride pose (group.position.y = saddleTopY - seatOffset)
//   group.userData.hand        right-hand bone once loaded (rein anchor), else null
//
// Look: matches the user's turnaround sheet. Flat colours only, no textures.

import * as THREE from 'three';
import { buildHumanoid } from './humanoid.js';
import { mountMixamoBody, makeRig, blendPoses, ZERO_POSE } from './mixamoBody.js';
import * as C from './mixamoCostume.js';

const HEIGHT = 1.72;
const PAL = {
  deel: '#9a2a24', deelShade: '#8a2420', hem: '#d6a35e', cuff: '#d6a35e',
  pants: '#3b2418', boot: '#5c3a22', bootTop: '#c9955a', sole: '#2e1d12',
  skin: '#c98a5a', skinShade: '#b47548', hair: '#1a120d', eye: '#120c08', brow: '#1a120d', lip: '#8e4f38',
  fur: '#d9bf8f', fur2: '#c4a676', crown: '#a8262c', crownDark: '#7d1d20', knob: '#b8834a', ribbon: '#b0242a',
  belt: '#5a3820', beltEdge: '#3e2614', buckle: '#b8834a', buckleDark: '#7a5226', tassel: '#e2cfa6',
};

export function createTemujin() {
  const group = new THREE.Group();
  // stand-in until the body has been parsed (a fraction of a second)
  const h = buildHumanoid({
    height: HEIGHT, build: 'male', robeLength: 0.62, hat: 'furHat', furMantle: true, braids: true,
    colors: {
      deel: '#9e2f26', trim: '#d6a46c', inner: '#7d241e', belt: '#5c3a22', buckle: '#b8834a',
      pants: '#4a2a1c', boot: '#7a4a2c', skin: '#d9935f', hair: '#2a1a14', fur: '#d9b48a',
      hat: '#9e2f26', ribbon: '#a8262c', eye: '#1c120c', brow: '#2a1a14', lip: '#a8664a',
    },
  });
  group.add(h.root);
  let phase = 0;
  // Scene-facing state (set by main.js each frame; scenes just call update(dt, t))
  let speed = 0;
  let moving = false;
  let mode = 'walk';
  let animate = (t, dt, sp, md) => {
    const amount = md === 'walk' ? THREE.MathUtils.clamp(sp / 3.5, 0, 1) : 0;
    phase += dt * (2 + sp * 2.4);
    h.pose(t, phase, amount);
  };
  group.userData.seatOffset = 0.83;
  group.userData.hand = null;
  group.userData.ready = false;
  group.userData.setMoving = (v) => { moving = !!v; };
  group.userData.setSpeed = (s) => { speed = Math.max(0, s || 0); };
  group.userData.setMode = (m) => { mode = m || 'walk'; };
  /** Scenes call update(dt, t); main.js drives speed/mode through the setters. */
  group.userData.update = (dt, t) => {
    const sp = mode === 'walk' ? (moving ? Math.max(speed, 1.2) : speed) : speed;
    animate(t, dt, sp, mode);
  };

  mountMixamoBody(group, {
    height: HEIGHT,
    placeholder: h.root,
    onReady: (ctx) => {
      const { m, k } = ctx;
      const ms = C.measure(ctx, { hemAt: 'knee' });
      paintTemujin(ctx, ms);
      C.sleeves(ctx, ms, PAL);
      C.boots(ctx, ms, PAL);
      const skirt = C.skirt(ctx, ms, PAL, { flare: 1.0 });
      C.belt(ctx, ms, PAL);
      C.lapel(ctx, ms, PAL);
      C.furCollar(ctx, ms, PAL);
      C.frontBraids(ctx, ms, PAL, { length: 'chest' });
      C.hair(ctx, ms, PAL, 'jagged');
      C.face(ctx, ms, PAL, 'stern');
      const { ribbon } = C.furHat(ctx, ms, PAL);
      const rig = makeRig(ctx);
      rig.free('skirtL', skirt[0]);
      rig.free('skirtR', skirt[1]);
      group.userData.seatOffset = m.hipL.y - 0.085 * k;
      group.userData.hand = ctx.bone('RightHand');
      group.userData.ready = true;
      animate = makeAnimator(rig, ribbon);
      animate(0, 0, 0, 'walk');
    },
  });
  return group;
}

function paintTemujin(ctx, ms) {
  const { m, H, k } = ctx;
  const col = Object.fromEntries(Object.entries(PAL).map(([n, c]) => [n, new THREE.Color(c)]));
  const handX = Math.abs(m.wrL.x) - 0.01 * k;
  const chinY = m.neck.y + (m.head.y - m.neck.y) * 0.35;
  const hairY = m.head.y + H * 0.62;
  const bootY = m.anL.y + (m.knL.y - m.anL.y) * 0.55;
  ctx.paint((x, y, z, out) => {
    const ax = Math.abs(x);
    let c;
    if (ax > handX) c = col.skin; // hands
    else if (ax > ms.sw * 0.92 && y > m.hips.y) c = col.deel; // sleeves
    else if (y > hairY) c = col.hair;
    else if (y > chinY) c = col.skin; // face
    else if (y > m.neck.y - 0.03 * k && ax < 0.055 * k && z > m.neck.z) c = col.skin; // throat
    else if (y > ms.hemY) c = (ax < 0.02 * k ? col.deelShade : col.deel);
    else if (y > bootY) c = col.pants;
    else c = col.boot;
    out.copy(c);
  });
}

// ---- poses ----
function makeAnimator(rig, ribbon) {
  let ph = 0;
  const w = { walk: 1, air: 0, ride: 0 };
  let lastMode = 'walk';
  return (t, dt, speed = 0, mode = 'walk') => {
    lastMode = mode;
    const kk = 1 - Math.exp(-dt * 12);
    for (const n in w) w[n] += ((n === mode ? 1 : 0) - w[n]) * kk;
    const tot = w.walk + w.air + w.ride || 1;
    const breathe = Math.sin(t * 1.8);

    // --- walk / run (ground) ---
    const amt = THREE.MathUtils.clamp(speed / 3.4, 0, 1);
    const run = THREE.MathUtils.clamp((speed - 3.8) / 1.8, 0, 1);
    if (mode !== 'air') ph += dt * (speed > 0.05 ? 3.0 + speed * 1.55 : 0);
    const s = Math.sin(ph), c = Math.cos(ph);
    const legA = 0.5 + 0.3 * run, kneeA = 0.85 + 0.55 * run, armA = 0.42 + 0.3 * run;
    const walk = {
      lfwd: s * legA * amt, rfwd: -s * legA * amt,
      lknee: (Math.max(0, c) * kneeA + 0.06) * amt + 0.03, rknee: (Math.max(0, -c) * kneeA + 0.06) * amt + 0.03,
      lfoot: -s * 0.18 * amt, rfoot: s * 0.18 * amt,
      ladown: 1.3 - 0.05 * run, radown: 1.3 - 0.05 * run,
      lafwd: -s * armA * amt + 0.06, rafwd: s * armA * amt + 0.06,
      labend: 0.22 + 0.25 * amt + 0.9 * run, rabend: 0.22 + 0.25 * amt + 0.9 * run,
      twist: s * (0.07 + 0.06 * run) * amt, lean: 0.04 * amt + 0.14 * run,
      chest: breathe * 0.02 * (1 - amt), neckYaw: -s * 0.05 * amt, headPitch: -0.04 * run,
      lift: (Math.abs(c) * (0.025 + 0.03 * run) - 0.012 - 0.025 * run) * amt,
      lsk: 0.35 * s * legA * amt, rsk: -0.35 * s * legA * amt, skOut: 0.02,
    };
    // --- air: jump tuck ---
    const air = {
      lfwd: 0.75, rfwd: 0.45, lknee: 1.25, rknee: 0.9, lfoot: 0.2, rfoot: 0.2,
      ladown: 0.85, radown: 0.85, lafwd: 0.35, rafwd: 0.25, labend: 0.6, rabend: 0.6,
      lean: 0.1, headPitch: -0.08, lift: 0, lsk: 0.35, rsk: 0.25, skOut: 0.12,
    };
    // --- ride: seated, legs around the horse, hands on the reins ---
    const bounce = Math.sin(t * (4 + speed * 1.2)) * Math.min(1, speed / 5);
    const ride = {
      lfwd: 1.35, rfwd: 1.35, lspread: 0.38, rspread: 0.38, lknee: 1.55, rknee: 1.55, lfoot: -0.1, rfoot: -0.1,
      ladown: 1.28, radown: 1.28, lafwd: 0.55, rafwd: 0.55, laIn: 0.15, raIn: 0.15, labend: 1.25, rabend: 1.25,
      lean: 0.12 + 0.06 * Math.min(1, speed / 6), chest: breathe * 0.01, headPitch: -0.1,
      lift: 0.012 * bounce, lsk: 0.85, rsk: 0.85, skOut: 0.35,
    };
    const P = blendPoses([[walk, w.walk / tot], [air, w.air / tot], [ride, w.ride / tot]]);
    rig.apply(P);
    if (ribbon) {
      ribbon.rotation.x = Math.sin(t * 5.5) * 0.06 * (1 + speed * 0.3) - 0.1 * Math.min(1, speed / 4);
      ribbon.rotation.z = Math.sin(t * 3.7 + 1) * 0.08;
    }
    void lastMode; void ZERO_POSE;
  };
}
