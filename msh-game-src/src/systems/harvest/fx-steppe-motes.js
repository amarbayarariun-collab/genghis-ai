/**
 * fx-steppe-motes.js — Хээрийн тоос, өвсний үр (airborne motes / grass seeds / near-camera pollen)
 *
 * Source: xikhar/voxel-game-original `src/fx/particles.js` — MIT License, Copyright (c) 2026 Shikhar.
 *   Ported with permission of the MIT license: GPU-animated instanced quads, three layers (hero / mid / near),
 *   field wraps around the camera so it never runs out, fade at loop top/bottom. Changes: petals → grass seeds and
 *   golden dust, steppe palette, our own seeded rng, counts tuned for the Onon camp, slower fall (steppe wind lifts).
 * License of this file: MIT (keep the copyright line above if redistributed).
 *
 * Wire into demo-slice/src/main.js:
 *   import { createSteppeMotes } from './systems/fx-steppe-motes.js';
 *   let motes = createSteppeMotes(90);         // worldSize ≈ camp play area; call again after loadScene()
 *   scene.add(motes.group);
 *   // tick(): motes.update(dt, camera);
 */
import * as THREE from 'three';

const SEED_COLORS = ['#e9d3a1', '#d9b877', '#f3e2b8', '#cfae6e'].map((c) => new THREE.Color(c));
const MOTE_COLORS = ['#ffd98a', '#ffc46a', '#fff1c9'].map((c) => new THREE.Color(c));

const VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec3 offset;
  attribute vec3 aSeed;     // (phase, spinSpeed, fallSpeed)
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uTime;
  uniform vec3 uBounds;
  uniform vec3 uOrigin;
  uniform vec2 uWind;
  varying vec3 vCol;
  varying vec2 vUv;
  varying float vFade;

  mat3 rotAxis(vec3 a, float t) {
    float c = cos(t), s = sin(t), o = 1.0 - c;
    return mat3(
      o*a.x*a.x + c,      o*a.x*a.y - a.z*s,  o*a.x*a.z + a.y*s,
      o*a.x*a.y + a.z*s,  o*a.y*a.y + c,      o*a.y*a.z - a.x*s,
      o*a.x*a.z - a.y*s,  o*a.y*a.z + a.x*s,  o*a.z*a.z + c);
  }

  void main() {
    vUv = uv;
    vCol = aColor;
    float t = uTime;
    vec3 p = position * aSize;
    vec3 axis = normalize(vec3(sin(aSeed.x*7.1), 0.6, cos(aSeed.x*3.3)));
    p = rotAxis(axis, t * aSeed.y + aSeed.x * 6.28) * p;

    vec3 base = offset;
    float fall = mod(base.y - t * aSeed.z, uBounds.y);
    vec3 wp;
    wp.y = fall;
    // steppe wind: a steady drift plus the sway
    wp.x = base.x + t * uWind.x + sin(t * 0.55 + aSeed.x * 6.28) * 2.2 + sin(t * 0.21) * 1.2;
    wp.z = base.z + t * uWind.y + cos(t * 0.47 + aSeed.x * 5.11) * 2.2 + cos(t * 0.17) * 1.2;
    wp.xz = mod(wp.xz - uOrigin.xz + uBounds.xz * 0.5, uBounds.xz) - uBounds.xz * 0.5 + uOrigin.xz;

    vec3 world = wp + p;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    vFade = smoothstep(0.0, 0.12, fall / uBounds.y) * (1.0 - smoothstep(0.86, 1.0, fall / uBounds.y));
    gl_Position = projectionMatrix * mv;
    #ifdef USE_FOG
      vFogDepth = -mv.z;
    #endif
  }`;

const FRAG = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  varying vec3 vCol;
  varying vec2 vUv;
  varying float vFade;
  uniform float uSoft;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    // slim seed silhouette (longer on one axis than the petal original)
    float d = pow(abs(q.x), 1.3) + pow(abs(q.y), 1.9);
    float a = 1.0 - smoothstep(0.7, 1.0, d);
    if (a < 0.02) discard;
    float shade = 0.88 + 0.22 * smoothstep(-0.6, 0.9, q.y - q.x * 0.4);
    gl_FragColor = vec4(vCol * shade, a * vFade * uSoft);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function mulberry32(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.pick = (arr) => arr[(rng() * arr.length) | 0];
  return rng;
}

function makeQuadGeometry(count, bounds, rng, colors, sizeRange, fallRange) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const off = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    off[i * 3] = rng.range(-bounds.x / 2, bounds.x / 2);
    off[i * 3 + 1] = rng.range(0, bounds.y);
    off[i * 3 + 2] = rng.range(-bounds.z / 2, bounds.z / 2);
    seed[i * 3] = rng();
    seed[i * 3 + 1] = rng.range(0.6, 2.4);
    seed[i * 3 + 2] = rng.range(fallRange[0], fallRange[1]);
    const c = rng.pick(colors);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    size[i] = rng.range(sizeRange[0], sizeRange[1]);
  }
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geo;
}

/**
 * @param {number} worldSize side of the play area in metres (≈ 90 for the camp)
 * @param {{ seed?: number, wind?: [number, number], density?: number }} [opts]
 */
export function createSteppeMotes(worldSize = 90, opts = {}) {
  const rng = mulberry32(opts.seed ?? 1206); // 1206 — year of the khuraldai
  const density = opts.density ?? 1;
  const wind = new THREE.Vector2(...(opts.wind ?? [0.5, -0.2]));
  const group = new THREE.Group();
  group.name = 'fx_steppe_motes';
  const layers = [];

  const mk = (count, bounds, colors, sizeRange, fallRange, soft, blend) => {
    const geo = makeQuadGeometry(Math.round(count * density), bounds, rng, colors, sizeRange, fallRange);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: blend,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBounds: { value: bounds.clone() },
          uOrigin: { value: new THREE.Vector3() },
          uWind: { value: wind },
          uSoft: { value: soft },
        },
      ]),
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 20;
    group.add(m);
    layers.push(mat);
    return mat;
  };
  const B = (x, y, z) => new THREE.Vector3(x, y, z);

  // Counts are deliberately low (voxel-game lesson: ~3700 read as confetti).
  // grass seeds, sparse and slow — the hero motif
  mk(140, B(worldSize * 0.8, 14, worldSize * 0.8), SEED_COLORS, [0.06, 0.14], [0.25, 0.6], 0.85, THREE.NormalBlending);
  // golden dust motes in the sun
  mk(220, B(worldSize * 0.8, 10, worldSize * 0.8), MOTE_COLORS, [0.04, 0.10], [0.05, 0.22], 0.28, THREE.AdditiveBlending);
  // near-camera pollen, fast parallax
  mk(90, B(30, 8, 30), MOTE_COLORS, [0.025, 0.06], [0.12, 0.4], 0.2, THREE.AdditiveBlending);

  return {
    group,
    update(dt, camera) {
      for (const m of layers) {
        m.uniforms.uTime.value += dt;
        m.uniforms.uOrigin.value.copy(camera.position);
      }
    },
    setWind(x, z) { wind.set(x, z); },
    dispose() {
      group.parent?.remove(group);
      for (const m of group.children) { m.geometry.dispose(); m.material.dispose(); }
    },
  };
}
