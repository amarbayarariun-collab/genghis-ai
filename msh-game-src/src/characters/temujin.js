// Тэмүжин — clothed sculpt. The file has no skeleton and no clips.
// temujin-gait.js skins that mesh and plays authored Idle/Walk/Run on the bones.
// Hö'elün's GLB is still a static mesh. There is no owned skeletal clip to blend.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachGait } from './temujin-gait.js';

export const USE_TEMUJIN_GLB = true;
export const TEMUJIN_GLB_URL = './models/base_basic_shaded.glb';
export const TEMUJIN_ANIM_DIR = './anims/';
const TARGET_HEIGHT = 1.72;

const mat = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });

export function createTemujin() {
  const group = new THREE.Group();
  const placeholder = buildPlaceholder();
  group.add(placeholder.root);
  let speed = 0;
  let moving = false;
  group.userData.setMoving = (v) => { moving = !!v; };
  group.userData.setSpeed = (s) => { speed = Math.max(0, s || 0); };
  group.userData.setSlope = () => {};
  group.userData.update = (dt, t) => {
    placeholder.update(dt, t, moving ? speed : 0);
  };

  if (!USE_TEMUJIN_GLB) return group;

  new GLTFLoader().load(
    TEMUJIN_GLB_URL,
    (gltf) => {
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
        let src = null;
        raw.traverse((o) => { if (o.isMesh && !src) src = o; });
        const gait = attachGait(src, s);
        src.parent.add(gait.mesh);
        src.parent.remove(src);
        raw.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
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

        group.userData.update = (dt) => gait.update(dt, moving ? speed : 0);
        group.userData.setYaw = (y) => gait.setYaw(y);
        group.userData.poseSample = () => gait.poseSample();
      } catch (err) {
        console.error('[temujin] GLB setup failed, procedural kept', err);
      }
    },
    undefined,
    (err) => console.warn('[temujin] GLB failed:', err)
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
  add(root, new THREE.CylinderGeometry(0.1, 0.16, 0.28, 8), C.hat, [0, 1.72, 0]);
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
