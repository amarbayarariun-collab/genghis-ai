// Generic NPC figure built from the sculpted characters. Men and elders use
// low-poly per-face-colour bakes of the Temujin / elder sculpts (re-dyed deel
// through the colour attribute); women use the textured Hoelun sculpt
// (re-dyed in the texture). Geometry is shared between instances.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { limbGLSL } from './temujin.js';

const MODELS = {
  temujin: { url: './models/fig_tem_npc.glb', crowd: './models/fig_tem_crowd.glb', height: 1.74 },
  elder: { url: './models/fig_eld_npc.glb', crowd: './models/fig_eld_crowd.glb', height: 1.64 },
  hoelun: { url: './models/hoelun.glb', crowd: './models/hoelun.glb', height: 1.68, textured: true },
};

const cache = {};
function load(url) {
  if (!cache[url]) {
    cache[url] = new Promise((resolve, reject) => {
      new GLTFLoader().load(url, (g) => resolve(g.scene), undefined, reject);
    });
  }
  return cache[url];
}

const _c = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };
const dyed = new Map();
/** recolour the red deel faces of a vertex-colour bake */
function dyeGeometry(geo, key, deelHex, shade) {
  const id = `${key}:${deelHex}:${shade}`;
  if (dyed.has(id)) return dyed.get(id);
  const g = geo.clone();
  const col = g.attributes.color;
  const tgt = { h: 0, s: 0, l: 0 };
  if (deelHex) new THREE.Color(deelHex).getHSL(tgt, THREE.SRGBColorSpace);
  for (let i = 0; i < col.count; i++) {
    _c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    _c.getHSL(_hsl, THREE.SRGBColorSpace);
    const red = (_hsl.h < 0.045 || _hsl.h > 0.92) && _hsl.s > 0.36 && _hsl.l > 0.05 && _hsl.l < 0.62;
    if (deelHex && red) {
      const l2 = THREE.MathUtils.clamp(tgt.l * (_hsl.l / 0.3), 0.02, 0.9);
      _c.setHSL(tgt.h, Math.min(1, tgt.s * (0.75 + _hsl.s * 0.5)), l2, THREE.SRGBColorSpace);
    }
    if (shade !== 1) _c.multiplyScalar(shade);
    col.setXYZ(i, _c.r, _c.g, _c.b);
  }
  col.needsUpdate = true;
  dyed.set(id, g);
  return g;
}

const texCache = new Map();
function dyeTexture(src, key, deelHex) {
  const id = `${key}:${deelHex}`;
  if (texCache.has(id)) return texCache.get(id);
  const img = src.image;
  const w = Math.min(1024, img.width || 1024), h = Math.min(1024, img.height || 1024);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  const data = cx.getImageData(0, 0, w, h);
  const d = data.data;
  const tgt = { h: 0, s: 0, l: 0 };
  new THREE.Color(deelHex).getHSL(tgt, THREE.SRGBColorSpace);
  const c = new THREE.Color();
  const o = { h: 0, s: 0, l: 0 };
  for (let i = 0; i < d.length; i += 4) {
    c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
    c.getHSL(o, THREE.SRGBColorSpace);
    // saturated cloth of any hue except skin tones (orange, mid lightness)
    const skin = o.h > 0.03 && o.h < 0.12 && o.l > 0.35;
    if (o.s < 0.3 || o.l < 0.06 || o.l > 0.7 || skin) continue;
    c.setHSL(tgt.h, Math.min(1, tgt.s * (0.75 + o.s * 0.5)), THREE.MathUtils.clamp(tgt.l * (o.l / 0.32), 0.02, 0.9), THREE.SRGBColorSpace);
    c.convertLinearToSRGB();
    d[i] = c.r * 255; d[i + 1] = c.g * 255; d[i + 2] = c.b * 255;
  }
  cx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = src.flipY;
  tex.colorSpace = src.colorSpace;
  tex.wrapS = src.wrapS; tex.wrapT = src.wrapT;
  tex.channel = src.channel;
  texCache.set(id, tex);
  return tex;
}

function capsule(deel, tall) {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * tall, 0.3 * tall, 0.95 * tall, 8), m(deel || '#7a2a22'));
  body.position.y = 0.6 * tall;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14 * tall, 1), m('#c48a5e'));
  head.position.y = 1.25 * tall;
  g.add(body, head);
  return g;
}

const figMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, flatShading: true });
// seated variant for riders: same leg fold as Temujin's riding pose (bakes are 1.90 tall)
const figSeatMat = figMat.clone();
figSeatMat.onBeforeCompile = (shader) => {
  shader.vertexShader = 'const float uPhase = 0.0;\nconst float uWalk = 0.0;\nconst float uBreath = 0.0;\nconst float uRide = 1.0;\n' +
    shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + limbGLSL(1.9));
};
figSeatMat.customProgramCacheKey = () => 'fig-seated';

/**
 * createFigure({ model, deel, height, shade, crowd })
 *  model: 'temujin' | 'elder' | 'hoelun'
 *  deel:  hex colour for the robe (null keeps the sculpt's colours)
 *  shade: brightness multiplier
 *  crowd: use the light LOD (background people)
 */
export function createFigure({ model = 'temujin', deel = null, height = null, shade = 1, crowd = false, still = false, seated = false } = {}) {
  const spec = MODELS[model] || MODELS.temujin;
  const H = height || spec.height;
  const group = new THREE.Group();
  group.name = `figure-${model}`;
  const ph = capsule(deel, H / 1.45);
  group.add(ph);
  group.userData.homeYaw = 0;
  group.userData.height = H;
  let body = null;
  let baseScale = 1;

  load(crowd ? spec.crowd : spec.url).then((src) => {
    let inst;
    if (spec.textured) {
      inst = src.clone(true);
      inst.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material.clone();
        const key = m.emissiveMap ? 'emissiveMap' : 'map';
        if (deel && m[key]?.image) m[key] = dyeTexture(m[key], model, deel);
        if ('metalness' in m) { m.metalness = 0; m.roughness = 0.9; }
        if (shade !== 1) {
          if (m.emissiveMap) m.emissive = new THREE.Color(shade, shade, shade);
          else m.color = new THREE.Color(shade, shade, shade);
        }
        o.material = m;
        o.castShadow = true;
      });
    } else {
      let geo = null;
      src.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
      const g = (deel || shade !== 1) ? dyeGeometry(geo, crowd ? model + 'c' : model, deel, shade) : geo;
      inst = new THREE.Mesh(g, seated ? figSeatMat : figMat);
      if (seated) inst.frustumCulled = false;
      inst.castShadow = !crowd;
    }
    const box = new THREE.Box3().setFromObject(inst);
    const size = box.getSize(new THREE.Vector3());
    baseScale = H / (size.y || 1);
    inst.scale.setScalar(baseScale);
    inst.position.set(-(box.min.x + box.max.x) / 2 * baseScale, -box.min.y * baseScale, -(box.min.z + box.max.z) / 2 * baseScale);
    group.remove(ph);
    group.add(inst);
    body = inst;
  }).catch((e) => console.warn('[figure]', model, 'failed, capsule kept', e));

  const seed = Math.random() * 10;
  group.userData.update = (dt, t, lookAt) => {
    if (body && !still) {
      body.scale.set(baseScale, baseScale * (1 + Math.sin(t * 1.6 + seed) * 0.012), baseScale);
      body.rotation.z = Math.sin(t * 1.1 + seed) * 0.02 + (group.userData.walk ? Math.sin(t * 9 + seed) * 0.05 : 0);
    }
    if (group.userData.noTurn) return;
    let want = group.userData.homeYaw;
    if (lookAt) {
      const dx = lookAt.x - group.position.x, dz = lookAt.z - group.position.z;
      if (dx * dx + dz * dz < 64) want = Math.atan2(dx, dz);
    }
    let d = want - group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    group.rotation.y += d * Math.min(1, dt * 3);
  };
  return group;
}
