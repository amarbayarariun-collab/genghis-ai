// Daylight Onon steppe. Procedural geometry only: green plain, gray ridges, river, felt gers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SIZE = 460;
const GRID = 161;
const HALF = SIZE / 2;

export const STEPPE_FISH = { x: 17.4, z: 13.2 };
export const STEPPE_BERRIES = [
  { x: -12.2, z: 8.4 },
  { x: 5.6, z: 18.2 },
  { x: 8.8, z: -1.2 },
];
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
  const campD = Math.hypot(x * 0.9, (z - 5) * 0.85);
  h = THREE.MathUtils.lerp(h, 0.2, (1 - smooth(10, 28, campD)) * 0.94);
  const rd = Math.abs(x - riverX(z));
  const channel = 1 - smooth(5.5, 12, rd);
  const outside = smooth(16, 24, Math.hypot(x, z - 6));
  h = THREE.MathUtils.lerp(h, -0.85, channel * outside);
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
  const grassA = new THREE.Color('#4f7d38');
  const grassB = new THREE.Color('#6d9a45');
  const grassC = new THREE.Color('#3c642c');
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
    _c.copy(grassA).lerp(grassB, n * 0.65).lerp(grassC, Math.max(0, y) * 0.15);
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
  const dark = new THREE.Color('#5c6168');
  const light = new THREE.Color('#b7b2a8');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const across = 1 - smooth(0, depth * 0.42, Math.abs(z));
    const crest = Math.pow(across, 0.45);
    const noise = Math.sin(x * 0.031) * 8 + Math.sin(x * 0.012 + 2) * 14
      + Math.abs(Math.sin(x * 0.09 + z * 0.2)) * 6;
    const y = crest * (place.peak + noise) + (1 - crest) * 1.5;
    pos.setY(i, y);
    const band = Math.sin(y * 0.55 + x * 0.02) * 0.5 + 0.5;
    _c.copy(rock).lerp(light, band * 0.55).lerp(dark, (1 - crest) * 0.45 + (band < 0.35 ? 0.35 : 0));
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.set(place.x, 0, place.z);
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
      fogColor: { value: new THREE.Color('#c5d8ea') },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vDist = length(w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying float vDist;
      uniform float uTime;
      uniform vec3 fogColor;
      void main() {
        float rip = sin(vUv.y * 18.0 + uTime * 1.4) * 0.5 + sin(vUv.x * 28.0 - uTime * 0.8) * 0.5;
        vec3 deep = vec3(0.05, 0.24, 0.38);
        vec3 midc = vec3(0.20, 0.52, 0.62);
        vec3 col = mix(deep, midc, 0.35 + rip * 0.2);
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
        col = mix(vec3(0.45, 0.62, 0.55), col, edge);
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

function makeGer(scale) {
  const felt = [];
  const wood = [];
  const R = 3.15 * scale;
  const wallH = 1.62 * scale;
  put(felt, new THREE.CylinderGeometry(R, R * 1.02, wallH, 22), 0, wallH * 0.5, 0);
  put(felt, new THREE.ConeGeometry(R * 1.16, 1.2 * scale, 22), 0, wallH + 0.55 * scale, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.sin(a) * R;
    const z = Math.cos(a) * R;
    put(felt, new THREE.BoxGeometry(0.045 * scale, wallH * 0.92, 0.02), x, wallH * 0.48, z, 0, -a, 0);
    pole(wood, Math.sin(a) * 0.42 * scale, wallH + 1.05 * scale, Math.cos(a) * 0.42 * scale, Math.sin(a) * R * 1.05, wallH * 0.98, Math.cos(a) * R * 1.05, 0.025 * scale);
  }
  put(wood, new THREE.TorusGeometry(0.42 * scale, 0.06 * scale, 6, 12), 0, wallH + 1.08 * scale, 0, Math.PI / 2, 0, 0);
  put(wood, new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 0.55 * scale, 8), 0.85 * scale, wallH + 0.95 * scale, -0.35 * scale);
  const doorZ = R * 0.98;
  put(wood, new THREE.BoxGeometry(1.55 * scale, 1.7 * scale, 0.08 * scale), 0, 0.86 * scale, doorZ);
  put(wood, new THREE.BoxGeometry(0.42 * scale, 1.28 * scale, 0.06 * scale), -0.24 * scale, 0.78 * scale, doorZ + 0.07, 0, 0.15, 0);
  put(wood, new THREE.BoxGeometry(0.42 * scale, 1.28 * scale, 0.06 * scale), 0.26 * scale, 0.78 * scale, doorZ + 0.07, 0, -0.5, 0);
  put(wood, new THREE.BoxGeometry(0.5 * scale, 0.035 * scale, 0.02), -0.24 * scale, 0.95 * scale, doorZ + 0.11, 0, 0.15, 0.7);
  put(wood, new THREE.BoxGeometry(0.5 * scale, 0.035 * scale, 0.02), 0.26 * scale, 0.95 * scale, doorZ + 0.11, 0, -0.5, -0.7);
  put(wood, new THREE.BoxGeometry(1.15 * scale, 0.08 * scale, 0.42 * scale), 0, 0.05 * scale, doorZ + 0.18);
  const group = new THREE.Group();
  const feltMesh = new THREE.Mesh(mergeGeometries(felt), new THREE.MeshLambertMaterial({ color: '#f4efe6' }));
  const woodMesh = new THREE.Mesh(mergeGeometries(wood), new THREE.MeshLambertMaterial({ color: '#8a5a32' }));
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.28 * scale, 22),
    new THREE.MeshLambertMaterial({ map: bandTexture(), color: '#ffffff' }),
  );
  band.position.y = 0.22 * scale;
  feltMesh.castShadow = woodMesh.castShadow = true;
  feltMesh.receiveShadow = woodMesh.receiveShadow = band.receiveShadow = true;
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(0.72 * scale, 1.2 * scale, 0.08 * scale),
    new THREE.MeshLambertMaterial({ color: '#1a1714' }),
  );
  opening.position.set(0, 0.72 * scale, doorZ + 0.01);
  group.add(feltMesh, woodMesh, band, opening);
  group.name = 'ger';
  return group;
}

function bush() {
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
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top, mid, horizon, ground;
      void main(){
        float h = normalize(vPos).y;
        vec3 c;
        if (h > 0.35) c = mix(mid, top, pow((h - 0.35) / 0.65, 0.8));
        else if (h > 0.02) c = mix(horizon, mid, (h - 0.02) / 0.33);
        else c = mix(horizon, ground, pow(clamp(-h, 0.0, 1.0), 0.55));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

export function buildSteppeEnvironment(scene, opts = {}) {
  const q = opts.quality || {};
  const shadows = opts.shadows !== false;
  const root = new THREE.Group();
  root.name = 'steppe-environment';
  scene.add(root);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 28, 18), skyShader());
  root.add(sky);
  scene.background = new THREE.Color('#8ec4ee');
  scene.fog = new THREE.FogExp2('#c5d8ea', 0.00135 * (q.fogDensityScale ?? 1));

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

  root.add(ridgeMesh(780, 70, 96, 8, { x: 0, z: -190, rot: 0.02, peak: 48 }));
  root.add(ridgeMesh(860, 80, 72, 6, { x: -30, z: -250, rot: -0.03, peak: 72 }));
  root.add(ridgeMesh(280, 70, 28, 5, { x: 210, z: 20, rot: 0.15, peak: 26 }));
  root.add(ridgeMesh(240, 60, 24, 4, { x: -200, z: 10, rot: -0.1, peak: 18 }));

  const clouds = [];
  const cloudN = Math.max(4, q.clouds ?? 8);
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#f7f8f6', transparent: true, opacity: 0.92, depthWrite: false });
  for (let i = 0; i < cloudN; i++) {
    const puffs = [];
    for (let j = 0; j < 5; j++) {
      const geo = new THREE.SphereGeometry(7 + (j % 3) * 3, 8, 6);
      geo.scale(1.3, 0.55, 1);
      geo.translate(j * 8 - 16, (j % 2) * 2, (j - 2) * 3);
      puffs.push(geo);
    }
    const c = new THREE.Mesh(mergeGeometries(puffs), cloudMat);
    c.position.set(-90 + (i % 4) * 55, 48 + (i % 3) * 8, -30 - (i % 3) * 28);
    c.userData.speed = 0.6 + (i % 3) * 0.25;
    root.add(c);
    clouds.push(c);
  }

  const colliders = [];
  GERS.forEach((g) => {
    const ger = makeGer(g.s);
    ger.position.set(g.x, field.heightAt(g.x, g.z), g.z);
    ger.rotation.y = g.rot;
    root.add(ger);
    colliders.push({ x: g.x, z: g.z, r: 2.85 * g.s, kind: 'ger' });
  });

  const berries = STEPPE_BERRIES.map((b) => ({ ...b }));
  berries.forEach((b) => {
    const bushMesh = bush();
    bushMesh.position.set(b.x, field.heightAt(b.x, b.z), b.z);
    root.add(bushMesh);
  });

  const herdN = Math.min(7, q.herd ?? 6);
  const colors = ['#6a4328', '#2a211c', '#8a6840', '#4a3428', '#c2a36a'];
  for (let i = 0; i < herdN; i++) {
    const x = 33 + (i % 3) * 2.2;
    const z = -18 + Math.floor(i / 3) * 2.4;
    const horse = horseMesh(colors[i % colors.length]);
    horse.position.set(x, field.heightAt(x, z), z);
    horse.rotation.y = -0.8 + (i % 4) * 0.4;
    horse.scale.setScalar(0.85);
    root.add(horse);
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

  const grassN = Math.min(2400, Math.max(900, (q.grass ?? 1000) + 500));
  const blade = new THREE.ConeGeometry(0.045, 0.22, 3);
  blade.translate(0, 0.11, 0);
  const grass = new THREE.InstancedMesh(
    blade,
    new THREE.MeshLambertMaterial({ color: '#ffffff' }),
    grassN,
  );
  const tint = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < grassN * 3 && placed < grassN; i++) {
    const x = (Math.random() - 0.5) * 150;
    const z = (Math.random() - 0.5) * 120 + 4;
    if (Math.abs(x - riverX(z)) < 6 && Math.hypot(x, z - 6) > 20) continue;
    if (Math.hypot(x, z - 5) < 4.5) continue;
    const y = field.heightAt(x, z);
    dummy.position.set(x, y + 0.22, z);
    dummy.rotation.set(0, Math.random() * 6, 0);
    const s = 0.7 + Math.random() * 0.8;
    dummy.scale.set(s, s * (0.8 + Math.random() * 0.5), s);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    tint.set(['#7eae58', '#5f933c', '#8fbf62', '#4f7d34'][placed % 4]);
    grass.setColorAt(placed, tint);
    placed++;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  root.add(grass);

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
    gers: GERS.length,
  };
  console.info('[steppe] built', JSON.stringify(stats));

  function update(t) {
    water.material.uniforms.uTime.value = t;
    clouds.forEach((c) => {
      c.position.x += c.userData.speed * 0.016;
      if (c.position.x > 220) c.position.x = -220;
    });
  }

  return {
    root,
    heightAt: field.heightAt,
    colliders,
    berries,
    fish: STEPPE_FISH,
    update,
    stats,
  };
}
