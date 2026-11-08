// Daylight Onon steppe. CC0 PBR ground, broken rocky ridges, felt gers, irregular river.
// Cone trees and block horses are omitted: they read as toys and are not required for the errand.
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

const PEAKS = [
  { x: -130, z: -210, r: 42, h: 54, rot: 0.4 },
  { x: -48, z: -248, r: 36, h: 88, rot: 1.1 },
  { x: 18, z: -168, r: 18, h: 22, rot: 0.3 },
  { x: 92, z: -236, r: 48, h: 96, rot: 2.0 },
  { x: 176, z: -188, r: 28, h: 40, rot: 0.8 },
  { x: -188, z: -156, r: 26, h: 34, rot: 1.6 },
  { x: -78, z: -320, r: 64, h: 62, rot: 0.2 },
  { x: 70, z: -338, r: 54, h: 48, rot: 1.4 },
];

function smooth(e0, e1, x) {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function riverX(z) {
  return 24
    + Math.sin(z * 0.031) * 7.5
    + Math.sin(z * 0.012 + 1.2) * 3.2
    + Math.sin(z * 0.067) * 2.6
    + Math.sin(z * 0.14 + 0.5) * 1.15;
}
function bankHalf(z) {
  return 8.4 + Math.sin(z * 0.041) * 2.8 + Math.sin(z * 0.11 + 1.4) * 1.5;
}
function terrainHeight(x, z) {
  let h = Math.sin(x * 0.018) * Math.cos(z * 0.015) * 1.15
    + Math.sin((x + z) * 0.0075) * 0.55
    + Math.cos(x * 0.04 - z * 0.018) * 0.22;
  const campD = Math.hypot(x * 0.9, (z - 5) * 0.85);
  h = THREE.MathUtils.lerp(h, 0.2, (1 - smooth(10, 28, campD)) * 0.94);
  const cx = riverX(z);
  const rd = Math.abs(x - cx);
  const half = bankHalf(z);
  const channel = 1 - smooth(half * 0.35, half, rd);
  const outside = smooth(16, 24, Math.hypot(x, z - 6));
  const bed = -0.95 - Math.sin(z * 0.05) * 0.12;
  h = THREE.MathUtils.lerp(h, bed, channel * outside);
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

function pathAmt(x, z) {
  const routes = [
    [0.2, 26, 0.6, 8],
    [0.6, 8, 0.8, 2.6],
    [0.8, 2.8, 6.2, 8.2],
    [0.4, 12, 17.0, 13.2],
    [-2, 6, -12.2, 8.4],
  ];
  let m = 0;
  for (const [x1, z1, x2, z2] of routes) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len2 = dx * dx + dz * dz || 1;
    const t = THREE.MathUtils.clamp(((x - x1) * dx + (z - z1) * dz) / len2, 0, 1);
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    const d = Math.hypot(x - px, z - pz);
    const wobble = 1.15 + Math.sin(t * 9 + x1) * 0.45;
    m = Math.max(m, 1 - smooth(0.2, wobble, d));
  }
  return m * 0.72;
}

function wearAt(x, z) {
  const rd = Math.abs(x - riverX(z));
  const half = bankHalf(z);
  const shore = (1 - smooth(half * 0.75, half * 1.45, rd)) * smooth(14, 26, Math.hypot(x, z - 6));
  const bare = smooth(0.78, 0.96, Math.abs(Math.sin(x * 0.09 + 1.7) * Math.cos(z * 0.07)));
  return THREE.MathUtils.clamp(pathAmt(x, z) * 0.62 + shore * 0.9 + bare * 0.34, 0, 0.88);
}

const loader = new THREE.TextureLoader();
function loadMap(file, color) {
  const tex = loader.load(`./textures/steppe/${file}`);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
const grassDiff = loadMap('grass_diff.jpg', true);
const grassNor = loadMap('grass_nor.jpg', false);
const grassRough = loadMap('grass_rough.jpg', false);
const grassAo = loadMap('grass_ao.jpg', false);
const dryDiff = loadMap('dry_diff.jpg', true);
const dryNor = loadMap('dry_nor.jpg', false);
const dryRough = loadMap('dry_rough.jpg', false);
const dryAo = loadMap('dry_ao.jpg', false);
const cliffDiff = loadMap('cliff_diff.jpg', true);
const cliffNor = loadMap('cliff_nor.jpg', false);
const cliffRough = loadMap('cliff_rough.jpg', false);
const cliffAo = loadMap('cliff_ao.jpg', false);
const woodDiff = loadMap('wood_diff.jpg', true);
const woodNor = loadMap('wood_nor.jpg', false);
const woodRough = loadMap('wood_rough.jpg', false);
const hessNor = loadMap('hess_nor.jpg', false);
hessNor.repeat.set(9, 3);
const hessRough = loadMap('hess_rough.jpg', false);
hessRough.repeat.set(9, 3);
const ropeNor = hessNor.clone();
ropeNor.repeat.set(2, 6);

function shapeGround(geo, heightAt) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const wear = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    uv.setXY(i, x * 0.38, z * 0.38);
    wear[i] = wearAt(x, z);
  }
  geo.setAttribute('uv2', new THREE.BufferAttribute(uv.array.slice(), 2));
  geo.setAttribute('wear', new THREE.BufferAttribute(wear, 1));
  geo.computeVertexNormals();
  geo.computeTangents();
}

function groundMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    map: grassDiff,
    normalMap: grassNor,
    roughnessMap: grassRough,
    aoMap: grassAo,
    roughness: 1,
    metalness: 0,
    color: '#dce8c4',
  });
  mat.normalScale.set(1.15, 1.15);
  mat.aoMapIntensity = 0.75;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.dirtMap = { value: dryDiff };
    shader.uniforms.dirtNormal = { value: dryNor };
    shader.uniforms.dirtRough = { value: dryRough };
    shader.uniforms.dirtAo = { value: dryAo };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wear;\nvarying float vWear;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWear = wear;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vWear;\nuniform sampler2D dirtMap;\nuniform sampler2D dirtNormal;\nuniform sampler2D dirtRough;\nuniform sampler2D dirtAo;',
      )
      .replace('#include <map_fragment>', `
        vec4 grassCol = texture2D(map, vMapUv);
        vec4 dirtCol = texture2D(dirtMap, vMapUv * 0.65);
        vec4 sampledDiffuseColor = mix(grassCol, dirtCol, clamp(vWear, 0.0, 1.0));
        diffuseColor *= sampledDiffuseColor;
      `)
      .replace('#include <normal_fragment_maps>', `
        vec3 grassN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
        vec3 dirtN = texture2D(dirtNormal, vNormalMapUv * 0.65).xyz * 2.0 - 1.0;
        vec3 mapN = mix(grassN, dirtN, clamp(vWear, 0.0, 1.0));
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        float gR = texture2D(roughnessMap, vRoughnessMapUv).g;
        float dR = texture2D(dirtRough, vRoughnessMapUv * 0.65).g;
        roughnessFactor *= mix(gR, dR, clamp(vWear, 0.0, 1.0));
      `)
      .replace('#include <aomap_fragment>', `
        float gAo = texture2D(aoMap, vAoMapUv).r;
        float dAo = texture2D(dirtAo, vAoMapUv * 0.65).r;
        float ambientOcclusion = (mix(gAo, dAo, clamp(vWear, 0.0, 1.0)) - 1.0) * aoMapIntensity + 1.0;
        reflectedLight.indirectDiffuse *= ambientOcclusion;
      `);
  };
  mat.customProgramCacheKey = () => 'steppe-ground-pbr-v1';
  return mat;
}

function makePeak(radius, height, segs) {
  const geo = new THREE.ConeGeometry(radius, height, segs, 8, true);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yn = (v.y + height * 0.5) / height;
    const ang = Math.atan2(v.z, v.x);
    const ridge = Math.pow(Math.abs(Math.sin(ang * 3.0 + radius * 0.01)), 0.42);
    const gully = Math.pow(Math.abs(Math.sin(ang * 5.0 + 1.3)), 1.65);
    const n = 0.58 + ridge * 0.55 - gully * 0.34;
    const lateral = (1 - yn) * n + yn * 0.1;
    v.x *= lateral;
    v.z *= lateral;
    v.y += Math.sin(yn * 18.0 + ang * 2.0) * (1 - yn) * height * 0.018;
    if (yn > 0.78) {
      v.x += Math.sin(ang * 4.0) * radius * 0.05 * (yn - 0.78);
      v.z += Math.cos(ang * 3.0) * radius * 0.045 * (yn - 0.78);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function rockMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    map: cliffDiff,
    normalMap: cliffNor,
    roughnessMap: cliffRough,
    aoMap: cliffAo,
    roughness: 0.92,
    metalness: 0,
    color: '#b7bbb8',
  });
  mat.aoMapIntensity = 0.65;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRockScale = { value: 0.035 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWpos;\nvarying vec3 vWnormal;')
      .replace('#include <project_vertex>', `
        #include <project_vertex>
        vec4 iPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          iPos = instanceMatrix * iPos;
        #endif
        vWpos = (modelMatrix * iPos).xyz;
        vec3 iN = objectNormal;
        #ifdef USE_INSTANCING
          iN = mat3(instanceMatrix) * iN;
        #endif
        vWnormal = normalize(mat3(modelMatrix) * iN);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWpos;\nvarying vec3 vWnormal;\nuniform float uRockScale;')
      .replace('#include <map_fragment>', `
        vec3 bn = abs(normalize(vWnormal));
        bn /= (bn.x + bn.y + bn.z + 1e-4);
        vec3 col = texture2D(map, vWpos.zy * uRockScale).rgb * bn.x
          + texture2D(map, vWpos.xz * uRockScale).rgb * bn.y
          + texture2D(map, vWpos.xy * uRockScale).rgb * bn.z;
        float luma = dot(col, vec3(0.30, 0.59, 0.11));
        col = mix(vec3(luma), col, 0.22);
        vec4 sampledDiffuseColor = vec4(col, 1.0);
        diffuseColor *= sampledDiffuseColor;
      `)
      .replace('#include <normal_fragment_maps>', `
        vec3 bn2 = abs(normalize(vWnormal));
        bn2 /= (bn2.x + bn2.y + bn2.z + 1e-4);
        vec3 tx = texture2D(normalMap, vWpos.zy * uRockScale).xyz * 2.0 - 1.0;
        vec3 ty = texture2D(normalMap, vWpos.xz * uRockScale).xyz * 2.0 - 1.0;
        vec3 tz = texture2D(normalMap, vWpos.xy * uRockScale).xyz * 2.0 - 1.0;
        vec3 perturb = vec3(tx.x * bn2.x + tz.x * bn2.z, ty.y * bn2.y, tx.y * bn2.x + ty.x * bn2.y);
        normal = normalize(normal + perturb * 0.55);
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness * texture2D(roughnessMap, vWpos.xz * uRockScale).g;
      `)
      .replace('#include <aomap_fragment>', `
        float ambientOcclusion = (texture2D(aoMap, vWpos.xz * uRockScale).r - 1.0) * aoMapIntensity + 1.0;
        reflectedLight.indirectDiffuse *= ambientOcclusion;
      `);
  };
  mat.customProgramCacheKey = () => 'steppe-rock-pbr-v1';
  return mat;
}

function waterSurface() {
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const z = 90 - i * 3.15;
    const ox = Math.sin(i * 0.47) * 1.6 + Math.sin(i * 0.13) * 2.2;
    pts.push(new THREE.Vector3(riverX(z) + ox, -0.42, z));
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
    const w = bankHalf(p.z) * 0.42 + Math.sin(i * 0.63) * 1.1;
    const yL = p.y + Math.sin(i * 0.9) * 0.03;
    const yR = p.y + Math.cos(i * 0.7) * 0.03;
    positions.push(p.x + nx * w, yL, p.z + nz * w, p.x - nx * w, yR, p.z - nz * w);
    const v = i / (pts.length - 1);
    uvs.push(0, v * 6, 1, v * 6);
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
      fogColor: { value: new THREE.Color('#c5d0da') },
      fogDensity: { value: 0.0022 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      uniform vec3 fogColor;
      uniform float fogDensity;
      void main() {
        float rip = sin(vUv.y * 46.0 + uTime * 0.55) * sin(vUv.x * 14.0 - uTime * 0.3);
        float rip2 = sin(vUv.y * 18.0 - uTime * 0.22 + vUv.x * 6.0);
        vec3 n = normalize(vec3(rip * 0.07, 1.0, rip2 * 0.05));
        vec3 sunDir = normalize(vec3(0.42, 0.78, 0.22));
        float ndl = clamp(dot(n, sunDir), 0.0, 1.0);
        vec3 deep = vec3(0.11, 0.16, 0.15);
        vec3 midc = vec3(0.30, 0.36, 0.32);
        vec3 col = mix(deep, midc, 0.32 + ndl * 0.4);
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        col = mix(vec3(0.40, 0.38, 0.31), col, edge);
        float fogF = 1.0 - exp(-fogDensity * fogDensity * dot(vWorld, vWorld));
        col = mix(col, fogColor, clamp(fogF, 0.0, 0.72));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'onon';
  mesh.renderOrder = 1;
  return mesh;
}

function bankRocks(heightAt, material, count) {
  const geo = new THREE.IcosahedronGeometry(0.55, 0);
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.name = 'bank-rocks';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < count * 4 && n < count; i++) {
    const z = 70 - (i * 2.7);
    const side = i % 2 === 0 ? 1 : -1;
    const half = bankHalf(z);
    const x = riverX(z) + side * (half * 0.72 + ((i * 17) % 5) * 0.35);
    if (Math.hypot(x - STEPPE_FISH.x, z - STEPPE_FISH.z) < 3.2) continue;
    const y = heightAt(x, z);
    dummy.position.set(x, y + 0.05, z);
    dummy.rotation.set(i * 0.7, i * 0.4, i * 0.2);
    const s = 0.35 + (i % 5) * 0.18;
    dummy.scale.set(s * 1.4, s * 0.55, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

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
  const geo = new THREE.CylinderGeometry(r, r * 0.85, len, 5);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  list.push(geo);
}
function safeTangents(geo) {
  try {
    geo.computeTangents();
  } catch (err) {
    console.warn('[steppe] tangents skipped', err);
  }
}

function makeGer(scale) {
  const felt = [];
  const wood = [];
  const ropes = [];
  const R = 3.35 * scale;
  const wallH = 1.52 * scale;
  const roofH = 1.02 * scale;
  put(felt, new THREE.CylinderGeometry(R * 0.98, R, wallH, 24, 1, true), 0, wallH * 0.5, 0);
  put(felt, new THREE.ConeGeometry(R * 1.06, roofH, 24), 0, wallH + roofH * 0.38, 0);
  put(felt, new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, 0.16 * scale, 10), 0, wallH + roofH * 0.86, 0);

  const crownY = wallH + roofH * 0.9;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pole(
      ropes,
      Math.sin(a) * 0.26 * scale, crownY, Math.cos(a) * 0.26 * scale,
      Math.sin(a) * R * 1.03, wallH + 0.02 * scale, Math.cos(a) * R * 1.03,
      0.016 * scale,
    );
  }
  put(wood, new THREE.TorusGeometry(0.34 * scale, 0.045 * scale, 6, 14), 0, crownY, 0, Math.PI / 2, 0, 0);
  put(wood, new THREE.CylinderGeometry(0.07 * scale, 0.09 * scale, 0.42 * scale, 8), 0.7 * scale, wallH + roofH * 0.55, -0.25 * scale);

  const doorZ = R * 0.97;
  put(wood, new THREE.BoxGeometry(1.35 * scale, 1.48 * scale, 0.07 * scale), 0, 0.76 * scale, doorZ);
  put(wood, new THREE.BoxGeometry(0.08 * scale, 1.48 * scale, 0.09 * scale), -0.64 * scale, 0.76 * scale, doorZ + 0.02);
  put(wood, new THREE.BoxGeometry(0.08 * scale, 1.48 * scale, 0.09 * scale), 0.64 * scale, 0.76 * scale, doorZ + 0.02);
  put(wood, new THREE.BoxGeometry(1.4 * scale, 0.08 * scale, 0.1 * scale), 0, 1.48 * scale, doorZ + 0.02);
  put(wood, new THREE.BoxGeometry(0.52 * scale, 1.22 * scale, 0.045 * scale), -0.28 * scale, 0.72 * scale, doorZ + 0.06);
  put(wood, new THREE.BoxGeometry(0.52 * scale, 1.22 * scale, 0.045 * scale), 0.28 * scale, 0.72 * scale, doorZ + 0.06);
  put(wood, new THREE.BoxGeometry(1.2 * scale, 0.06 * scale, 0.36 * scale), 0, 0.04 * scale, doorZ + 0.16);

  const feltGeo = mergeGeometries(felt);
  const woodGeo = mergeGeometries(wood);
  const ropeGeo = mergeGeometries(ropes);
  feltGeo.computeVertexNormals();
  woodGeo.computeVertexNormals();
  ropeGeo.computeVertexNormals();
  safeTangents(feltGeo);
  safeTangents(woodGeo);
  safeTangents(ropeGeo);

  const feltMat = new THREE.MeshStandardMaterial({
    color: '#e7e1d4',
    normalMap: hessNor,
    roughnessMap: hessRough,
    roughness: 0.94,
    metalness: 0,
  });
  feltMat.normalScale.set(0.45, 0.45);
  const bandMat = feltMat.clone();
  bandMat.color.set('#c9c0af');
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodDiff,
    normalMap: woodNor,
    roughnessMap: woodRough,
    roughness: 0.84,
    metalness: 0,
    color: '#c9a27a',
  });
  woodMat.normalScale.set(0.8, 0.8);
  const ropeMat = new THREE.MeshStandardMaterial({
    color: '#6a5140',
    normalMap: ropeNor,
    roughnessMap: hessRough,
    roughness: 0.9,
    metalness: 0,
  });
  ropeMat.normalScale.set(0.7, 0.7);
  const pipeMat = new THREE.MeshStandardMaterial({ color: '#3c3a38', roughness: 0.72, metalness: 0.08 });

  const feltMesh = new THREE.Mesh(feltGeo, feltMat);
  const woodMesh = new THREE.Mesh(woodGeo, woodMat);
  const ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.012, R * 1.012, 0.16 * scale, 24), bandMat);
  band.position.y = 0.2 * scale;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.08 * scale, 0.38 * scale, 8), pipeMat);
  pipe.position.set(0.55 * scale, wallH + roofH * 0.62, -0.15 * scale);
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(0.62 * scale, 1.05 * scale, 0.04 * scale),
    new THREE.MeshStandardMaterial({ color: '#1c1916', roughness: 0.9, metalness: 0 }),
  );
  opening.position.set(0, 0.68 * scale, doorZ + 0.02);
  feltMesh.castShadow = woodMesh.castShadow = ropeMesh.castShadow = true;
  feltMesh.receiveShadow = woodMesh.receiveShadow = band.receiveShadow = true;
  const group = new THREE.Group();
  group.add(feltMesh, woodMesh, ropeMesh, band, pipe, opening);
  group.name = 'ger';
  return group;
}

function bush() {
  const leaves = [];
  const berries = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.SphereGeometry(0.38, 7, 6);
    geo.scale(1, 0.72, 1);
    geo.translate((i - 1.5) * 0.28, 0.32 + (i % 2) * 0.12, (i % 2) * 0.15);
    leaves.push(geo);
  }
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.SphereGeometry(0.055, 5, 4);
    geo.translate(Math.sin(i) * 0.32, 0.35 + (i % 3) * 0.1, Math.cos(i) * 0.28);
    berries.push(geo);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(leaves), new THREE.MeshStandardMaterial({ color: '#3c5534', roughness: 0.92 })));
  g.add(new THREE.Mesh(mergeGeometries(berries), new THREE.MeshStandardMaterial({ color: '#6e3034', roughness: 0.7 })));
  g.name = 'berry-bush';
  return g;
}

function skyShader() {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#3a679f') },
      mid: { value: new THREE.Color('#8eb0cc') },
      horizon: { value: new THREE.Color('#dfe8ee') },
      ground: { value: new THREE.Color('#8b907c') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top, mid, horizon, ground;
      void main(){
        float h = normalize(vPos).y;
        vec3 c;
        if (h > 0.32) c = mix(mid, top, pow((h - 0.32) / 0.68, 0.85));
        else if (h > 0.0) c = mix(horizon, mid, h / 0.32);
        else c = mix(horizon, ground, pow(clamp(-h, 0.0, 1.0), 0.6));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
}

export function buildSteppeEnvironment(scene, opts = {}) {
  const q = opts.quality || {};
  const shadows = opts.shadows !== false;
  const tier = q.id || 'med';
  const root = new THREE.Group();
  root.name = 'steppe-environment';
  scene.add(root);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 28, 16), skyShader());
  root.add(sky);
  scene.background = new THREE.Color('#9ebad0');
  const fogDensity = 0.00215 * (q.fogDensityScale ?? 1);
  scene.fog = new THREE.FogExp2('#c5d0da', fogDensity);

  const field = buildHeightfield();
  const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, GRID - 1, GRID - 1);
  groundGeo.rotateX(-Math.PI / 2);
  shapeGround(groundGeo, field.heightAt);
  const ground = new THREE.Mesh(groundGeo, groundMaterial());
  ground.receiveShadow = shadows;
  ground.name = 'steppe-ground';
  root.add(ground);

  const water = waterSurface();
  water.material.uniforms.fogDensity.value = fogDensity;
  root.add(water);

  const rock = rockMaterial();
  const peakSeg = tier === 'low' ? 12 : 18;
  PEAKS.forEach((p) => {
    const mesh = new THREE.Mesh(makePeak(p.r, p.h, peakSeg), rock);
    mesh.position.set(p.x, p.h * 0.5 - 6, p.z);
    mesh.rotation.y = p.rot;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.name = 'ridge';
    root.add(mesh);
  });

  const rockN = tier === 'low' ? 16 : tier === 'high' ? 48 : 32;
  root.add(bankRocks(field.heightAt, rock, rockN));

  const clouds = [];
  const cloudN = Math.max(3, Math.round((q.clouds ?? 6) * 0.7));
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#f3f5f6', transparent: true, opacity: 0.82, depthWrite: false });
  for (let i = 0; i < cloudN; i++) {
    const puffs = [];
    const puffN = 4 + (i % 3);
    for (let j = 0; j < puffN; j++) {
      const geo = new THREE.SphereGeometry(9 + (j % 3) * 4, 8, 6);
      geo.scale(1.6, 0.32, 1.05);
      geo.translate(j * 11 - 18, (j % 2) * 1.2, (j - 2) * 4);
      puffs.push(geo);
    }
    const c = new THREE.Mesh(mergeGeometries(puffs), cloudMat);
    c.position.set(-120 + (i % 4) * 70, 62 + (i % 3) * 10, -40 - (i % 4) * 22);
    c.userData.speed = 0.45 + (i % 3) * 0.2;
    root.add(c);
    clouds.push(c);
  }

  const colliders = [];
  GERS.forEach((g) => {
    const ger = makeGer(g.s);
    ger.position.set(g.x, field.heightAt(g.x, g.z), g.z);
    ger.rotation.y = g.rot;
    root.add(ger);
    colliders.push({ x: g.x, z: g.z, r: 3.05 * g.s, kind: 'ger' });
  });

  const berries = STEPPE_BERRIES.map((b) => ({ ...b }));
  berries.forEach((b) => {
    const bushMesh = bush();
    bushMesh.position.set(b.x, field.heightAt(b.x, b.z), b.z);
    root.add(bushMesh);
  });

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
    grass: 0,
    horses: 0,
    gers: GERS.length,
    peaks: PEAKS.length,
    rocks: rockN,
  };
  console.info('[steppe] built', JSON.stringify(stats));

  function update(t) {
    water.material.uniforms.uTime.value = t;
    clouds.forEach((c) => {
      c.position.x += c.userData.speed * 0.016;
      if (c.position.x > 240) c.position.x = -240;
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
