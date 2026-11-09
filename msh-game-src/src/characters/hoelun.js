// Өэлүн эх — denser placeholder (art-ref 16 boqta). GLB swap via HOELUN_GLB_URL.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export const HOELUN_GLB_URL = './models/hoelun.glb';
const TARGET_HEIGHT = 2.15;

export function createHoelun() {
  const group = new THREE.Group();
  const placeholder = buildPlaceholder();
  group.add(placeholder.root);
  group.userData.update = placeholder.update;

  if (HOELUN_GLB_URL) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('./draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      HOELUN_GLB_URL,
      (gltf) => {
        draco.dispose();
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.scale.setScalar(TARGET_HEIGHT / (size.y || 1));
        const box2 = new THREE.Box3().setFromObject(model);
        const c = box2.getCenter(new THREE.Vector3());
        model.position.set(-c.x, -box2.min.y, -c.z);
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
        });
        group.remove(placeholder.root);
        group.add(model);
        // hoelun.glb has no skeleton and no clips. Idle is a breath; facing is the group yaw.
        const baseY = model.position.y;
        // Close-up check: the sculpt's face is local +Z. Yaw 0 looks down the south path.
        const homeYaw = 0;
        group.rotation.y = homeYaw;
        let mixer = null;
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }
        let last = null;
        group.userData.update = (t, lookAt, dt = 0.016) => {
          if (mixer && last != null) mixer.update(Math.min(0.05, t - last));
          last = t;
          // Feet stay on the planted origin. Weight is a small lean, not a lift.
          model.position.y = baseY;
          model.rotation.y = 0;
          model.rotation.x = Math.sin(t * 1.15) * (group.userData.talking ? 0.028 : 0.012);
          model.rotation.z = Math.sin(t * 0.8) * 0.018;
          const step = Math.min(1, dt * (group.userData.talking ? 5 : 2.4));
          if (lookAt) {
            const dx = lookAt.x - group.position.x;
            const dz = lookAt.z - group.position.z;
            const near = dx * dx + dz * dz < 64;
            if (group.userData.talking || near) {
              let want = Math.atan2(dx, dz);
              let d = want - group.rotation.y;
              while (d > Math.PI) d -= Math.PI * 2;
              while (d < -Math.PI) d += Math.PI * 2;
              group.rotation.y += d * step;
              return;
            }
          }
          let d = homeYaw + Math.sin(t * 0.45) * 0.08 - group.rotation.y;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          group.rotation.y += d * Math.min(1, dt * 1.5);
        };
      },
      undefined,
      (err) => {
        draco.dispose();
        console.warn('[hoelun] GLB failed:', err);
      }
    );
  }
  return group;
}

function flat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function buildPlaceholder() {
  const C = {
    deel: flat('#8b1a28'),
    deelDark: flat('#5c1020'),
    trim: flat('#d4a84a'),
    inner: flat('#3b4a6b'),
    fur: flat('#e2d0b0'),
    skin: flat('#c68d62'),
    brow: flat('#3a2418'),
    eye: flat('#1c1410'),
    lip: flat('#9a5a48'),
    hair: flat('#1c1414'),
    hat: flat('#7e1520'),
    belt: flat('#5a3a22'),
    boot: flat('#3a2416'),
    metal: flat('#c8c4c0'),
    pearl: flat('#f2ebe4'),
  };
  const root = new THREE.Group();
  const add = (parent, geo, m, [x, y, z], rot) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (rot) mesh.rotation.set(...rot);
    parent.add(mesh);
    return mesh;
  };

  for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(0.17, 0.16, 0.3), C.boot, [s * 0.13, 0.07, 0.48]);

  add(root, new THREE.CylinderGeometry(0.34, 0.58, 1.05, 10), C.deel, [0, 0.65, 0]);
  add(root, new THREE.CylinderGeometry(0.585, 0.59, 0.1, 10), C.trim, [0, 0.16, 0]);
  const torso = add(root, new THREE.CylinderGeometry(0.27, 0.34, 0.62, 10), C.deel, [0, 1.4, 0]);
  add(root, new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10), C.belt, [0, 1.12, 0]);
  add(root, new THREE.BoxGeometry(0.12, 0.1, 0.04), C.metal, [0, 1.12, 0.34]);
  add(root, new THREE.BoxGeometry(0.16, 0.38, 0.04), C.inner, [0, 1.52, 0.28]);
  add(root, new THREE.BoxGeometry(0.07, 0.62, 0.05), C.trim, [0.08, 1.42, 0.3], [0, 0, 0.35]);
  // gold hem swirl blocks
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(root, new THREE.BoxGeometry(0.12, 0.08, 0.05), C.trim, [Math.sin(a) * 0.52, 0.2, Math.cos(a) * 0.52]);
  }
  add(root, new THREE.TorusGeometry(0.29, 0.1, 5, 12), C.fur, [0, 1.7, 0], [Math.PI / 2, 0, 0]);

  for (const s of [-1, 1]) {
    add(root, new THREE.CylinderGeometry(0.1, 0.14, 0.48, 6), C.deel, [s * 0.34, 1.48, 0.02], [0, 0, s * 0.28]);
    add(root, new THREE.CylinderGeometry(0.11, 0.17, 0.44, 6), C.deelDark, [s * 0.22, 1.18, 0.22], [-1.05, 0, -s * 0.55]);
    add(root, new THREE.CylinderGeometry(0.17, 0.17, 0.09, 6), C.trim, [s * 0.12, 1.1, 0.38], [-1.05, 0, -s * 0.55]);
    add(root, new THREE.DodecahedronGeometry(0.07, 0), C.skin, [s * 0.06, 1.08, 0.44]);
  }

  const head = new THREE.Group();
  head.position.y = 1.95;
  add(head, new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), C.skin, [0, -0.2, 0]);
  const skull = add(head, new THREE.IcosahedronGeometry(0.17, 1), C.skin, [0, 0, 0]);
  skull.scale.set(0.92, 1.12, 0.95);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.055, 0.018, 0.012), C.eye, [s * 0.058, 0.025, 0.155]);
    add(head, new THREE.BoxGeometry(0.065, 0.014, 0.012), C.brow, [s * 0.06, 0.07, 0.15], [0, 0, -s * 0.12]);
    add(head, new THREE.BoxGeometry(0.03, 0.05, 0.05), C.skin, [s * 0.165, 0.0, 0.0]);
  }
  add(head, new THREE.ConeGeometry(0.022, 0.06, 4), C.skin, [0, -0.02, 0.165], [Math.PI / 2 - 0.3, 0, 0]);
  add(head, new THREE.BoxGeometry(0.06, 0.014, 0.012), C.lip, [0, -0.085, 0.145]);

  const hairBack = add(head, new THREE.SphereGeometry(0.185, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), C.hair, [0, 0.06, -0.035], [-0.35, 0, 0]);
  hairBack.scale.set(1.04, 1.1, 1);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.05, 0.24, 0.08), C.hair, [s * 0.165, -0.02, 0.04]);
    const braid = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const seg = add(braid, new THREE.OctahedronGeometry(0.045, 0), C.hair, [0, -i * 0.085, 0]);
      seg.scale.y = 1.4;
    }
    add(braid, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), C.metal, [0, -0.55, 0]);
    braid.position.set(s * 0.16, -0.16, 0.1);
    braid.rotation.x = -0.25;
    head.add(braid);
    // pearl strands beside face (boqta ornaments)
    for (let i = 0; i < 5; i++) {
      add(head, new THREE.SphereGeometry(0.022, 6, 5), C.pearl, [s * (0.12 + i * 0.01), 0.12 - i * 0.08, 0.14]);
    }
  }

  // Tall cylindrical boqta (ref 16)
  const boqta = add(head, new THREE.CylinderGeometry(0.14, 0.16, 0.55, 12), C.hat, [0, 0.42, 0]);
  add(head, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12), C.metal, [0, 0.7, 0]);
  add(head, new THREE.CylinderGeometry(0.05, 0.05, 0.025, 10), C.metal, [0, 0.55, 0.15], [Math.PI / 2 - 0.2, 0, 0]);
  add(head, new THREE.TorusGeometry(0.165, 0.035, 5, 14), C.fur, [0, 0.18, 0], [Math.PI / 2, 0, 0]);
  const tail = add(head, new THREE.BoxGeometry(0.1, 0.42, 0.02), C.hat, [-0.1, -0.05, -0.18], [0.2, 0, 0.15]);
  root.add(head);

  const tmp = new THREE.Vector3();
  const update = (t, lookAt) => {
    torso.scale.y = 1 + Math.sin(t * 1.8) * 0.015;
    tail.rotation.z = 0.15 + Math.sin(t * 3) * 0.12;
    boqta.rotation.y = Math.sin(t * 0.4) * 0.02;
    if (lookAt) {
      root.worldToLocal(tmp.copy(lookAt));
      const yaw = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -0.9, 0.9);
      head.rotation.y += (yaw - head.rotation.y) * 0.08;
    }
  };
  return { root, update };
}
