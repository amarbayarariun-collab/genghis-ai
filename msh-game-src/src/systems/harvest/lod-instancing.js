/**
 * lod-instancing.js — Олон тоогоор зурах, зайн LOD, салхины найгалт, адаптив чанар
 *
 * Sources / ideas:
 *   - Walden `game/src/world2/vegetation.js` (NO license → idea only): grass in *distance rings*, each ring ONE
 *     instanced draw, far rings cheaper cards, neighbouring rings cross-fade on complementary thresholds; props with
 *     distance LODs. We keep the ring/threshold idea in `createLodRings` (CPU-side visibility with hysteresis) and
 *     `createImpostorCards` (one instanced camera-facing quad for the far field).
 *   - Sumiro bundle `cards-*.js` pine-needle wind (NO license → technique): sway from `instanceMatrix[3].xyz` phase
 *     in `begin_vertex`, scaled by `position.y` so roots stay planted → `addWindSway`.
 *   - Sumiro `budgetMs` per module and cybercity `?q=low|high|ultra` quality tiers (NO license → idea) →
 *     `createAdaptiveQuality` lowers/raises pixel ratio to hold a frame-time target.
 *   - voxel-game-original (MIT) `vegetation.js` palette-jitter per instance → `scatterInstanced` per-instance colour.
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/world.js (grass tufts / herd / far gers):
 *   import { scatterInstanced, addWindSway, createLodRings, createImpostorCards, createAdaptiveQuality } from './systems/lod-instancing.js';
 *   const tufts = scatterInstanced(tuftGeo, tuftMat, items);   addWindSway(tuftMat);   scene.add(tufts.mesh);
 *   const far = createImpostorCards(farItems, { color: '#b8a070' }); scene.add(far.mesh);
 *   const lod = createLodRings([{ object: nearGroup, max: 70 }, { object: far.mesh, min: 60 }]);
 *   // tick(): tufts.setTime(t); lod.update(camera); far.update(camera); quality.frame(dt);
 *   // main.js: const quality = createAdaptiveQuality(renderer, { targetMs: 16.7 });
 */
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _c = new THREE.Color();

/**
 * One InstancedMesh from a list of placements, with optional per-instance colour jitter.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material (set `vertexColors: false`; instance colour is separate)
 * @param {{ x: number, y: number, z: number, ry?: number, s?: number, color?: THREE.ColorRepresentation }[]} items
 * @param {{ castShadow?: boolean, receiveShadow?: boolean, jitter?: number, baseColor?: THREE.ColorRepresentation }} [opts]
 */
export function scatterInstanced(geometry, material, items, opts = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  mesh.castShadow = !!opts.castShadow;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  const jitter = opts.jitter ?? 0;
  const base = opts.baseColor != null ? new THREE.Color(opts.baseColor) : null;
  items.forEach((it, i) => {
    _e.set(0, it.ry ?? 0, 0);
    _q.setFromEuler(_e);
    _s.setScalar(it.s ?? 1);
    _p.set(it.x, it.y, it.z);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    if (it.color != null || base || jitter) {
      _c.set(it.color ?? base ?? 0xffffff);
      if (jitter) _c.offsetHSL((Math.random() - 0.5) * 0.04 * jitter, (Math.random() - 0.5) * 0.15 * jitter, (Math.random() - 0.5) * 0.12 * jitter);
      mesh.setColorAt(i, _c);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return {
    mesh,
    setTime(t) { if (material.userData.uWindT) material.userData.uWindT.value = t; },
    dispose() { mesh.parent?.remove(mesh); mesh.dispose(); },
  };
}

/**
 * Patch any built-in material so instances sway with the wind (roots stay put).
 * @param {THREE.Material} material
 * @param {{ strength?: number, speed?: number, uniform?: { value: number } }} [opts] share `uniform` between materials
 */
export function addWindSway(material, opts = {}) {
  const uWindT = opts.uniform ?? { value: 0 };
  const strength = opts.strength ?? 0.05, speed = opts.speed ?? 0.9;
  material.userData.uWindT = uWindT;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uWindT = uWindT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{
  vec3 o = instanceMatrix[3].xyz;
  float ph = o.x * 1.3 + o.z * 0.9 + o.y * 0.7;
  float w = sin(uWindT * ${speed.toFixed(2)} + ph) + 0.5 * sin(uWindT * ${(speed * 1.9).toFixed(2)} + ph * 2.1);
  transformed.xz += vec2(${strength.toFixed(3)}, ${(strength * 0.65).toFixed(3)}) * w * max(position.y, 0.0) * 2.0;
}
#endif`);
  };
  material.customProgramCacheKey = () => `wind:${strength}:${speed}`;
  material.needsUpdate = true;
  return uWindT;
}

/**
 * Distance rings with hysteresis: each entry is shown when camDist ∈ [min, max] (±`band` to stop flicker).
 * @param {{ object: THREE.Object3D, min?: number, max?: number, center?: THREE.Vector3 }[]} entries
 */
export function createLodRings(entries, { band = 4 } = {}) {
  const rings = entries.map((e) => ({ ...e, min: e.min ?? -Infinity, max: e.max ?? Infinity, on: null, center: e.center ?? null }));
  const c = new THREE.Vector3();
  return {
    rings,
    update(camera) {
      for (const r of rings) {
        if (r.center) c.copy(r.center); else r.object.getWorldPosition(c);
        const d = c.distanceTo(camera.position);
        const want = r.on ? d > r.min - band && d < r.max + band : d > r.min + band && d < r.max - band;
        if (want !== r.on) { r.on = want; r.object.visible = want; }
      }
    },
  };
}

const CARD_VERT = /* glsl */ `
  attribute vec3 aPos; attribute vec2 aSize; attribute vec3 aColor;
  varying vec3 vC; varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vC = aColor; vUv = uv;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 world = aPos + right * position.x * aSize.x + vec3(0.0, (position.y + 0.5) * aSize.y, 0.0);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    #ifdef USE_FOG
      vFogDepth = -mv.z;
    #endif
  }`;
const CARD_FRAG = /* glsl */ `
  varying vec3 vC; varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  uniform float uShape; // 0 = dome (ger / bush), 1 = spike (tree / tuft)
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float dome = 1.0 - smoothstep(0.85, 1.0, length(vec2(q.x, max(q.y, 0.0) * 1.15)));
    float spike = 1.0 - smoothstep(0.7, 1.0, abs(q.x) + (q.y + 1.0) * 0.5 * 0.9);
    float a = mix(dome, spike, uShape);
    if (a < 0.05) discard;
    float shade = 0.82 + 0.18 * (q.y * 0.5 + 0.5);
    gl_FragColor = vec4(vC * shade, 1.0);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * Far-field impostors: ONE instanced camera-facing quad per field (far gers, herd dots, distant trees).
 * @param {{ x: number, y: number, z: number, w?: number, h?: number, color?: THREE.ColorRepresentation }[]} items
 * @param {{ color?: THREE.ColorRepresentation, shape?: 'dome' | 'spike' }} [opts]
 */
export function createImpostorCards(items, opts = {}) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const n = items.length;
  const pos = new Float32Array(n * 3), size = new Float32Array(n * 2), col = new Float32Array(n * 3);
  items.forEach((it, i) => {
    pos.set([it.x, it.y, it.z], i * 3);
    size.set([it.w ?? 1, it.h ?? 1], i * 2);
    _c.set(it.color ?? opts.color ?? 0xffffff);
    col.set([_c.r, _c.g, _c.b], i * 3);
  });
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 2));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.instanceCount = n;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.ShaderMaterial({
    vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uShape: { value: opts.shape === 'spike' ? 1 : 0 } }]),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'impostor_cards';
  return { mesh, update() { /* billboard is done in the shader; kept for API symmetry */ }, dispose() { mesh.parent?.remove(mesh); geo.dispose(); mat.dispose(); } };
}

/**
 * Hold a frame budget by stepping the pixel ratio between `min` and `max` (checks every `every` seconds).
 * @param {THREE.WebGLRenderer} renderer
 */
export function createAdaptiveQuality(renderer, { targetMs = 16.7, min = 0.6, max = Math.min(devicePixelRatio || 1, 2), every = 2, steps = [0.6, 0.75, 1, 1.25, 1.5, 2] } = {}) {
  const ladder = steps.filter((s) => s >= min && s <= max);
  let i = Math.max(0, ladder.findIndex((s) => s >= renderer.getPixelRatio()));
  if (i < 0) i = ladder.length - 1;
  let acc = 0, n = 0, worst = 0, cool = 0;
  renderer.setPixelRatio(ladder[i]);
  return {
    get pixelRatio() { return ladder[i]; },
    frame(dt) {
      acc += dt; n++; worst = Math.max(worst, dt); cool += dt;
      if (cool < every) return;
      const avg = (acc / n) * 1000; cool = 0; acc = 0; n = 0;
      const peak = worst * 1000; worst = 0;
      if (avg > targetMs * 1.15 && i > 0) renderer.setPixelRatio(ladder[--i]);
      else if (avg < targetMs * 0.7 && peak < targetMs * 1.6 && i < ladder.length - 1) renderer.setPixelRatio(ladder[++i]);
    },
  };
}
