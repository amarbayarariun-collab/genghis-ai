/**
 * fx-birds.js — Бүргэд, сар (soaring eagles / kites over the steppe)
 *
 * Source / idea: Sumiro bundle `fx_crows-*.js` (xikhar.github.io, NO license → technique only; its flights are
 *   hand-keyed to a camera rail and ink-rendered, none of that is reused). Kept as ideas: a bird is a root + wing
 *   segments driven by cosine flap curves with phase lag between inner and outer segments; a glide window
 *   (`glideAt`, `glideLen`) blends the flap amplitude out to a soft dihedral; birds sit on perches and launch when
 *   the player comes close (the "burst"); the body banks into turns; a per-bird random phase/rate so the flock never
 *   syncs. Also sisyphus `parallax.js` birds (NO license → idea: a handful of tiny far birds is plenty).
 * License of this file: MIT (MSH project). Geometry is procedural (no crow.glb).
 *
 * What it does: N low-poly eagles circle thermals (soaring cycle: climb → long glide), flap in bursts, bank into the
 * turn, and optional perched birds launch when the player gets near. One Group, ~6 meshes per bird, Lambert dark.
 *
 * Wire into demo-slice/src/main.js:
 *   import { createBirds } from './systems/fx-birds.js';
 *   const birds = createBirds(scene, { count: 5, center: [6, 0, -14], radius: 18, height: 22,
 *                                      perches: [[4.2, 5.3, -8.5]] });   // top of the sulde pole
 *   // tick(): birds.update(dt, t, player.pos);   // loadScene(): birds.dispose() and create for the new world
 */
import * as THREE from 'three';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3(), _fwd = new THREE.Vector3(), _tgt = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _zAxis = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qRoll = new THREE.Quaternion();

function makeBird(mat, span) {
  const root = new THREE.Group();
  // body: a slim flattened box, head forward (-Z)
  const body = new THREE.Mesh(new THREE.BoxGeometry(span * 0.08, span * 0.06, span * 0.34), mat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(span * 0.06, span * 0.05, span * 0.1), mat);
  head.position.set(0, span * 0.01, -span * 0.21);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.16, span * 0.14), mat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, span * 0.23);
  root.add(body, head, tail);
  const wings = {};
  for (const side of [1, -1]) {
    // inner segment hinged at the body, outer hinged at the inner tip; "fingers" = tapered plane
    const inner = new THREE.Group();
    inner.position.set(side * span * 0.04, span * 0.02, 0);
    const innerMesh = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.22, span * 0.2), mat);
    innerMesh.rotation.x = -Math.PI / 2;
    innerMesh.position.set(side * span * 0.11, 0, 0);
    inner.add(innerMesh);
    const outer = new THREE.Group();
    outer.position.set(side * span * 0.22, 0, 0);
    const outerMesh = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.24, span * 0.17), mat);
    outerMesh.rotation.x = -Math.PI / 2;
    outerMesh.position.set(side * span * 0.12, 0, span * 0.02);
    outer.add(outerMesh);
    inner.add(outer);
    root.add(inner);
    wings[side] = { inner, outer };
  }
  return { root, wings };
}

/**
 * @param {THREE.Scene} scene
 * @param {{
 *   count?: number, center?: [number, number, number], radius?: number, height?: number, span?: number,
 *   color?: string, perches?: [number, number, number][], startleRadius?: number, speed?: number
 * }} [opts]
 */
export function createBirds(scene, opts = {}) {
  const count = opts.count ?? 5;
  const center = new THREE.Vector3(...(opts.center ?? [0, 0, -15]));
  const R = opts.radius ?? 16;
  const H = opts.height ?? 20;
  const span = opts.span ?? 2.0;
  const speed = opts.speed ?? 7;
  const startleRadius = opts.startleRadius ?? 6;
  const mat = new THREE.MeshLambertMaterial({ color: opts.color ?? '#2b1f16', side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.name = 'fx_birds';
  scene.add(group);

  const perches = (opts.perches ?? []).map((p) => new THREE.Vector3(...p));
  const birds = [];
  for (let i = 0; i < count; i++) {
    const b = makeBird(mat, span * (0.85 + Math.random() * 0.3));
    const perch = perches[i];
    birds.push({
      ...b,
      mode: perch ? 'perched' : 'fly',
      perch,
      launchT: 0,
      theta: Math.random() * Math.PI * 2,
      dir: Math.random() < 0.5 ? 1 : -1,         // clockwise / counter
      r: R * (0.7 + Math.random() * 0.6),
      rDrift: Math.random() * 6.28,
      h: H * (0.8 + Math.random() * 0.5),
      soar: Math.random() * 40,                   // soaring cycle clock
      soarLen: 28 + Math.random() * 18,
      phase: Math.random() * 6.28,
      rate: 2.3 * (0.85 + Math.random() * 0.3),   // flaps per second
      glideAt: 2 + Math.random() * 4,
      glideLen: 4 + Math.random() * 5,
      cycle: Math.random() * 8,
      cycleLen: 8 + Math.random() * 4,
      burst: 0,
    });
    group.add(b.root);
    if (perch) b.root.position.copy(perch);
  }

  const smooth = (e0, e1, x) => { const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function poseWings(b, flapAmp, t) {
    // Sumiro-style cosine flap: inner leads, outer lags by half a radian, plus the glide dihedral.
    const ph = b.phase;
    const inner = (14 + 42 * Math.cos(ph)) * flapAmp + 6 * (1 - flapAmp);
    const outer = (-10 + 26 * Math.cos(ph - 0.5)) * flapAmp - 6 * (1 - flapAmp);
    for (const side of [1, -1]) {
      const w = b.wings[side];
      w.inner.rotation.z = side * inner * DEG;
      w.outer.rotation.z = side * outer * DEG;
    }
    // small body pitch bob with the downstroke
    b.root.rotation.x = -0.05 * Math.sin(ph) * flapAmp;
    void t;
  }

  function foldWings(b) {
    for (const side of [1, -1]) {
      b.wings[side].inner.rotation.z = side * 70 * DEG;
      b.wings[side].outer.rotation.z = -side * 120 * DEG;
    }
  }

  function thermalPoint(b, theta, out) {
    const r = b.r + Math.sin(b.rDrift + theta * 0.5) * 2.5;
    // soaring cycle: slow climb for 40 % of the cycle, long shallow glide down for the rest
    const u = (b.soar % b.soarLen) / b.soarLen;
    const climb = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
    const y = b.h + climb * 6 + Math.sin(theta * 2.0) * 0.8;
    return out.set(center.x + Math.cos(theta) * r, center.y + y, center.z + Math.sin(theta) * r);
  }

  function flyStep(b, dt) {
    b.soar += dt;
    const u = (b.soar % b.soarLen) / b.soarLen;
    const climbing = u < 0.4;
    const burst = b.burst > 0;
    if (burst) b.burst -= dt;
    const v = speed * (burst ? 1.6 : climbing ? 1.0 : 1.15);
    const r = b.r;
    const omega = (v / r) * b.dir;
    b.theta += omega * dt;
    const pos = thermalPoint(b, b.theta, _v);
    const ahead = thermalPoint(b, b.theta + omega * 0.25, _fwd).sub(pos).normalize();
    b.root.position.copy(pos);
    _tgt.copy(pos).add(ahead);
    _m.lookAt(pos, _tgt, _up); // Matrix4.lookAt(eye, target, up): -Z faces the target = model's nose
    _q.setFromRotationMatrix(_m);
    // bank into the turn: roll ∝ v² / (g r), signed by turn direction
    const bank = THREE.MathUtils.clamp((v * v) / (9.81 * r), 0, 0.75) * b.dir;
    _qRoll.setFromAxisAngle(_zAxis, bank);
    b.root.quaternion.copy(_q).multiply(_qRoll);

    // flap bursts while climbing or startled, glide otherwise
    b.cycle += dt;
    if (b.cycle > b.cycleLen) { b.cycle = 0; b.glideAt = 1 + Math.random() * 3; b.glideLen = 4 + Math.random() * 5; b.cycleLen = b.glideAt + b.glideLen + 1.5 + Math.random() * 2; }
    const inGlide = smooth(b.glideAt, b.glideAt + 1, b.cycle) * (1 - smooth(b.glideAt + b.glideLen, b.glideAt + b.glideLen + 1, b.cycle));
    const flapAmp = burst ? 1 : climbing ? 1 - 0.75 * inGlide : 0.1 + 0.2 * (1 - inGlide);
    b.phase += dt * Math.PI * 2 * b.rate * (0.35 + 0.65 * flapAmp);
    poseWings(b, flapAmp);
  }

  function launchStep(b, dt) {
    b.launchT += dt;
    const k = THREE.MathUtils.clamp(b.launchT / 2.2, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    const target = thermalPoint(b, b.theta, _fwd);
    b.root.position.lerpVectors(b.perch, target, e);
    b.root.position.y += Math.sin(k * Math.PI) * 1.5; // hop up first
    b.root.lookAt(target);
    b.root.rotateY(Math.PI); // model faces -Z
    b.phase += dt * Math.PI * 2 * b.rate * 1.3;
    poseWings(b, 1);
    if (k >= 1) { b.mode = 'fly'; b.burst = 2.5; }
  }

  return {
    group,
    birds,
    /** Make every perched bird launch and flying birds flap hard for a few seconds. */
    startle() {
      for (const b of birds) {
        if (b.mode === 'perched') { b.mode = 'launch'; b.launchT = 0; }
        else b.burst = Math.max(b.burst, 3);
      }
    },
    update(dt, t, playerPos) {
      dt = Math.min(dt, 0.05);
      for (const b of birds) {
        if (b.mode === 'perched') {
          foldWings(b);
          b.root.position.copy(b.perch);
          b.root.rotation.set(0, Math.sin(t * 0.3 + b.phase) * 0.6, 0); // looks around
          if (playerPos && playerPos.distanceTo(b.perch) < startleRadius) { b.mode = 'launch'; b.launchT = 0; }
        } else if (b.mode === 'launch') launchStep(b, dt);
        else flyStep(b, dt);
      }
    },
    dispose() {
      group.parent?.remove(group);
      group.traverse((o) => o.geometry?.dispose?.());
      mat.dispose();
    },
  };
}
