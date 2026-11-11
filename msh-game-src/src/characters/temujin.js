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
        wrap.updateMatrixWorld(true);
        const box2 = new THREE.Box3().setFromObject(wrap);
        wrap.position.set(
          -((box2.min.x + box2.max.x) / 2),
          -box2.min.y,
          -((box2.min.z + box2.max.z) / 2)
        );

        group.remove(placeholder.root);
        group.add(wrap);

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

function buildPlaceholder() {
  const root = new THREE.Group();
  const C = { deel: '#9a1e24', fur: '#e8d4b0', hat: '#8b1a20', boot: '#5c3a22', skin: '#c48a5e', pant: '#2e2218' };
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
