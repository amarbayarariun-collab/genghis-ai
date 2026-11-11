// The user's sculpted low-poly horse (texture baked into per-face colour).
// No skeleton, so the gait is a vertex-shader rig built from measured
// landmarks (model space, 1.66 m tall, head toward +Z):
//   front legs z ~ +0.36, hind legs z ~ -0.51, belly ~ y 0.62,
//   saddle seat ~ y 1.16 at z ~ -0.05, neck root ~ (y 0.95, z 0.32), tail z < -0.66.
// Diagonal trot/gallop footfalls, knee fold on the lifted leg, neck bob,
// grazing head-down, tail sway. Shadows use the same deformation.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const HORSE_HI_URL = './models/horse_hi.glb';
export const HORSE_LO_URL = './models/horse_lo.glb';
const MODEL_SCALE = 1.12;
export const HORSE_SEAT_Y = 1.16 * MODEL_SCALE;

const RIG = /* glsl */`
  {
    vec3 p = transformed;
    float isFront = step(0.0, p.z);
    float zc = mix(-0.51, 0.365, isFront);
    float half0 = mix(0.10, 0.13, isFront);
    float half1 = mix(0.17, 0.20, isFront);
    float wz = 1.0 - smoothstep(half0, half1, abs(p.z - zc));
    float wy = 1.0 - smoothstep(0.60, 0.86, p.y);
    float w = wz * wy;
    // footfall offsets: FL 0, FR .5, HL .75, HR .25 (diagonal pairs)
    float right = step(0.0, p.x);
    float off = mix(mix(0.75, 0.25, right), mix(0.0, 0.5, right), isFront);
    float ph = uPhase + off * 6.28318;
    float swing = uAmp * sin(ph) * w;
    float py = mix(0.92, 0.86, isFront);
    vec2 r = vec2(p.y - py, p.z - zc);
    float c = cos(swing), s = sin(swing);
    p.y = py + r.x * c - r.y * s;
    p.z = zc + r.x * s + r.y * c;
    // fold the lower leg while it travels forward (lifted)
    float wLow = (1.0 - smoothstep(0.22, 0.42, transformed.y)) * wz;
    float fold = uAmp * 1.3 * max(0.0, cos(ph)) * wLow * mix(-0.7, 1.0, isFront);
    float ky = 0.40;
    vec2 rk = vec2(p.y - ky, p.z - zc);
    float ck = cos(fold), sk = sin(fold);
    p.y = ky + rk.x * ck - rk.y * sk;
    p.z = zc + rk.x * sk + rk.y * ck;
    // neck + head: grazing bend and gait bob, weight grows along the neck
    float wn = smoothstep(0.30, 0.62, transformed.z) * smoothstep(0.86, 1.10, transformed.y);
    float neckA = (uGraze * 1.25 + uBob) * wn;
    vec2 rn = vec2(p.y - 0.95, p.z - 0.32);
    float cn = cos(neckA), sn = sin(neckA);
    p.y = 0.95 + rn.x * cn - rn.y * sn;
    p.z = 0.32 + rn.x * sn + rn.y * cn;
    // tail sway
    float wt = (1.0 - smoothstep(-0.78, -0.64, transformed.z)) * (1.0 - smoothstep(0.95, 1.15, transformed.y));
    float hang = clamp(1.12 - transformed.y, 0.0, 1.0);
    p.x += sin(uTail + transformed.y * 3.0) * 0.07 * wt * hang;
    p.z -= uLift * 0.25 * wt * hang;
    transformed = p;
  }
`;

function patch(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float uPhase, uAmp, uGraze, uBob, uTail, uLift;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + RIG);
  };
  material.customProgramCacheKey = () => 'horse-rig';
  material.needsUpdate = true;
}

const cache = {};
function loadGeometry(url) {
  if (!cache[url]) {
    cache[url] = new Promise((resolve, reject) => {
      new GLTFLoader().load(url, (g) => {
        let geo = null;
        g.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
        geo ? resolve(geo) : reject(new Error('no mesh'));
      }, undefined, reject);
    });
  }
  return cache[url];
}

const _c = new THREE.Color();
// Strip the saddle, cloth and brass for a free-running herd horse and tint the coat.
function herdVariant(geo, coatHex, maneHex) {
  const g = geo.clone();
  const col = g.attributes.color;
  const pos = g.attributes.position;
  const coat = new THREE.Color(coatHex);
  const mane = new THREE.Color(maneHex);
  const base = new THREE.Color('#9a5428'); // the sculpt's chestnut, for relative shading
  for (let i = 0; i < col.count; i += 3) {
    _c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).convertLinearToSRGB();
    const { r, g: gg, b } = _c;
    const y = pos.getY(i), z = pos.getZ(i);
    const red = r > 0.42 && gg / r < 0.36;
    const gold = r > 0.62 && gg / r > 0.66 && b / r < 0.75;
    const onBack = y > 0.9 && z > -0.42 && z < 0.22;
    const dark = r < 0.3;
    let out;
    if (red || gold || (onBack && !(r > 0.45 && gg / r > 0.4 && gg / r < 0.62))) {
      out = coat.clone().multiplyScalar(0.92);
    } else if (dark && y > 0.9 && z > 0.1) {
      out = mane.clone(); // mane and forelock
    } else if (dark) {
      out = mane.clone().lerp(coat, 0.25);
    } else {
      // shade relative to the original chestnut so the facets keep their light/dark
      const k = (r + gg + b) / (base.r + base.g + base.b);
      out = coat.clone().multiplyScalar(THREE.MathUtils.clamp(k, 0.55, 1.35));
    }
    out.convertSRGBToLinear();
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, out.r, out.g, out.b);
  }
  col.needsUpdate = true;
  return g;
}

/**
 * attachHorseModel(horseGroup, { lod: 'hi'|'lo', herd: {coat, mane} | null })
 * Replaces the procedural horse's meshes with the sculpt once it loads and
 * takes over userData.update. The procedural body stays as a fallback.
 */
export function attachHorseModel(horse, { lod = 'hi', herd = null } = {}) {
  const uniforms = {
    uPhase: { value: Math.random() * 10 }, uAmp: { value: 0 }, uGraze: { value: 0 },
    uBob: { value: 0 }, uTail: { value: 0 }, uLift: { value: 0 },
  };
  loadGeometry(lod === 'hi' ? HORSE_HI_URL : HORSE_LO_URL).then((geo) => {
    const g = herd ? herdVariant(geo, herd.coat, herd.mane) : geo;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
    patch(mat, uniforms);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patch(depth, uniforms);
    mesh.customDepthMaterial = depth;
    mesh.scale.setScalar(MODEL_SCALE);
    mesh.name = 'horse-model';
    // drop the procedural parts, keep the group (position/rotation/userData)
    [...horse.children].forEach((c) => horse.remove(c));
    horse.add(mesh);
    horse.userData.seatY = HORSE_SEAT_Y;
    let graze = 0;
    let amp = 0;
    horse.userData.update = (dt, t, speed = 0, opts = {}) => {
      const sp = Math.max(0, speed);
      const moving = sp > 0.15;
      uniforms.uPhase.value += dt * (moving ? 3.0 + sp * 1.15 : 0);
      amp += ((moving ? Math.min(0.62, 0.3 + sp * 0.05) : 0) - amp) * Math.min(1, dt * 8);
      uniforms.uAmp.value = amp;
      const want = !moving && opts.graze ? 1 : 0;
      graze += (want - graze) * Math.min(1, dt * 1.2);
      uniforms.uGraze.value = graze;
      uniforms.uBob.value = moving ? Math.sin(uniforms.uPhase.value * 2) * 0.06 * (amp / 0.6) : Math.sin(t * 0.7) * 0.02;
      uniforms.uTail.value = t * 2.1 + uniforms.uPhase.value * 0.5;
      uniforms.uLift.value = Math.min(1, sp / 8);
      mesh.position.y = moving ? Math.abs(Math.sin(uniforms.uPhase.value)) * Math.min(0.05, 0.01 * sp) : 0;
    };
  }).catch((err) => console.warn('[horse] model failed, procedural kept', err));
  return horse;
}
