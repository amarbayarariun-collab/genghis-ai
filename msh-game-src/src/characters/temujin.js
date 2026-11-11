// Тэмүжин — clothed Rodin sculpt. Neither this GLB nor hoelun.glb has a skeleton or clips.
// temujin.glb is an untextured Mixamo bind pose with no animation tracks, so it is not the body.
// Idle and walk below are a temporary whole-body motion until a rigged clip exists.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mongolHat } from '../world-kit.js';

export const USE_TEMUJIN_GLB = true;
export const TEMUJIN_GLB_URL = './models/base_basic_shaded.glb';
export const TEMUJIN_ANIM_DIR = './anims/';
const TARGET_HEIGHT = 1.72;
// Drop the sculpt hat above the brow. The face itself stays.
const HEAD_CUT = 1.72;

const mat = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });

export function createTemujin(opts = {}) {
  const shadows = opts.shadows === true;
  const group = new THREE.Group();
  const placeholder = buildPlaceholder();
  group.add(placeholder.root);
  let speed = 0;
  let moving = false;
  let slope = 0;
  let phase = 0;
  group.userData.setMoving = (v) => { moving = !!v; };
  group.userData.setSpeed = (s) => { speed = Math.max(0, s || 0); };
  group.userData.setSlope = (s) => { slope = s || 0; };
  const motion = (node, dt, baseY) => {
    const sp = moving ? speed : 0;
    const walking = sp > 0.08;
    const g = THREE.MathUtils.clamp(sp / 3.4, 0, 1);
    // One sway is two steps. Pivot stays at the planted feet, so Y never leaves baseY.
    phase += dt * (walking ? 6.2 + sp * 1.35 : 1.15);
    const sway = Math.sin(phase);
    const step = Math.sin(phase * 2);
    node.position.y = baseY;
    const lean = walking ? 0.055 * Math.max(g, 0.45) : 0.016;
    node.rotation.z = sway * lean;
    const climb = THREE.MathUtils.clamp(slope / 1.6, -0.1, 0.1);
    node.rotation.x = (walking ? step * 0.04 * Math.max(g, 0.45) : Math.sin(phase * 0.5) * 0.012) + climb;
    node.rotation.y = 0;
  };
  group.userData.update = (dt, t) => {
    placeholder.update(dt, t, moving ? speed : 0);
    motion(placeholder.root, dt, 0);
  };

  if (!USE_TEMUJIN_GLB) return group;

  const draco = new DRACOLoader();
  draco.setDecoderPath('./draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    TEMUJIN_GLB_URL,
    (gltf) => {
      draco.dispose();
      try {
        // One instance: scale the scene, then rebind so bone matrices share that scale.
        const raw = gltf.scene;
        const wrap = new THREE.Group();
        wrap.add(raw);

        raw.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(raw);
        const size = box.getSize(new THREE.Vector3());
        const s = TARGET_HEIGHT / (size.y || 1);
        raw.scale.setScalar(s);
        raw.updateMatrixWorld(true);
        let skinned = false;
        raw.traverse((o) => {
          if (o.isBone) skinned = true;
          if (!o.isMesh) return;
          o.castShadow = shadows;
          o.receiveShadow = shadows;
          o.geometry?.computeBoundingSphere?.();
          o.frustumCulled = true;
          if (o.isSkinnedMesh) {
            skinned = true;
            o.bind(o.skeleton, o.bindMatrix);
          }
        });
        let hatCut = false;
        const cutHat = () => {
          if (hatCut) return;
          hatCut = hideSculptHat(raw);
        };
        cutHat();
        wrap.updateMatrixWorld(true);
        const box2 = new THREE.Box3().setFromObject(wrap);
        wrap.position.set(
          -((box2.min.x + box2.max.x) / 2),
          -box2.min.y,
          -((box2.min.z + box2.max.z) / 2)
        );

        group.remove(placeholder.root);
        group.add(wrap);
        const malgai = mongolHat(1);
        // Local 1.33 meets the cut. A few centimetres lower tucks the brim onto the hair.
        malgai.position.y = HEAD_CUT * s - 1.33 - 0.03;
        malgai.rotation.y = Math.PI / 2;
        group.add(malgai);

        const baseY = wrap.position.y;
        const clips = gltf.animations?.length || 0;
        // Play a clip only when this mesh already has both a skeleton and tracks.
        // The clothed Draco file has neither. Inventing a Mixamo rig for it would
        // miss the sculpt, so the whole-body lean stays.
        let mixer = null;
        if (skinned && clips > 0) {
          mixer = new THREE.AnimationMixer(raw);
          mixer.clipAction(gltf.animations[0]).play();
        }
        group.userData.clipGate = {
          applied: !!mixer,
          skinned,
          clips,
          reason: mixer
            ? 'Skeleton and a clip were on this mesh, so the first clip plays.'
            : 'The clothed Draco mesh has no skeleton and no clips. temujin.glb is a Mixamo bind with no tracks and is not this body. A made-up rig would not match the sculpt.',
        };
        group.userData.update = (dt) => {
          cutHat();
          if (mixer) mixer.update(dt);
          else motion(wrap, dt, baseY);
        };
      } catch (err) {
        console.error('[temujin] GLB setup failed, procedural kept', err);
      }
    },
    undefined,
    (err) => {
      draco.dispose();
      console.warn('[temujin] GLB failed:', err);
    }
  );

  return group;
}

function hideSculptHat(root) {
  let done = false;
  root.traverse((o) => {
    const map = o.material?.emissiveMap;
    const image = map?.image;
    if (!o.isMesh || !o.geometry?.index || !image?.width) return;
    const pos = o.geometry.attributes.position;
    const uv = o.geometry.attributes.uv;
    const src = o.geometry.index.array;
    let pix = null;
    let tw = 0;
    let th = 0;
    if (uv && image.width) {
      tw = image.width;
      th = image.height;
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      pix = ctx.getImageData(0, 0, tw, th).data;
    }
    const sample = (i) => {
      if (!pix || !uv) return [0, 0, 0];
      const x = Math.min(tw - 1, Math.max(0, (uv.getX(i) * tw) | 0));
      const yy = Math.min(th - 1, Math.max(0, ((1 - uv.getY(i)) * th) | 0));
      const k = (yy * tw + x) * 4;
      return [pix[k], pix[k + 1], pix[k + 2]];
    };
    const above = new Uint8Array(pos.count);
    const wide = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > HEAD_CUT) above[i] = 1;
      else if (y > 1.55 && Math.hypot(pos.getX(i), pos.getZ(i)) > 0.2) wide[i] = 1;
    }
    const kept = [];
    let furDropped = 0;
    for (let i = 0; i < src.length; i += 3) {
      const a = src[i];
      const b = src[i + 1];
      const c = src[i + 2];
      if (wide[a] && wide[b] && wide[c]) continue;
      const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
      const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      const [r1, g1, b1] = sample(a);
      const [r2, g2, b2] = sample(b);
      const [r3, g3, b3] = sample(c);
      let rc = 0;
      let gc = 0;
      let bc = 0;
      if (uv && pix) {
        const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
        const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
        const x = Math.min(tw - 1, Math.max(0, (u * tw) | 0));
        const yy = Math.min(th - 1, Math.max(0, ((1 - v) * th) | 0));
        const k = (yy * tw + x) * 4;
        rc = pix[k];
        gc = pix[k + 1];
        bc = pix[k + 2];
      }
      // Cream hat-fur reads nearly white. Face skin is darker in the blue channel.
      const whiteFur = (r, g, b) => r > 190 && g > 165 && b > 130 && r - b < 90;
      const orangeFur = (r, g, b) => r > 165 && g > 105 && b < 125 && r - b > 55 && r > g - 5;
      const white = whiteFur(r1, g1, b1) || whiteFur(r2, g2, b2) || whiteFur(r3, g3, b3) || whiteFur(rc, gc, bc);
      const orange = orangeFur(r1, g1, b1) || orangeFur(r2, g2, b2) || orangeFur(r3, g3, b3);
      const yMax = Math.max(pos.getY(a), pos.getY(b), pos.getY(c));
      // Keep the forehead even when one corner pokes above the cut. Drop the old hat.
      const onFront = cz > 0.03 && Math.abs(cx) < 0.14;
      if ((above[a] || above[b] || above[c]) && (!onFront || yMax > 1.80 || cy > 1.74)) {
        furDropped += 1;
        continue;
      }
      const face = cz > 0.05 && Math.abs(cx) < 0.13 && cy > 1.50;
      const hood = yMax > 1.46 && cy > 1.32 && (cz < 0.04 || Math.abs(cx) > 0.09);
      const tallCollar = white && yMax > 1.42 && Math.abs(cx) > 0.16 && cy < 1.55;
      if ((!face && hood && (white || orange)) || tallCollar) { furDropped += 1; continue; }
      kept.push(a, b, c);
    }
    o.userData.furDropped = furDropped;
    const next = src instanceof Uint32Array ? new Uint32Array(kept) : new Uint16Array(kept);
    o.geometry.setIndex(new THREE.BufferAttribute(next, 1));

    // The collar shares this texture with the face. Recolor only the neck
    // fur, and never a texel the face itself uses.
    if (uv) {
      const w = image.width;
      const h = image.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const img = ctx.getImageData(0, 0, w, h);
      const pix = img.data;
      const face = new Uint8Array(w * h);
      const collar = new Uint8Array(w * h);
      const stamp = (mask, i, rad) => {
        const x = Math.min(w - 1, Math.max(0, (uv.getX(i) * w) | 0));
        const yy = Math.min(h - 1, Math.max(0, ((1 - uv.getY(i)) * h) | 0));
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const xx = x + dx;
            const y2 = yy + dy;
            if (xx < 0 || y2 < 0 || xx >= w || y2 >= h) continue;
            mask[y2 * w + xx] = 1;
          }
        }
      };
      const body = new Uint8Array(w * h);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const wide = Math.hypot(pos.getX(i), pos.getZ(i));
        const z = pos.getZ(i);
        if (y > 1.48 && y < HEAD_CUT && wide < 0.18) stamp(face, i, 4);
        if (y > 1.22 && y < 1.50 && wide > 0.09 && wide < 0.32) stamp(collar, i, 2);
        if (y < 1.38) stamp(body, i, 1);
        if (y > 1.5 && y < HEAD_CUT && z > 0.02 && wide < 0.15) stamp(face, i, 3);
      }
      const redOnFace = (r, g, b) => r > 150 && g < 80 && b < 80 && r > g + 60;
      for (let p = 0; p < w * h; p++) {
        const k = p * 4;
        const r = pix[k];
        const g = pix[k + 1];
        const b = pix[k + 2];
        if (face[p] && !body[p] && redOnFace(r, g, b)) {
          pix[k] = 196;
          pix[k + 1] = 148;
          pix[k + 2] = 108;
          continue;
        }
        if (face[p] || !collar[p]) continue;
        const pale = r > 140 && g > 100 && b > 55 && r - g < 78 && g > r * 0.52;
        if (!pale) continue;
        pix[k] = 107;
        pix[k + 1] = 68;
        pix[k + 2] = 40;
      }
      ctx.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = map.colorSpace;
      tex.flipY = false;
      tex.wrapS = map.wrapS;
      tex.wrapT = map.wrapT;
      tex.channel = map.channel;
      tex.anisotropy = map.anisotropy;
      o.material.emissiveMap = tex;
      o.material.needsUpdate = true;
    }
    done = true;
  });
  return done;
}

function buildPlaceholder() {
  const root = new THREE.Group();
  const C = { deel: '#9a1e24', fur: '#6a4428', hat: '#8b1a20', boot: '#5c3a22', skin: '#c48a5e', pant: '#2e2218' };
  const add = (parent, geo, color, [x, y, z], rot) => {
    const mesh = new THREE.Mesh(geo, mat(color));
    mesh.castShadow = true;
    mesh.position.set(x, y, z);
    if (rot) mesh.rotation.set(...rot);
    parent.add(mesh);
    return mesh;
  };
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, 0.55, 0);
  add(leftLeg, new THREE.CylinderGeometry(0.08, 0.09, 0.55, 6), C.pant, [0, -0.2, 0]);
  add(leftLeg, new THREE.BoxGeometry(0.16, 0.14, 0.3), C.boot, [0, -0.5, 0.05]);
  root.add(leftLeg);
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, 0.55, 0);
  add(rightLeg, new THREE.CylinderGeometry(0.08, 0.09, 0.55, 6), C.pant, [0, -0.2, 0]);
  add(rightLeg, new THREE.BoxGeometry(0.16, 0.14, 0.3), C.boot, [0, -0.5, 0.05]);
  root.add(rightLeg);
  add(root, new THREE.CylinderGeometry(0.22, 0.28, 0.85, 8), C.deel, [0, 1.05, 0]);
  add(root, new THREE.TorusGeometry(0.2, 0.06, 5, 10), C.fur, [0, 1.4, 0], [Math.PI / 2, 0, 0]);
  add(root, new THREE.IcosahedronGeometry(0.13, 1), C.skin, [0, 1.55, 0]);
  root.add(mongolHat(1));
  return {
    root,
    update(dt, t, sp) {
      const g = THREE.MathUtils.clamp(sp / 3.4, 0, 1);
      const swing = Math.sin(t * (2 + sp * 2.4)) * 0.55 * g;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
    },
  };
}
