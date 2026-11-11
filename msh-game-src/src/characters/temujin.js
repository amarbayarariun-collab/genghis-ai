// Тэмүжин — clothed Rodin sculpt. Neither this GLB nor hoelun.glb has a skeleton or clips.
// temujin.glb is an untextured Mixamo bind pose with no animation tracks, so it is not the body.
// Idle and walk below are a temporary whole-body motion until a rigged clip exists.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  let slope = 0;
  let phase = 0;
  let walkBlend = 0;
  const limbUniforms = { uPhase: { value: 0 }, uWalk: { value: 0 }, uBreath: { value: 0 }, uRide: { value: 0 } };
  let ride = 0;
  group.userData.setMoving = (v) => { moving = !!v; };
  group.userData.setSpeed = (s) => { speed = Math.max(0, s || 0); };
  group.userData.setSlope = (s) => { slope = s || 0; };
  group.userData.setRiding = (v) => { ride = v ? 1 : 0; };
  const motion = (node, dt, baseY) => {
    const sp = moving ? speed : 0;
    const walking = sp > 0.08;
    const g = THREE.MathUtils.clamp(sp / 3.4, 0, 1);
    phase += dt * (walking ? 2.6 + sp * 1.7 : 1.35);
    // limbs: blend the walk in/out smoothly so stopping does not snap
    walkBlend += ((walking ? Math.max(g, 0.6) : 0) - walkBlend) * Math.min(1, dt * 8);
    limbUniforms.uPhase.value = phase;
    limbUniforms.uWalk.value = walkBlend;
    limbUniforms.uBreath.value = phase;
    limbUniforms.uRide.value += (ride - limbUniforms.uRide.value) * Math.min(1, dt * 6);
    const bob = walking ? Math.abs(Math.cos(phase)) * 0.035 * walkBlend : Math.sin(phase) * 0.006;
    node.position.y = baseY + bob;
    node.rotation.z = Math.sin(phase) * 0.035 * walkBlend;
    const climb = THREE.MathUtils.clamp(slope / 0.7, -0.35, 0.35);
    node.rotation.x = 0.06 * walkBlend + climb * 0.5;
  };
  group.userData.update = (dt, t) => {
    placeholder.update(dt, t, moving ? speed : 0);
    motion(placeholder.root, dt, 0);
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
        raw.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
          if (o.isSkinnedMesh) o.bind(o.skeleton, o.bindMatrix);
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

        // Bake every mesh into body space (feet at y=0, facing +Z, 1.72 m tall)
        // so the vertex shader can find legs, arms and robe by position.
        group.updateMatrixWorld(true);
        const body = new THREE.Group();
        body.name = 'temujin-body';
        const toGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
        const meshes = [];
        wrap.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
        meshes.forEach((o) => {
          const rel = new THREE.Matrix4().multiplyMatrices(toGroup, o.matrixWorld);
          o.geometry = o.geometry.clone();
          o.geometry.applyMatrix4(rel);
          o.position.set(0, 0, 0);
          o.quaternion.identity();
          o.scale.set(1, 1, 1);
          o.removeFromParent();
          body.add(o);
          attachLimbRig(o, limbUniforms);
        });
        if (meshes.length) {
          group.remove(wrap);
          group.add(body);
          group.userData.update = (dt) => motion(body, dt, 0);
        } else {
          const baseY = wrap.position.y;
          group.userData.update = (dt) => motion(wrap, dt, baseY);
        }
      } catch (err) {
        console.error('[temujin] GLB setup failed, procedural kept', err);
      }
    },
    undefined,
    (err) => console.warn('[temujin] GLB failed:', err)
  );

  return group;
}

// Procedural limb rig for the unrigged clothed sculpt. Landmarks were measured
// from the mesh: boots below ~15% height, robe hem ~20%, hands ~45%,
// shoulders ~75%, feet apart at x = +-0.2, face toward +Z.
// Legs swing about the hip, arms about the shoulder, opposite phase. The side
// factor ramps through the centre line so the robe bends instead of tearing.
export const limbGLSL = (Hh) => /* glsl */`
  {
    float H = ${Hh.toFixed(3)};
    float y = transformed.y;
    float side = clamp(transformed.x / 0.06, -1.0, 1.0);
    float sw = sin(uPhase);
    // robe skirt + inner legs sway together about the hip (small, no poke-through)
    float hipY = 0.50 * H;
    float wSkirt = 1.0 - smoothstep(0.22 * H, 0.50 * H, y);
    float aSk = 0.10 * uWalk * sw * side * wSkirt;
    vec2 rs = vec2(y - hipY, transformed.z - 0.02);
    float cs = cos(aSk), ss = sin(aSk);
    transformed.y = hipY + rs.x * cs - rs.y * ss;
    transformed.z = 0.02 + rs.x * ss + rs.y * cs;
    // shins and boots below the hem swing about the knee
    float kneeY = 0.25 * H;
    float wLow = 1.0 - smoothstep(0.15 * H, 0.23 * H, y);
    float aLow = 0.48 * uWalk * sw * side * wLow;
    vec2 rk = vec2(transformed.y - kneeY, transformed.z - 0.02);
    float ck = cos(aLow), sk = sin(aLow);
    transformed.y = kneeY + rk.x * ck - rk.y * sk;
    transformed.z = 0.02 + rk.x * sk + rk.y * ck;
    // lift the foot that is swinging forward
    float wFoot = 1.0 - smoothstep(0.06 * H, 0.22 * H, y);
    transformed.y += 0.055 * uWalk * max(0.0, -cos(uPhase) * sign(side)) * abs(side) * wFoot;
    // arms swing opposite to the leg on the same side
    float ax = abs(transformed.x);
    float wArm = smoothstep(0.15, 0.22, ax) * smoothstep(0.36 * H, 0.46 * H, y) * (1.0 - smoothstep(0.66 * H, 0.74 * H, y));
    float shY = 0.74 * H;
    float aArm = -0.38 * uWalk * sw * sign(transformed.x) * wArm;
    vec2 ra = vec2(transformed.y - shY, transformed.z);
    float ca = cos(aArm), sa = sin(aArm);
    transformed.y = shY + ra.x * ca - ra.y * sa;
    transformed.z = ra.x * sa + ra.y * ca;
    // riding: sit astride. The shin folds back at the knee, the thigh swings
    // forward about the hip and the legs open around the horse's barrel.
    {
      float kY = 0.27 * H;
      float wK = 1.0 - smoothstep(kY - 0.03 * H, kY + 0.03 * H, y);
      float bK = 1.0 * uRide * wK;
      vec2 r1 = vec2(transformed.y - kY, transformed.z);
      transformed.y = kY + r1.x * cos(bK) + r1.y * sin(bK);
      transformed.z = r1.x * sin(bK) + r1.y * cos(bK);
      float wH = 1.0 - smoothstep(hipY - 0.08 * H, hipY + 0.01 * H, y);
      float aH = 0.62 * uRide * wH;
      vec2 r2 = vec2(transformed.y - hipY, transformed.z);
      transformed.y = hipY + r2.x * cos(aH) - r2.y * sin(aH);
      transformed.z = -r2.x * sin(aH) + r2.y * cos(aH);
      float wS = 1.0 - smoothstep(0.30 * H, 0.50 * H, y);
      transformed.x += side * wS * 0.2 * uRide;
      // hands forward to the reins
      float aR = -0.28 * uRide * wArm;
      vec2 r3 = vec2(transformed.y - shY, transformed.z);
      transformed.y = shY + r3.x * cos(aR) - r3.y * sin(aR);
      transformed.z = r3.x * sin(aR) + r3.y * cos(aR);
    }
    // idle breathing on the chest
    float wChest = smoothstep(0.5 * H, 0.62 * H, y) * (1.0 - smoothstep(0.72 * H, 0.8 * H, y)) * (1.0 - wArm);
    transformed.z += sin(uBreath * 0.9) * 0.004 * wChest * (1.0 - uWalk);
  }
`;
const LIMB_GLSL = limbGLSL(TARGET_HEIGHT);


function patchLimbs(material, uniforms) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float uPhase;\nuniform float uWalk;\nuniform float uBreath;\nuniform float uRide;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LIMB_GLSL);
  };
  material.customProgramCacheKey = () => 'temujin-limbs';
  material.needsUpdate = true;
}

function attachLimbRig(mesh, uniforms) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((m) => patchLimbs(m, uniforms));
  // shadows follow the limbs too
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  patchLimbs(depth, uniforms);
  mesh.customDepthMaterial = depth;
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
