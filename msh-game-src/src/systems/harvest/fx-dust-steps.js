/**
 * fx-dust-steps.js — Тоосон мөр (footstep dust puffs for the steppe)
 *
 * Source / idea:
 *   - Sumiro bundle `fx_ink_step-*.js` (xikhar.github.io, NO license file → technique only, no code copied):
 *     a stroke is laid behind the feet while the player moves, oriented across the walk direction AND across the
 *     line of sight so it is never seen edge-on, and it fades by age. We swap the ink stroke for warm dust motes.
 *   - Walden `game/src/player.js` footsteps() (NO license → idea only): fire a step when a foot comes down after
 *     being lifted (hysteresis). `createFootTrigger` reproduces that for a rigged GLB; `createStrideTrigger` is
 *     the no-rig fallback (one puff every stride length, alternating left/right).
 * License of this file: MIT (MSH project). Upstream repos consulted have no license → ideas only.
 *
 * What it does: pooled point-sprite emitter (one draw call). `step(pos, dir)` spawns 6–10 golden-dust motes that
 * rise, drift downwind and fade. World-space sprite sizes (metres), tone-mapped + sRGB-correct output.
 *
 * Wire into demo-slice/src/main.js:
 *   import { createDustSteps, createStrideTrigger } from './systems/fx-dust-steps.js';
 *   const dust = createDustSteps(scene);                                   // once, after `scene`
 *   const stride = createStrideTrigger({ strideLen: 0.72 });              // once
 *   // tick(): after player.pos / groundY are updated
 *   stride.update(player.pos, moving && state === 'explore', (p, dir) => dust.step(p, dir));
 *   dust.update(dt, camera, renderer);
 *   // loadScene(): dust.reset(); (scene is cleared → re-add) scene.add(dust.points);
 */
import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vA;
  varying vec3 vC;
  uniform float uScale;
  void main() {
    vA = aAlpha; vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d) * 4.0;
    if (r > 1.0) discard;
    float a = (1.0 - r) * (1.0 - r) * vA;
    gl_FragColor = vec4(vC, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const DUST_COLORS = ['#c9a46a', '#e0bd82', '#efd6a3'].map((c) => new THREE.Color(c));

/**
 * @param {THREE.Scene} scene
 * @param {{ max?: number, wind?: THREE.Vector3, colors?: THREE.Color[] }} [opts]
 */
export function createDustSteps(scene, opts = {}) {
  const max = opts.max ?? 320;
  const wind = opts.wind ?? new THREE.Vector3(0.35, 0, -0.15);
  const colors = opts.colors ?? DUST_COLORS;

  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max); // remaining seconds; <= 0 → free slot
  const maxLife = new Float32Array(max);
  const size0 = new Float32Array(max);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'fx_dust_steps';
  points.frustumCulled = false;
  points.renderOrder = 8;
  scene.add(points);

  let cursor = 0;
  function spawn(x, y, z, vx, vy, vz, s, l) {
    // Round-robin: oldest slot is overwritten when the pool is full.
    let i = cursor;
    for (let k = 0; k < max; k++) {
      const j = (cursor + k) % max;
      if (life[j] <= 0) { i = j; break; }
    }
    cursor = (i + 1) % max;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    const c = colors[(Math.random() * colors.length) | 0];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    size0[i] = s; size[i] = s;
    life[i] = l; maxLife[i] = l;
    alpha[i] = 0;
  }

  const across = new THREE.Vector3();
  /**
   * One footfall. `dir` = horizontal walk direction (unit, optional).
   * @param {THREE.Vector3} p foot / feet position (ground level)
   * @param {THREE.Vector3} [dir]
   * @param {number} [strength] 1 = jog, 0.4 = walk, 1.6 = land
   */
  function step(p, dir, strength = 1) {
    const n = 5 + Math.round(4 * strength);
    const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0;
    across.set(-dz, 0, dx);
    for (let k = 0; k < n; k++) {
      const side = (Math.random() - 0.5) * 0.5;
      const back = -0.12 - Math.random() * 0.25; // kicked backwards from the heel
      spawn(
        p.x + across.x * side + dx * back,
        p.y + 0.03 + Math.random() * 0.08,
        p.z + across.z * side + dz * back,
        across.x * side * 1.4 + dx * back * 1.8 + (Math.random() - 0.5) * 0.3,
        0.35 + Math.random() * 0.55 * strength,
        across.z * side * 1.4 + dz * back * 1.8 + (Math.random() - 0.5) * 0.3,
        0.10 + Math.random() * 0.14 * strength,
        0.55 + Math.random() * 0.45,
      );
    }
  }

  function update(dt, camera, renderer) {
    // world-metre → pixel scale for gl_PointSize
    const h = renderer ? renderer.domElement.height : 1080;
    mat.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5));
    const drag = Math.exp(-2.6 * dt);
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const u = 1 - Math.max(life[i], 0) / maxLife[i]; // 0 → 1 age
      vel[i * 3] = vel[i * 3] * drag + wind.x * dt;
      vel[i * 3 + 1] = vel[i * 3 + 1] * drag + 0.12 * dt;
      vel[i * 3 + 2] = vel[i * 3 + 2] * drag + wind.z * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] = size0[i] * (1 + 2.2 * u);
      // Quick in, slow out — a puff, not a flash
      alpha[i] = Math.min(1, u * 8) * (1 - u) * (1 - u) * 0.75;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
  }

  function reset() {
    life.fill(0); alpha.fill(0);
    if (!points.parent) scene.add(points);
  }

  function dispose() {
    points.parent?.remove(points);
    geo.dispose(); mat.dispose();
  }

  return { points, step, update, reset, dispose };
}

/**
 * No-rig stride trigger: fires every `strideLen` metres of travel, alternating feet.
 * @param {{ strideLen?: number, footSpread?: number }} [opts]
 */
export function createStrideTrigger(opts = {}) {
  const strideLen = opts.strideLen ?? 0.72;
  const spread = opts.footSpread ?? 0.11;
  const last = new THREE.Vector3(NaN, NaN, NaN);
  const dir = new THREE.Vector3(0, 0, -1);
  const foot = new THREE.Vector3();
  let acc = 0, left = false;

  /** @param {(p: THREE.Vector3, dir: THREE.Vector3, strength: number) => void} onStep */
  function update(p, moving, onStep) {
    if (!Number.isFinite(last.x)) { last.copy(p); return; }
    const dx = p.x - last.x, dz = p.z - last.z;
    const d = Math.hypot(dx, dz);
    last.copy(p);
    if (!moving || d < 1e-4) { acc = Math.min(acc, strideLen * 0.6); return; }
    dir.set(dx / d, 0, dz / d);
    acc += d;
    if (acc >= strideLen) {
      acc -= strideLen;
      left = !left;
      const s = left ? -spread : spread;
      foot.set(p.x - dir.z * s, p.y, p.z + dir.x * s);
      onStep(foot, dir, 1);
    }
  }
  function reset() { last.set(NaN, NaN, NaN); acc = 0; }
  return { update, reset };
}

/**
 * Rigged variant (Walden idea): watches two foot bones; a step fires when a foot comes back down after lifting.
 * @param {THREE.Object3D[]} footBones e.g. [skeleton.getBoneByName('LeftFoot'), ...]
 * @param {(x:number,z:number)=>number} groundAt
 */
export function createFootTrigger(footBones, groundAt, { lift = 0.05, plant = 0.02 } = {}) {
  const feet = footBones.filter(Boolean).map((bone) => ({ bone, low: Infinity, lifted: false }));
  const w = new THREE.Vector3();
  function update(dt, onStep, dir) {
    for (const f of feet) {
      f.bone.getWorldPosition(w);
      const y = w.y - groundAt(w.x, w.z);
      f.low = Math.min(f.low + dt * 0.05, y); // contact height relaxes slowly (slopes / clip changes)
      if (y > f.low + lift) f.lifted = true;
      else if (f.lifted && y < f.low + plant) {
        f.lifted = false;
        w.y -= y;
        onStep(w, dir, 1);
      }
    }
  }
  return { update };
}
