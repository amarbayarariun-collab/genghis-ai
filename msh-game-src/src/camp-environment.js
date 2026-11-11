// Daylight Onon steppe. Procedural geometry only: green plain, gray ridges, river, felt gers.
import * as THREE from 'three';
import { createHorse } from './characters/horse.js';
import { attachHorseModel } from './characters/horse-model.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SIZE = 640;
const GRID = 181;
const HALF = SIZE / 2;

export const STEPPE_FISH = { x: 17.4, z: 13.2 };
export const STEPPE_BERRIES = [
  { x: -12.2, z: 8.4 },
  { x: 5.6, z: 18.2 },
  { x: 8.8, z: -1.2 },
];
// small ponds / oxbows like the reference photos (horses drink at the far one)
export const PONDS = [
  { x: 40, z: -27, r: 6.5, seed: 1 },
  { x: 13, z: 31, r: 4.6, seed: 2 },
  { x: -26, z: -16, r: 5.4, seed: 3 },
];
function pondRadius(p, a) {
  return p.r * (1 + 0.18 * Math.sin(a * 3 + p.seed) + 0.1 * Math.sin(a * 5 + p.seed * 2.3));
}
function pondDepth(x, z) {
  let d = 0;
  for (const p of PONDS) {
    const a = Math.atan2(z - p.z, x - p.x);
    const rr = pondRadius(p, a);
    const dist = Math.hypot(x - p.x, z - p.z);
    d = Math.max(d, 1 - smooth(rr * 0.75, rr * 1.15, dist));
  }
  return d;
}
export { riverX };

const GERS = [
  { x: 0.2, z: -6.2, rot: 0, s: 1 },
  { x: -17.5, z: 8.2, rot: 0.55, s: 0.9 },
  { x: 14.2, z: -9.4, rot: -0.35, s: 0.86 },
];

const _c = new THREE.Color();

function smooth(e0, e1, x) {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function riverX(z) {
  return 24 + Math.sin(z * 0.031) * 7.5 + Math.sin(z * 0.012 + 1.2) * 3.2;
}
function terrainHeight(x, z) {
  let h = Math.sin(x * 0.018) * Math.cos(z * 0.015) * 1.15
    + Math.sin((x + z) * 0.0075) * 0.55
    + Math.cos(x * 0.04 - z * 0.018) * 0.22;
  // broad rolling hills that rise gently away from the camp (open horizon, no rim)
  const far = smooth(55, 170, Math.hypot(x, z));
  h += far * (Math.sin(x * 0.011 + 0.7) * Math.cos(z * 0.009) * 3.5 + Math.sin((x - z) * 0.006) * 2.2 + 1.2);
  const campD = Math.hypot(x * 0.9, (z - 5) * 0.85);
  h = THREE.MathUtils.lerp(h, 0.2, (1 - smooth(10, 28, campD)) * 0.94);
  const rd = Math.abs(x - riverX(z));
  const channel = 1 - smooth(5.5, 12, rd);
  const outside = smooth(16, 24, Math.hypot(x, z - 6));
  h = THREE.MathUtils.lerp(h, -0.85, channel * outside);
  const pd = pondDepth(x, z);
  if (pd > 0) h = THREE.MathUtils.lerp(h, -0.55, pd);
  const fishD = Math.hypot(x - STEPPE_FISH.x, z - STEPPE_FISH.z);
  if (fishD < 4.2) h = THREE.MathUtils.lerp(h, 0.16, 1 - smooth(1.2, 4.2, fishD));
  return h;
}

function buildHeightfield() {
  const n = GRID;
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -HALF + (j / (n - 1)) * SIZE;
    for (let i = 0; i < n; i++) {
      const x = -HALF + (i / (n - 1)) * SIZE;
      data[j * n + i] = terrainHeight(x, z);
    }
  }
  function heightAt(x, z) {
    const fx = THREE.MathUtils.clamp((x + HALF) / SIZE, 0, 1) * (n - 1);
    const fz = THREE.MathUtils.clamp((z + HALF) / SIZE, 0, 1) * (n - 1);
    const i0 = Math.min(n - 2, Math.floor(fx));
    const j0 = Math.min(n - 2, Math.floor(fz));
    const tx = fx - i0;
    const tz = fz - j0;
    const h00 = data[j0 * n + i0];
    const h10 = data[j0 * n + i0 + 1];
    const h01 = data[(j0 + 1) * n + i0];
    const h11 = data[(j0 + 1) * n + i0 + 1];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(h00, h10, tx),
      THREE.MathUtils.lerp(h01, h11, tx),
      tz,
    );
  }
  return { data, heightAt, n };
}

function paintGround(geo, heightAt) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#668a40');
  const grassB = new THREE.Color('#86a24e');
  const grassC = new THREE.Color('#4f7334');
  const grassDry = new THREE.Color('#b0a55e');
  const path = new THREE.Color('#8d784c');
  const shore = new THREE.Color('#c6b48a');
  const routes = [
    [0.2, 26, 0.6, 8],
    [0.6, 8, 0.8, 2.6],
    [0.8, 2.8, 6.2, 8.2],
  ];
  function pathAmt(x, z) {
    let m = 0;
    for (const [x1, z1, x2, z2] of routes) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len2 = dx * dx + dz * dz || 1;
      const t = THREE.MathUtils.clamp(((x - x1) * dx + (z - z1) * dz) / len2, 0, 1);
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      const d = Math.hypot(x - px, z - pz);
      const wobble = 0.9 + Math.sin(t * 11 + x1) * 0.25;
      m = Math.max(m, 1 - smooth(0.15, wobble, d));
    }
    return m * 0.38;
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = (Math.sin(x * 0.07) * Math.cos(z * 0.06) + 1) * 0.5;
    const dry = Math.pow((Math.sin(x * 0.023 + 1.3) * Math.sin(z * 0.019 - 0.4) + 1) * 0.5, 2) * (0.6 + 0.4 * Math.sin(x * 0.11 + z * 0.07));
    _c.copy(grassA).lerp(grassB, n * 0.65).lerp(grassC, Math.max(0, y) * 0.06).lerp(grassDry, dry * 0.75);
    _c.lerp(path, pathAmt(x, z));
    const shoreD = Math.abs(x - riverX(z));
    _c.lerp(shore, (1 - smooth(6.4, 8.2, shoreD)) * smooth(20, 30, Math.hypot(x, z - 4)) * 0.45);
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
}

function ridgeMesh(width, depth, hx, hz, place) {
  const geo = new THREE.PlaneGeometry(width, depth, hx, hz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rock = new THREE.Color('#8d8a84');
  const dark = new THREE.Color('#4a4d55');
  const light = new THREE.Color('#b7b2a8');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const across = 1 - smooth(0, depth * 0.42, Math.abs(z));
    const crest = Math.pow(across, 0.45);
    const noise = Math.sin(x * 0.031) * 8 + Math.sin(x * 0.012 + 2) * 14
      + Math.abs(Math.sin(x * 0.09 + z * 0.2)) * 6
      + Math.pow(Math.abs(Math.sin(x * 0.047 + place.peak)), 6) * place.peak * 0.55
      + Math.abs(Math.sin(x * 0.21 + z * 0.33)) * 2.5;
    const y = crest * (place.peak + noise) + (1 - crest) * 1.5;
    pos.setY(i, y);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  let maxY = 0;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const scree = new THREE.Color('#8f8b85');
  const gold = new THREE.Color('#a88a55');
  const foot = new THREE.Color('#7d8656');
  const snow = new THREE.Color('#eef1f4');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const ny = nrm.getY(i);
    const h = y / (maxY || 1);
    const streak = Math.sin(x * 0.35 + y * 0.15) * 0.5 + 0.5;
    _c.copy(scree).lerp(light, Math.sin(y * 0.55 + x * 0.02) * 0.2 + 0.2);
    // steep faces: dark fractured rock with vertical gullies
    _c.lerp(dark, THREE.MathUtils.clamp((0.6 - ny) * 2.2, 0, 1) * (0.45 + streak * 0.55));
    // gentle shoulders and the upper slopes: dry golden-brown grass (reference photo 1)
    const gentle = smooth(0.45, 0.8, ny);
    _c.lerp(gold, gentle * smooth(0.12, 0.45, h) * (0.55 + 0.45 * Math.sin(x * 0.013 + 1.7) ** 2));
    // apron meets the steppe
    _c.lerp(foot, 1 - smooth(0.04, 0.18, h));
    if (place.snow) _c.lerp(snow, smooth(place.snow, place.snow + 0.08, h) * smooth(0.55, 0.8, ny + 0.2));
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.position.set(place.x, 0, place.z);
  mesh.scale.y = place.sy ?? 1;
  mesh.rotation.y = place.rot || 0;
  mesh.receiveShadow = true;
  mesh.name = 'ridge';
  return mesh;
}

function waterRibbon() {
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const z = 80 - i * 3.4;
    pts.push(new THREE.Vector3(riverX(z), -0.12, z));
  }
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    const w = 8.4 + (i / pts.length) * 1.6;
    positions.push(p.x + nx * w, p.y, p.z + nz * w, p.x - nx * w, p.y, p.z - nz * w);
    const v = i / (pts.length - 1);
    uvs.push(0, v * 8, 1, v * 8);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRadial: { value: 0 },
      uDeep: { value: new THREE.Color(0.07, 0.25, 0.36) },
      uSky: { value: new THREE.Color(0.62, 0.78, 0.92) },
      uGlint: { value: new THREE.Color(1.0, 0.96, 0.85) },
      uSun: { value: new THREE.Vector3(0.5, 0.75, 0.4).normalize() },
      fogColor: { value: new THREE.Color('#c5d8ea') },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vDist;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vDist = length(w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying float vDist;
      varying vec3 vW;
      uniform float uTime;
      uniform vec3 fogColor;
      uniform float uRadial;
      uniform vec3 uDeep, uSky, uGlint, uSun;
      void main() {
        vec2 q = vW.xz;
        float rip = sin(q.y * 0.9 + q.x * 0.25 + uTime * 1.4) * 0.5
                  + sin(q.x * 1.7 - q.y * 0.6 - uTime * 0.9) * 0.3
                  + sin((q.x + q.y) * 3.1 + uTime * 2.2) * 0.2;
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vec3(rip * 0.05, 1.0, rip * 0.04));
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.25 + fres * 0.7);
        // sun / moon glints
        float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 60.0);
        col += uGlint * spec * 0.8;
        float e = uRadial > 0.5 ? smoothstep(1.0, 0.82, length(vUv - 0.5) * 2.0) : smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
        col = mix(vec3(0.62, 0.66, 0.56), col, e);
        float fogF = smoothstep(70.0, 280.0, vDist);
        col = mix(col, fogColor, fogF);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'onon';
  mesh.renderOrder = 1;
  return mesh;
}

function bandTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f1e6';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#6e3428';
  g.fillRect(0, 0, 512, 5);
  g.fillRect(0, 59, 512, 5);
  g.strokeStyle = '#7a4030';
  g.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x = 8 + i * 28;
    g.beginPath();
    g.moveTo(x, 32);
    g.lineTo(x + 10, 16);
    g.lineTo(x + 20, 32);
    g.lineTo(x + 10, 48);
    g.closePath();
    g.stroke();
    if (i % 3 === 0) {
      g.fillStyle = '#8d4a32';
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

const _felt = [];
const _wood = [];
function put(list, geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  ));
  list.push(geo);
}
function pole(list, ax, ay, az, bx, by, bz, r) {
  const a = new THREE.Vector3(ax, ay, az);
  const b = new THREE.Vector3(bx, by, bz);
  const dir = b.clone().sub(a);
  const len = dir.length() || 0.001;
  const geo = new THREE.CylinderGeometry(r, r, len, 5);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  list.push(geo);
}

export function makeGer(scale) {
  // Proportions from the reference drawing: wall ~1.6 m, roof rising ~1.4 m to
  // a wooden crown, roof eave barely overhanging the wall.
  const felt = [];
  const wood = [];
  const rope = [];
  const orange = [];
  const red = [];
  const R = 3.15 * scale;
  const wallH = 1.62 * scale;
  const roofH = 1.45 * scale;
  const crownR = 0.42 * scale;
  // wall: slightly bulging felt drum (two stacked rings so it is not a plain cylinder)
  put(felt, new THREE.CylinderGeometry(R * 1.01, R * 1.03, wallH * 0.55, 28), 0, wallH * 0.275, 0);
  put(felt, new THREE.CylinderGeometry(R, R * 1.01, wallH * 0.47, 28), 0, wallH * 0.765, 0);
  // roof: truncated cone from eave to crown, then a felt eave lip
  put(felt, new THREE.CylinderGeometry(crownR * 1.1, R * 1.06, roofH, 28, 1, true), 0, wallH + roofH * 0.5, 0);
  put(felt, new THREE.CylinderGeometry(R * 1.06, R * 1.06, 0.09 * scale, 28, 1, true), 0, wallH + 0.02, 0);
  // roof seams: radial felt flaps (slightly raised strips)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pole(rope, Math.sin(a) * crownR * 1.15, wallH + roofH + 0.02, Math.cos(a) * crownR * 1.15,
      Math.sin(a) * R * 1.07, wallH + 0.04, Math.cos(a) * R * 1.07, 0.018 * scale);
  }
  // wooden crown (toono) + chimney pipe with bands
  put(wood, new THREE.TorusGeometry(crownR, 0.07 * scale, 6, 16), 0, wallH + roofH + 0.02, 0, Math.PI / 2, 0, 0);
  put(wood, new THREE.CylinderGeometry(crownR * 0.95, crownR * 0.95, 0.06 * scale, 16), 0, wallH + roofH + 0.06, 0);
  const pipeX = -crownR * 2.3, pipeZ = -crownR * 0.6;
  const pipeY = wallH + roofH * (1 - Math.hypot(pipeX, pipeZ) / R) - 0.05;
  put(orange, new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 1.1 * scale, 10), pipeX, pipeY + 0.55 * scale, pipeZ);
  put(wood, new THREE.CylinderGeometry(0.115 * scale, 0.115 * scale, 0.06 * scale, 10), pipeX, pipeY + 0.4 * scale, pipeZ);
  put(wood, new THREE.CylinderGeometry(0.115 * scale, 0.115 * scale, 0.06 * scale, 10), pipeX, pipeY + 0.85 * scale, pipeZ);
  // belly ropes around the wall (three, like a real ger) and the eave band
  for (const h of [0.34, 0.62, 0.9]) {
    put(rope, new THREE.TorusGeometry(R * 1.035, 0.022 * scale, 4, 40), 0, wallH * h, 0, Math.PI / 2, 0, 0);
  }
  put(red, new THREE.CylinderGeometry(R * 1.065, R * 1.065, 0.16 * scale, 28, 1, true), 0, wallH - 0.06 * scale, 0);
  // diamond emblems on the felt (avoid the door)
  for (const a of [1.15, -1.15, Math.PI]) {
    const x = Math.sin(a) * R * 1.04, z = Math.cos(a) * R * 1.04;
    put(red, new THREE.BoxGeometry(0.46 * scale, 0.46 * scale, 0.02), x, wallH * 0.6, z, 0, a, Math.PI / 4);
    put(felt, new THREE.BoxGeometry(0.28 * scale, 0.28 * scale, 0.03), x * 1.002, wallH * 0.6, z * 1.002, 0, a, Math.PI / 4);
    put(red, new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 0.04), x * 1.004, wallH * 0.6, z * 1.004, 0, a, Math.PI / 4);
  }
  // painted wooden door: frame, two leaves with upper blue panel and lower lozenge, step
  const doorZ = R * 1.0;
  const dw = 1.15 * scale, dh = 1.42 * scale;
  put(wood, new THREE.BoxGeometry(dw + 0.22 * scale, dh + 0.14 * scale, 0.1 * scale), 0, dh / 2, doorZ);
  for (const sx of [-1, 1]) {
    const cx = sx * dw / 4;
    put(orange, new THREE.BoxGeometry(dw / 2 - 0.05 * scale, dh - 0.06 * scale, 0.07 * scale), cx, dh / 2, doorZ + 0.06 * scale);
    put(red, new THREE.BoxGeometry(dw / 2 - 0.22 * scale, dh * 0.34, 0.03), cx, dh * 0.3, doorZ + 0.11 * scale);
    put(orange, new THREE.BoxGeometry(0.15 * scale, 0.15 * scale, 0.04), cx, dh * 0.3, doorZ + 0.13 * scale, 0, 0, Math.PI / 4);
  }
  put(wood, new THREE.BoxGeometry(dw + 0.3 * scale, 0.08 * scale, 0.45 * scale), 0, 0.04 * scale, doorZ + 0.24 * scale);

  const group = new THREE.Group();
  const mk = (list, color) => {
    const m = new THREE.Mesh(mergeGeometries(list), new THREE.MeshLambertMaterial({ color }));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  mk(felt, '#f2ede2');
  mk(wood, '#6e4426');
  mk(rope, '#7b5236');
  mk(orange, '#c98a44');
  mk(red, '#9b3a2a');
  // blue painted upper door panels with a sun disc (separate tiny mesh)
  const blue = [];
  const sun = [];
  for (const sx of [-1, 1]) {
    put(blue, new THREE.BoxGeometry(dw / 2 - 0.22 * scale, dh * 0.24, 0.03), sx * dw / 4, dh * 0.76, doorZ + 0.11 * scale);
    put(sun, new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.03, 10), sx * dw / 4, dh * 0.76, doorZ + 0.13 * scale, Math.PI / 2, 0, 0);
  }
  mk(blue, '#5d8fa8');
  mk(sun, '#e9c46a');
  // patterned bottom band (procedural canvas, no photo texture)
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.045, R * 1.045, 0.3 * scale, 28, 1, true),
    new THREE.MeshLambertMaterial({ map: bandTexture(), color: '#ffffff' }),
  );
  band.position.y = 0.17 * scale;
  band.receiveShadow = true;
  group.add(band);
  group.name = 'ger';
  group.userData.chimney = new THREE.Vector3(pipeX, pipeY + 1.1 * scale, pipeZ);
  return group;
}

export function bush() {
  const leaves = [];
  const berries = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.SphereGeometry(0.38, 7, 6);
    geo.scale(1, 0.75, 1);
    geo.translate((i - 1.5) * 0.28, 0.32 + (i % 2) * 0.12, (i % 2) * 0.15);
    leaves.push(geo);
  }
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.SphereGeometry(0.06, 5, 4);
    geo.translate(Math.sin(i) * 0.32, 0.35 + (i % 3) * 0.1, Math.cos(i) * 0.28);
    berries.push(geo);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(leaves), new THREE.MeshLambertMaterial({ color: '#3f7a34' })));
  g.add(new THREE.Mesh(mergeGeometries(berries), new THREE.MeshLambertMaterial({ color: '#9a3038' })));
  g.name = 'berry-bush';
  return g;
}

// bay, black, chestnut, dun, grey-white, dark bay, red dun (as in the reference herd photos)
const HERD_COATS = [
  ['#7a4524', '#1c1512'], ['#2b2420', '#141110'], ['#8c4a24', '#2a1a12'], ['#b08a55', '#3a2a1c'],
  ['#d8d1c3', '#b9b0a2'], ['#4a2e1e', '#141110'], ['#a0643a', '#2a1a12'], ['#5c3a24', '#1c1512'],
];

function horseMesh(color) {
  const parts = [];
  put(parts, new THREE.BoxGeometry(1.25, 0.48, 0.42), 0, 0.95, 0);
  put(parts, new THREE.BoxGeometry(0.28, 0.48, 0.2), 0.55, 1.2, 0, 0, 0, -0.7);
  put(parts, new THREE.BoxGeometry(0.42, 0.2, 0.18), 0.88, 1.05, 0);
  put(parts, new THREE.BoxGeometry(0.12, 0.55, 0.12), 0.42, 0.48, 0.14);
  put(parts, new THREE.BoxGeometry(0.12, 0.55, 0.12), 0.42, 0.48, -0.14);
  put(parts, new THREE.BoxGeometry(0.12, 0.55, 0.12), -0.42, 0.48, 0.14);
  put(parts, new THREE.BoxGeometry(0.12, 0.55, 0.12), -0.42, 0.48, -0.14);
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshLambertMaterial({ color }));
  mesh.castShadow = true;
  mesh.name = 'horse';
  return mesh;
}

function skyShader() {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#2f6fbe') },
      mid: { value: new THREE.Color('#79b7e6') },
      horizon: { value: new THREE.Color('#e7f4fb') },
      ground: { value: new THREE.Color('#8fb56a') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color('#ffffff') },
      sunAmt: { value: 0 },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top, mid, horizon, ground, sunDir, sunCol;
      uniform float sunAmt;
      void main(){
        vec3 dir = normalize(vPos);
        float h = dir.y;
        vec3 c;
        if (h > 0.35) c = mix(mid, top, pow((h - 0.35) / 0.65, 0.8));
        else if (h > 0.02) c = mix(horizon, mid, (h - 0.02) / 0.33);
        else c = mix(horizon, ground, pow(clamp(-h, 0.0, 1.0), 0.55));
        // warm glow around the low sun / cool halo around the moon
        float sd = max(dot(dir, sunDir), 0.0);
        c += sunCol * (pow(sd, 6.0) * 0.45 + pow(sd, 60.0) * 0.6) * sunAmt * smoothstep(-0.08, 0.1, h);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

// Wind: a shared clock drives a vertex sway on every instanced plant.
// The sway is keyed on each instance's world position, so the field moves
// in travelling waves instead of in lockstep (the Sumiro approach).
const WIND = { value: 0 };
function windy(mat, amp, lift = 0) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindT = { value: 0 };
    mat.userData.windU = shader.uniforms.uWindT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{
  vec3 iw = vec3(instanceMatrix[3]);
  float ph = iw.x * 0.9 + iw.z * 0.7;
  float w = sin(uWindT * 1.1 + ph) + 0.55 * sin(uWindT * 2.3 + ph * 2.1) + 0.25 * sin(uWindT * 4.1 + ph * 3.7);
  float k = max(position.y - ${lift.toFixed(2)}, 0.0);
  transformed.xz += vec2(0.8, 0.55) * ${amp.toFixed(3)} * w * k;
}
#endif`);
  };
  mat.customProgramCacheKey = () => `windy-${amp}-${lift}`;
  windMats.push(mat);
  return mat;
}
const windMats = [];

export function buildSteppeEnvironment(scene, opts = {}) {
  windMats.length = 0;
  const q = opts.quality || {};
  const shadows = opts.shadows !== false;
  const root = new THREE.Group();
  root.name = 'steppe-environment';
  scene.add(root);

  const mood = opts.mood || {};
  const skyMat = skyShader();
  if (mood.sky) for (const k of ['top', 'mid', 'horizon', 'ground']) if (mood.sky[k]) skyMat.uniforms[k].value.set(mood.sky[k]);
  if (mood.sunGlow) {
    skyMat.uniforms.sunDir.value.set(...mood.sunGlow.dir).normalize();
    skyMat.uniforms.sunCol.value.set(mood.sunGlow.color);
    skyMat.uniforms.sunAmt.value = mood.sunGlow.amount ?? 1;
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(470, 32, 20), skyMat);
  root.add(sky);
  const fogCol = mood.fog?.color || '#c5d8ea';
  scene.background = new THREE.Color(mood.sky?.horizon || '#8ec4ee');
  scene.fog = new THREE.FogExp2(fogCol, (mood.fog?.density ?? 0.00135) * (q.fogDensityScale ?? 1));

  const field = buildHeightfield();
  const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, GRID - 1, GRID - 1);
  groundGeo.rotateX(-Math.PI / 2);
  paintGround(groundGeo, field.heightAt);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = shadows;
  ground.name = 'steppe-ground';
  root.add(ground);

  const water = waterRibbon();
  root.add(water);
  {
    const u = water.material.uniforms;
    u.fogColor.value.set(fogCol);
    if (mood.water?.deep) u.uDeep.value.set(mood.water.deep);
    if (mood.water?.sky) u.uSky.value.set(mood.water.sky);
    if (mood.water?.glint) u.uGlint.value.set(mood.water.glint);
    if (mood.sunGlow) u.uSun.value.set(...mood.sunGlow.dir).normalize();
  }

  // layered ranges: a nearer gray rocky ridge and a taller, hazier one behind it
  root.add(ridgeMesh(820, 70, 140, 10, { x: 0, z: -265, rot: 0.02, peak: 24, sy: 0.55 }));
  root.add(ridgeMesh(940, 90, 120, 8, { x: -40, z: -345, rot: -0.03, peak: 46, sy: 0.7, snow: 0.8 }));
  root.add(ridgeMesh(360, 70, 60, 6, { x: 300, z: -20, rot: Math.PI / 2 + 0.12, peak: 16, sy: 0.6 }));
  root.add(ridgeMesh(360, 60, 60, 6, { x: -300, z: -10, rot: Math.PI / 2 - 0.1, peak: 13, sy: 0.6 }));

  const pondMats = [];
  const clouds = [];
  const cloudN = Math.max(12, (q.clouds ?? 8) + 10);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: mood.cloud?.color || '#ffffff',
    emissive: mood.cloud?.emissive || '#aebfd4',
    emissiveIntensity: mood.cloud?.intensity ?? 0.45,
    flatShading: true,
  });
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  let rs = 7;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < cloudN; i++) {
    const puffs = [];
    const w = 40 + rnd() * 70;
    const n = 9 + Math.floor(rnd() * 8);
    for (let j = 0; j < n; j++) {
      const x = (rnd() - 0.5) * w;
      const top = 1 - Math.abs(x) / (w * 0.62);
      const r = (6 + rnd() * 9) * (0.6 + top * 0.6);
      const g = puffGeo.clone();
      g.scale(r * 1.25, r * (0.75 + top * 0.45), r);
      g.translate(x, r * 0.45 + rnd() * 6 * top, (rnd() - 0.5) * 18);
      puffs.push(g);
    }
    const belly = puffGeo.clone();
    belly.scale(w * 0.5, 3.5, 13);
    puffs.push(belly);
    // flatten the underside
    const merged = mergeGeometries(puffs);
    const pp = merged.attributes.position;
    for (let k = 0; k < pp.count; k++) if (pp.getY(k) < 0) pp.setY(k, pp.getY(k) * 0.25);
    merged.computeVertexNormals();
    const c = new THREE.Mesh(merged, cloudMat);
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    const d = 220 + rnd() * 190;
    c.position.set(Math.cos(ang) * d, 85 + rnd() * 55, Math.sin(ang) * d - 30);
    c.userData.speed = 0.5 + rnd() * 0.6;
    root.add(c);
    clouds.push(c);
  }

  const colliders = [];
  const chimneys = [];
  const reedSpots = [];
  for (const p of PONDS) {
    const shape = new THREE.Shape();
    for (let k = 0; k <= 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const rr = pondRadius(p, a) * 0.92;
      const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      k ? shape.lineTo(px, pz) : shape.moveTo(px, pz);
      if (k % 2 === 0) reedSpots.push([p.x + Math.cos(a) * rr * (0.95 + Math.random() * 0.2), p.z + Math.sin(a) * rr * (0.95 + Math.random() * 0.2)]);
    }
    const g = new THREE.ShapeGeometry(shape, 1);
    g.rotateX(Math.PI / 2);
    // radial uv for the soft edge
    const up = g.attributes.position; const uvA = new Float32Array(up.count * 2);
    for (let k = 0; k < up.count; k++) { uvA[k * 2] = 0.5 + up.getX(k) / (p.r * 2.6); uvA[k * 2 + 1] = 0.5 + up.getZ(k) / (p.r * 2.6); }
    g.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
    const pm = water.material.clone();
    pm.uniforms = THREE.UniformsUtils.clone(water.material.uniforms);
    pm.uniforms.uRadial.value = 1;
    pm.side = THREE.DoubleSide;
    const pond = new THREE.Mesh(g, pm);
    pond.position.set(p.x, -0.12, p.z);
    pond.name = 'pond';
    root.add(pond);
    pondMats.push(pm);
    colliders.push({ x: p.x, z: p.z, r: p.r * 0.72, kind: 'pond' });
  }
  // reeds along pond rims and the river banks
  for (let k = 0; k < 140; k++) {
    const z = -60 + Math.random() * 130;
    const side = Math.random() < 0.5 ? -1 : 1;
    reedSpots.push([riverX(z) + side * (8.6 + Math.random() * 1.6), z]);
  }
  {
    const reed = new THREE.ConeGeometry(0.035, 1, 3);
    reed.translate(0, 0.5, 0);
    const reeds = new THREE.InstancedMesh(reed, windy(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.035), reedSpots.length * 6);
    const dm = new THREE.Object3D();
    const rc = new THREE.Color();
    let n = 0;
    for (const [x, z] of reedSpots) {
      for (let j = 0; j < 6; j++) {
        const xx = x + (Math.random() - 0.5) * 0.7, zz = z + (Math.random() - 0.5) * 0.7;
        dm.position.set(xx, field.heightAt(xx, zz) - 0.05, zz);
        dm.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * 6, (Math.random() - 0.5) * 0.25);
        const hgt = 0.7 + Math.random() * 0.8;
        dm.scale.set(1, hgt, 1);
        dm.updateMatrix();
        reeds.setMatrixAt(n, dm.matrix);
        rc.set(['#8a9a4a', '#a39a52', '#6f8a3a', '#b4a060'][n % 4]);
        reeds.setColorAt(n, rc);
        n++;
      }
    }
    reeds.count = n;
    reeds.instanceMatrix.needsUpdate = true;
    if (reeds.instanceColor) reeds.instanceColor.needsUpdate = true;
    root.add(reeds);
  }
  const gersList = opts.gers || GERS;
  gersList.forEach((g) => {
    const ger = makeGer(g.s);
    if (g.rot != null) ger.rotation.y = g.rot;
    ger.position.set(g.x, field.heightAt(g.x, g.z), g.z);
    ger.rotation.y = g.rot;
    root.add(ger);
    ger.updateMatrixWorld(true);
    chimneys.push(ger.localToWorld(ger.userData.chimney.clone()));
    colliders.push({ x: g.x, z: g.z, r: 2.85 * g.s, kind: 'ger' });
  });

  const berries = (opts.berries === false ? [] : STEPPE_BERRIES).map((b) => ({ ...b }));
  berries.forEach((b) => {
    const bushMesh = bush();
    bushMesh.position.set(b.x, field.heightAt(b.x, b.z), b.z);
    root.add(bushMesh);
  });

  const herdAt = opts.herdAt || { x: 33, z: -18 };
  const herdN = opts.herd === false ? 0 : Math.min(9, (q.herd ?? 6) + 2);
  const herd = [];
  const colors = ['#6a4328', '#2a211c', '#8a6840', '#4a3428', '#c2a36a'];
  for (let i = 0; i < herdN; i++) {
    const x = herdAt.x + (i % 3) * 2.2;
    const z = herdAt.z + Math.floor(i / 3) * 2.4;
    const coat = HERD_COATS[i % HERD_COATS.length];
    const horse = createHorse({ coat: coat[0], mane: coat[1] });
    attachHorseModel(horse, { lod: 'lo', herd: { coat: coat[0], mane: coat[1] } });
    horse.position.set(x, field.heightAt(x, z), z);
    horse.rotation.y = -0.8 + (i % 4) * 0.4;
    horse.scale.setScalar(0.9);
    horse.userData.grazing = i % 3 !== 1;
    root.add(horse);
    herd.push(horse);
  }

  // hitching line (уяа): two posts, a rope, two saddled horses tied to it
  if (opts.hitch !== false) {
    const post = new THREE.MeshLambertMaterial({ color: '#6b4a2c' });
    const ropeM = new THREE.MeshLambertMaterial({ color: '#8a7350' });
    const ax = -13.0, bx = -8.4, hz = 0.6;
    for (const x of [ax, bx]) {
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 6), post);
      pm.position.set(x, field.heightAt(x, hz) + 0.75, hz);
      pm.castShadow = true;
      root.add(pm);
      colliders.push({ x, z: hz, r: 0.25, kind: 'post' });
    }
    const ry = (field.heightAt(ax, hz) + field.heightAt(bx, hz)) / 2 + 1.4;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, bx - ax, 5), ropeM);
    rope.rotation.z = Math.PI / 2;
    rope.position.set((ax + bx) / 2, ry, hz);
    root.add(rope);
    [[-12.0, '#2b2420'], [-9.6, '#b08a55']].forEach(([x, c], k) => {
      const z = hz - 1.25;
      const h = createHorse({ coat: c, saddle: true });
      attachHorseModel(h, { lod: 'lo' });
      h.position.set(x, field.heightAt(x, z), z);
      h.rotation.y = Math.PI + (k ? 0.15 : -0.1); // heads to the rope
      root.add(h);
      herd.push(h);
      h.userData.grazing = false;
      colliders.push({ x, z, r: 0.9, kind: 'horse' });
    });
  }

  const treeGeo = new THREE.ConeGeometry(1.1, 3.2, 5);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ color: '#2c4a30' }), 36);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 36; i++) {
    const z = -40 - i * 3.2;
    const x = riverX(z) + 14 + Math.sin(i * 1.7) * 4;
    dummy.position.set(x, field.heightAt(x, z) + 1.5, z);
    dummy.scale.setScalar(0.8 + (i % 5) * 0.15);
    dummy.rotation.y = i;
    dummy.updateMatrix();
    trees.setMatrixAt(i, dummy.matrix);
  }
  trees.instanceMatrix.needsUpdate = true;
  root.add(trees);

  if (opts.forest) {
    const pine = new THREE.ConeGeometry(1.2, 4.2, 6);
    pine.translate(0, 2.9, 0);
    const pine2 = new THREE.ConeGeometry(0.85, 3, 6);
    pine2.translate(0, 4.6, 0);
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 1.4, 5);
    trunk.translate(0, 0.7, 0);
    const crown = mergeGeometries([pine, pine2]);
    let total = 0;
    opts.forest.forEach((f) => { total += f.n; });
    const crowns = new THREE.InstancedMesh(crown, windy(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 0.012, 1.0), total);
    const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: '#4a3524' }), total);
    const tc = new THREE.Color();
    let n = 0;
    let fs = 99;
    const fr = () => ((fs = (fs * 16807) % 2147483647) / 2147483647);
    for (const f of opts.forest) {
      for (let i = 0; i < f.n; i++) {
        const a = fr() * Math.PI * 2, rr = Math.sqrt(fr()) * f.r;
        const x = f.x + Math.cos(a) * rr * (f.sx || 1), z = f.z + Math.sin(a) * rr;
        const sc = 0.8 + fr() * 0.9;
        dummy.position.set(x, field.heightAt(x, z) - 0.1, z);
        dummy.rotation.set(0, fr() * 6, 0);
        dummy.scale.set(sc, sc * (0.9 + fr() * 0.4), sc);
        dummy.updateMatrix();
        crowns.setMatrixAt(n, dummy.matrix);
        trunks.setMatrixAt(n, dummy.matrix);
        crowns.setColorAt(n, tc.set(['#27452c', '#2f5234', '#1f3a28', '#3a5a34', f.autumn ? '#b8862e' : '#2a4a30'][n % 5]));
        if (rr < f.r * 0.999 && f.solid !== false) colliders.push({ x, z, r: 0.45 * sc, kind: 'tree' });
        n++;
      }
    }
    crowns.castShadow = true;
    crowns.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    root.add(crowns, trunks);
  }

  const grassN = Math.min(5200, Math.max(2600, (q.grass ?? 1000) * 3));
  const blades = [];
  for (let k = 0; k < 3; k++) {
    const bl = new THREE.PlaneGeometry(0.07, 0.42, 1, 2);
    const bp = bl.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const yy = bp.getY(v) + 0.21;
      bp.setX(v, bp.getX(v) * (1 - yy / 0.42));      // taper to a point
      bp.setZ(v, (yy / 0.42) ** 2 * 0.08);            // slight bend
      bp.setY(v, yy);
    }
    bl.rotateY((k / 3) * Math.PI);
    bl.rotateZ((k - 1) * 0.25);
    blades.push(bl);
  }
  const tuft = mergeGeometries(blades);
  tuft.computeVertexNormals();
  const grassMat = windy(new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }), 0.085);
  const grass = new THREE.InstancedMesh(tuft, grassMat, grassN);
  const tint = new THREE.Color();
  const palette = ['#6f9a45', '#5d8a3a', '#86a84e', '#9aa556', '#b3a35c', '#4f7a33', '#7fa14a'];
  let placed = 0;
  for (let i = 0; i < grassN * 3 && placed < grassN; i++) {
    // denser near the camp and the walk to the river, thinning out
    const rr = Math.pow(Math.random(), 0.75) * 85;
    const aa = Math.random() * Math.PI * 2;
    const x = Math.cos(aa) * rr * 1.1;
    const z = Math.sin(aa) * rr + 6;
    if (Math.abs(x - riverX(z)) < 8.4) continue;
    if (pondDepth(x, z) > 0.2) continue;
    if (Math.hypot(x, z - 5) < 4.5) continue;
    const y = field.heightAt(x, z);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, Math.random() * 6, 0);
    const s = 0.6 + Math.random() * 0.9;
    dummy.scale.set(s, s * (0.7 + Math.random() * 0.7), s);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    tint.set(palette[(Math.random() * palette.length) | 0]);
    grass.setColorAt(placed, tint);
    placed++;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.receiveShadow = true;
  root.add(grass);

  // wild flowers (white daisies, yellow buttercups, blue edelweiss-ish) in loose drifts
  {
    const fl = new THREE.IcosahedronGeometry(0.06, 0);
    fl.translate(0, 0.18, 0);
    const flowers = new THREE.InstancedMesh(fl, windy(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#222222' }), 0.05), 700);
    const fc = new THREE.Color();
    let nf = 0;
    for (let d = 0; d < 26 && nf < 700; d++) {
      const cx = (Math.random() - 0.5) * 120, cz = (Math.random() - 0.5) * 100 + 6;
      if (Math.abs(cx - riverX(cz)) < 10 || Math.hypot(cx, cz - 2) < 9) continue;
      const hue = ['#f4f1e6', '#f2d24a', '#9fb4e8', '#f4f1e6'][d % 4];
      for (let k = 0; k < 28 && nf < 700; k++) {
        const x = cx + (Math.random() - 0.5) * 7, z = cz + (Math.random() - 0.5) * 7;
        if (pondDepth(x, z) > 0.1) continue;
        dummy.position.set(x, field.heightAt(x, z), z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.7 + Math.random() * 0.6);
        dummy.updateMatrix();
        flowers.setMatrixAt(nf, dummy.matrix);
        flowers.setColorAt(nf, fc.set(hue));
        nf++;
      }
    }
    flowers.count = nf;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    root.add(flowers);
  }

  let tris = 0;
  let meshes = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    const g = o.geometry;
    if (!g?.attributes?.position) return;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  const stats = {
    triangles: Math.round(tris),
    meshes,
    grass: placed,
    horses: herdN,
    gers: gersList.length,
  };
  console.info('[steppe] built', JSON.stringify(stats));

  // Soft mist banks lying at the foot of the ranges, as in the reference art.
  const mistSprites = [];
  {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const cx = 30 + Math.abs(Math.sin(i * 12.9898)) * 196;
      const cy = 24 + Math.abs(Math.sin(i * 78.233)) * 18;
      const r = 36 + Math.abs(Math.sin(i * 37.7)) * 48;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.save(); g.translate(cx, cy); g.scale(2.6, 0.5); g.translate(-cx, -cy);
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    const mistCol = new THREE.Color(mood.fog?.color || '#dfe9f4');
    mistCol.lerp(new THREE.Color('#ffffff'), 0.35);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.23;
      const r = 236 + Math.sin(i * 3.1) * 36;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: mistCol, transparent: true, depthWrite: false,
        opacity: 0.16 + Math.abs(Math.sin(i * 5.3)) * 0.1, fog: true,
      }));
      sp.position.set(Math.cos(a) * r, 8 + Math.abs(Math.sin(i * 7.7)) * 7, Math.sin(a) * r);
      sp.scale.set(170 + Math.abs(Math.sin(i * 2.2)) * 90, 26 + Math.abs(Math.sin(i * 4.4)) * 14, 1);
      sp.userData.drift = 0.4 + Math.abs(Math.sin(i * 9.1)) * 0.6;
      sp.userData.x0 = sp.position.x;
      root.add(sp);
      mistSprites.push(sp);
    }
  }

  let lastT = null;
  function update(t) {
    const dt = lastT == null ? 0.016 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    herd.forEach((h) => h.userData.update(dt, t, 0, { graze: h.userData.grazing }));
    water.material.uniforms.uTime.value = t;
    pondMats.forEach((m) => { m.uniforms.uTime.value = t; });
    clouds.forEach((c) => {
      c.position.x += c.userData.speed * 0.016;
      if (c.position.x > 420) c.position.x = -420;
    });
    for (const m of windMats) if (m.userData.windU) m.userData.windU.value = t;
    for (const m of mistSprites) m.position.x = m.userData.x0 + Math.sin(t * 0.05 * m.userData.drift) * 14;
  }

  return {
    root,
    heightAt: field.heightAt,
    colliders,
    berries,
    fish: STEPPE_FISH,
    chimneys,
    update,
    stats,
  };
}
