// Shared Mixamo body pipeline for every human character.
//
// The base body is the user's Mixamo mannequin (character.fbx -> temujin_base.glb,
// textures stripped), embedded ONCE as base64 in temujinBaseData.js and parsed ONCE
// (GLTFLoader.parse — the hosted artifact blocks fetch() of data: URLs).
// Each character gets its own SkeletonUtils clone with its own geometry copy, so
// per-character vertex painting does not leak between characters.
//
// mountMixamoBody(group, { height, placeholder, onReady }) clones + scales the body,
// swaps out the placeholder and calls onReady(ctx) with:
//   ctx.model, ctx.group, ctx.bone(name), ctx.m (bind-pose joint positions in
//   group space), ctx.H (head height), ctx.pin(boneName, obj, localPos, localQuat),
//   ctx.paint(fn), ctx.frontZ/backZ/halfWidth samplers over the body surface.
// makeRig(ctx) gives a pose applier that works in CHARACTER axes (+Z forward, +Y up,
// +X = character's left) relative to the bind T-pose.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TEMUJIN_BASE_B64 } from './temujinBaseData.js';

export const MX = (n) => 'mixamorig1' + n; // GLTFLoader already stripped the ':'

let basePromise = null;
export function loadBaseBody() {
  if (!basePromise) {
    basePromise = new Promise((resolve, reject) => {
      const bin = atob(TEMUJIN_BASE_B64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      new GLTFLoader().parse(bytes.buffer, '', (g) => resolve(g.scene), reject);
    });
  }
  return basePromise;
}

export const lambert = (c, flat = true) => new THREE.MeshLambertMaterial({ color: c, flatShading: flat });

export function mountMixamoBody(group, { height, placeholder, onReady }) {
  loadBaseBody().then((base) => {
    let model = null;
    try {
      model = cloneSkinned(base);
      model.traverse((o) => {
        if (o.isMesh) {
          o.geometry = o.geometry.clone(); // own copy: painting must not leak to other characters
          o.frustumCulled = false;
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      model.scale.setScalar(height / (box.getSize(new THREE.Vector3()).y || 1));
      const b2 = new THREE.Box3().setFromObject(model);
      const c = b2.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -b2.min.y, -c.z);
      if (placeholder) group.remove(placeholder);
      group.add(model);
      group.updateMatrixWorld(true);
      onReady(makeContext(model, group, height));
    } catch (e) {
      console.error('[mixamo] character setup failed, keeping placeholder', e);
      if (model) group.remove(model);
      if (placeholder && !placeholder.parent) group.add(placeholder);
    }
  }, (e) => console.warn('[mixamo] base GLB failed, keeping placeholder', e));
}

function makeContext(model, group, height) {
  const gInv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const gq = group.getWorldQuaternion(new THREE.Quaternion());
  const bone = (n) => model.getObjectByName(MX(n));
  const P = (n) => bone(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(gInv);
  const names = {
    head: 'Head', top: 'HeadTop_End', neck: 'Neck', chest: 'Spine2', spine1: 'Spine1', spine: 'Spine', hips: 'Hips',
    shL: 'LeftArm', shR: 'RightArm', elL: 'LeftForeArm', elR: 'RightForeArm', wrL: 'LeftHand', wrR: 'RightHand',
    hipL: 'LeftUpLeg', hipR: 'RightUpLeg', knL: 'LeftLeg', knR: 'RightLeg', anL: 'LeftFoot', anR: 'RightFoot',
    toeL: 'LeftToeBase', toeR: 'RightToeBase', tipL: 'LeftToe_End', tipR: 'RightToe_End',
  };
  const m = {};
  for (const k in names) m[k] = P(names[k]);
  const H = m.top.y - m.head.y;
  const k = height / 1.72; // proportions are tuned at 1.72 m

  let mesh = null;
  model.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const pos = mesh.geometry.attributes.position;
  const N = pos.count;
  const pts = new Float32Array(N * 3);
  const mw = new THREE.Matrix4().multiplyMatrices(gInv, mesh.matrixWorld);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mw);
    pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
  }
  const scan = (y, dy, xMax, fn) => {
    for (let i = 0; i < N; i++) {
      const x = pts[i * 3], yy = pts[i * 3 + 1], z = pts[i * 3 + 2];
      if (Math.abs(yy - y) < dy && Math.abs(x) < xMax) fn(x, yy, z);
    }
  };
  const frontZ = (y, dy, xMax) => { let r = -Infinity; scan(y, dy, xMax, (x, yy, z) => { if (z > r) r = z; }); return r; };
  const backZ = (y, dy, xMax) => { let r = Infinity; scan(y, dy, xMax, (x, yy, z) => { if (z < r) r = z; }); return r; };
  const halfWidth = (y, dy, xMax) => { let r = 0; scan(y, dy, xMax, (x) => { if (Math.abs(x) > r) r = Math.abs(x); }); return r; };

  const pin = (boneName, obj, localPos, localQuat) => {
    obj.position.copy(localPos).applyMatrix4(group.matrixWorld);
    obj.quaternion.copy(gq);
    if (localQuat) obj.quaternion.multiply(localQuat);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    bone(boneName).attach(obj); // attach keeps the WORLD pose, so we positioned in world space above
    return obj;
  };

  const paint = (fn) => {
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      fn(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mesh.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  };

  return { model, group, bone, m, H, k, pin, paint, frontZ, backZ, halfWidth, gq, gInv };
}

// Jitter + merge so low-poly fur stays closed after displacement.
export function lumpy(geo, amt) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const p = geo.attributes.position;
  // weld first so shared corners move together
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!map.has(key)) map.set(key, [(Math.random() - 0.5) * amt, (Math.random() - 0.5) * amt, (Math.random() - 0.5) * amt]);
    const d = map.get(key);
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

// A cylinder whose axis runs from a to b (group space). Returns { mesh, mid, quat }.
export function tubeBetween(a, b, rA, rB, mat, seg = 7) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, seg), mat);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return { mesh, mid: a.clone().add(b).multiplyScalar(0.5), quat };
}

// A chain of small octahedra from p0 through p1 to p2 (a braid), ending in a tassel.
export function braid(p0, p1, p2, r, hairMat, tipMat, ringMat, rings = 0) {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  const n = Math.max(5, Math.round(curve.getLength() / (r * 1.7)));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t), d = curve.getTangent(t);
    const seg = new THREE.Mesh(new THREE.OctahedronGeometry(r * (1 - t * 0.35), 0), hairMat);
    seg.scale.y = 1.35;
    seg.position.copy(p);
    seg.quaternion.setFromUnitVectors(up, d);
    seg.rotation.y += (i % 2) * 0.6;
    g.add(seg);
    if (ringMat && rings && i > 0 && i % Math.round(n / (rings + 1)) === 0) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, r * 0.7, 8), ringMat);
      ring.position.copy(p);
      ring.quaternion.setFromUnitVectors(up, d);
      g.add(ring);
    }
  }
  const end = curve.getPoint(1), dEnd = curve.getTangent(1);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r * 1.0, r * 3.2, 6), tipMat);
  tip.position.copy(end).addScaledVector(dEnd, r * 1.6);
  tip.quaternion.setFromUnitVectors(up, dEnd.clone().negate());
  g.add(tip);
  return g;
}

// ---- rig: pose the skeleton in character axes ----
const AX = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
export const ZERO_POSE = {
  lfwd: 0, lknee: 0, lspread: 0, lfoot: 0, rfwd: 0, rknee: 0, rspread: 0, rfoot: 0,
  ladown: 1.25, lafwd: 0, laIn: 0, labend: 0, radown: 1.25, rafwd: 0, raIn: 0, rabend: 0,
  twist: 0, lean: 0, chest: 0, neckYaw: 0, headYaw: 0, headPitch: 0, lift: 0,
  lsk: 0, rsk: 0, skOut: 0, // skirt halves: forward swing (rad) and outward spread
};

export function makeRig(ctx) {
  const { model, group, gq } = ctx;
  const gqInv = gq.clone().invert();
  const joints = {};
  const register = (key, obj) => {
    const wq = gqInv.clone().multiply(obj.getWorldQuaternion(new THREE.Quaternion()));
    joints[key] = { obj, rest: obj.quaternion.clone(), inv: wq.invert() };
  };
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
    'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot']) {
    const b = ctx.bone(n);
    if (b) register(n, b);
  }
  // hips lift: parent-local offset for +1 m straight up in character space
  const hips = ctx.bone('Hips');
  const hipsRest = hips.position.clone();
  const w0 = hips.getWorldPosition(new THREE.Vector3());
  const up1 = w0.clone().add(new THREE.Vector3(0, 1, 0).applyQuaternion(gq));
  const perMeter = hips.parent.worldToLocal(up1.clone()).sub(hips.parent.worldToLocal(w0.clone()));

  const tq = new THREE.Quaternion(), ax = new THREE.Vector3();
  // rotations listed outermost-first, angles about CHARACTER axes at bind pose
  const set = (key, rots) => {
    const j = joints[key];
    if (!j) return;
    j.obj.quaternion.copy(j.rest);
    for (const [a, ang] of rots) {
      if (!ang) continue;
      ax.copy(AX[a]).applyQuaternion(j.inv);
      j.obj.quaternion.multiply(tq.setFromAxisAngle(ax, ang));
    }
  };
  const apply = (P) => {
    set('LeftUpLeg', [['Y', P.lspread], ['X', -P.lfwd]]);
    set('RightUpLeg', [['Y', -P.rspread], ['X', -P.rfwd]]);
    set('LeftLeg', [['X', P.lknee]]);
    set('RightLeg', [['X', P.rknee]]);
    set('LeftFoot', [['X', P.lfoot]]);
    set('RightFoot', [['X', P.rfoot]]);
    set('LeftArm', [['Y', P.laIn], ['X', -P.lafwd], ['Z', -P.ladown]]);
    set('RightArm', [['Y', -P.raIn], ['X', -P.rafwd], ['Z', P.radown]]);
    set('LeftForeArm', [['Y', -P.labend]]);
    set('RightForeArm', [['Y', P.rabend]]);
    set('Spine', [['Y', P.twist], ['X', P.lean]]);
    set('Spine2', [['X', P.chest]]);
    set('Neck', [['Y', P.neckYaw]]);
    set('Head', [['Y', P.headYaw], ['X', P.headPitch]]);
    hips.position.copy(hipsRest).addScaledVector(perMeter, P.lift);
    set('skirtL', [['Z', P.skOut], ['X', -P.lsk]]);
    set('skirtR', [['Z', -P.skOut], ['X', -P.rsk]]);
  };
  // any extra object (e.g. a skirt panel) can be rotated in character axes too
  const free = (key, obj) => register(key, obj);
  return { apply, set, free, joints };
}

export function blendPoses(list) {
  // list: [[pose, weight], ...]  (weights should sum to ~1)
  const out = {};
  for (const k in ZERO_POSE) {
    let s = 0;
    for (const [p, w] of list) s += (p[k] ?? ZERO_POSE[k]) * w;
    out[k] = s;
  }
  return out;
}
