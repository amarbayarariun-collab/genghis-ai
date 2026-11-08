// Shared low-poly humanoid builder: jointed body with flat-color materials.
// Every joint is a Group pivot, so walk/idle animation is just rotating pivots.
// Used by temujin.js and hoelun.js. Swap any character for a GLB later
// (see HOELUN_GLB_URL / TEMUJIN_GLB_URL in each module).
import * as THREE from 'three';

export const flat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function mesh(parent, geo, mat, pos = [0, 0, 0], rot = null, scale = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function pivot(parent, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  parent.add(g);
  return g;
}

/**
 * opts:
 *  height        overall height (m)
 *  colors        { deel, trim, belt, buckle, pants, boot, skin, hair, fur, hat, ribbon, inner, eye, brow, lip }
 *  robeLength    0..1 how far the deel skirt reaches down the leg (1 = ankles)
 *  build         'male' | 'female'
 *  hat           'furHat' (big fur hat + red top + ribbon) | 'furCap' (fur band cap) | null
 *  furMantle     spiky fur over the shoulders
 *  braids        true/false
 */
export function buildHumanoid(opts) {
  const C = Object.fromEntries(Object.entries(opts.colors).map(([k, v]) => [k, flat(v)]));
  const H = opts.height ?? 1.75;
  const s = H / 1.75; // everything below is authored for 1.75 m
  const female = opts.build === 'female';
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  body.scale.setScalar(s);

  const legLen = 0.86;
  const hips = pivot(body, [0, legLen, 0]);

  // ---- legs: hip pivot -> thigh -> knee pivot -> shin + boot ----
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = pivot(hips, [side * 0.1, 0, 0]);
    mesh(hip, new THREE.CylinderGeometry(0.085, 0.07, 0.44, 7), C.pants, [0, -0.22, 0]);
    const knee = pivot(hip, [0, -0.44, 0]);
    mesh(knee, new THREE.CylinderGeometry(0.068, 0.058, 0.2, 7), C.pants, [0, -0.08, 0]);
    // boot: shaft + foot
    mesh(knee, new THREE.CylinderGeometry(0.075, 0.07, 0.24, 7), C.boot, [0, -0.27, 0]);
    mesh(knee, new THREE.BoxGeometry(0.12, 0.08, 0.24), C.boot, [0, -0.38, 0.05]);
    mesh(knee, new THREE.CylinderGeometry(0.082, 0.082, 0.04, 7), C.boot, [0, -0.15, 0]); // boot cuff
    legs.push({ hip, knee });
  }

  // ---- deel skirt (hangs from hips, sways when walking) ----
  const robe = opts.robeLength ?? 0.6;
  const skirtLen = 0.15 + robe * 0.72;
  const skirt = pivot(hips, [0, 0.02, 0]);
  const skirtTop = female ? 0.2 : 0.21;
  const skirtBottom = (female ? 0.36 : 0.3) + robe * 0.08;
  mesh(skirt, new THREE.CylinderGeometry(skirtTop, skirtBottom, skirtLen, 10), C.deel, [0, -skirtLen / 2, 0]);
  mesh(skirt, new THREE.CylinderGeometry(skirtBottom + 0.005, skirtBottom + 0.01, 0.06, 10), C.trim, [0, -skirtLen + 0.02, 0]);
  // front overlap edge of the deel (closes to the right)
  mesh(skirt, new THREE.BoxGeometry(0.035, skirtLen * 0.95, 0.02), C.trim, [0.06, -skirtLen / 2, (skirtTop + skirtBottom) / 2 + 0.005], [-0.12, 0, 0]);

  // ---- torso ----
  const torso = pivot(hips, [0, 0, 0]);
  const chestW = female ? 0.2 : 0.23;
  mesh(torso, new THREE.CylinderGeometry(chestW, 0.19, 0.5, 9), C.deel, [0, 0.27, 0], null, [1, 1, 0.78]);
  // crossed collar: inner layer + trim diagonal
  mesh(torso, new THREE.BoxGeometry(0.1, 0.18, 0.02), C.inner, [-0.02, 0.44, chestW * 0.76], [0, 0, 0.0]);
  mesh(torso, new THREE.BoxGeometry(0.035, 0.42, 0.02), C.trim, [0.04, 0.33, chestW * 0.79], [0, 0, 0.42]);
  // belt + round buckle
  mesh(torso, new THREE.CylinderGeometry(0.2, 0.2, 0.09, 10), C.belt, [0, 0.04, 0], null, [1, 1, 0.82]);
  mesh(torso, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), C.buckle, [0, 0.04, 0.165], [Math.PI / 2, 0, 0]);

  // ---- fur mantle: ring of shaggy spikes around the shoulders ----
  if (opts.furMantle) {
    const mantle = pivot(torso, [0, 0.5, 0]);
    mesh(mantle, new THREE.CylinderGeometry(0.17, 0.27, 0.12, 10), C.fur, [0, 0, 0], null, [1, 1, 0.85]);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 0.25;
      const spike = mesh(mantle, new THREE.ConeGeometry(0.06, 0.16, 4), C.fur,
        [Math.sin(a) * r, -0.08, Math.cos(a) * r * 0.85], [Math.PI, 0, 0]);
      spike.rotation.set(Math.PI - Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    }
  } else {
    mesh(torso, new THREE.TorusGeometry(0.15, 0.05, 5, 10), C.fur, [0, 0.52, 0], [Math.PI / 2, 0, 0]);
  }

  // ---- arms: shoulder pivot -> upper -> elbow pivot -> forearm, cuff, hand ----
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = pivot(torso, [side * (chestW + 0.04), 0.47, 0]);
    shoulder.rotation.z = side * 0.12;
    mesh(shoulder, new THREE.CylinderGeometry(0.065, 0.075, 0.3, 7), C.deel, [0, -0.15, 0]);
    const elbow = pivot(shoulder, [0, -0.3, 0]);
    mesh(elbow, new THREE.CylinderGeometry(0.07, 0.085, 0.24, 7), C.deel, [0, -0.12, 0]);
    mesh(elbow, new THREE.CylinderGeometry(0.09, 0.09, 0.07, 7), C.trim, [0, -0.25, 0]); // wide cuff
    mesh(elbow, new THREE.BoxGeometry(0.06, 0.1, 0.08), C.skin, [0, -0.33, 0.005]); // hand
    mesh(elbow, new THREE.BoxGeometry(0.02, 0.05, 0.04), C.skin, [side * -0.035, -0.31, 0.03]); // thumb
    arms.push({ shoulder, elbow });
  }

  // ---- neck + head ----
  const neck = pivot(torso, [0, 0.55, 0]);
  mesh(neck, new THREE.CylinderGeometry(0.05, 0.055, 0.08, 7), C.skin, [0, 0.03, 0]);
  const head = pivot(neck, [0, 0.16, 0]);
  const skull = mesh(head, new THREE.IcosahedronGeometry(0.12, 1), C.skin, [0, 0, 0], null, [0.9, 1.08, 0.98]);
  // jaw: slightly narrower block for a stronger face silhouette
  mesh(head, new THREE.BoxGeometry(0.15, 0.07, 0.13), C.skin, [0, -0.07, 0.02]);
  // face features (flat colored shapes)
  for (const side of [-1, 1]) {
    mesh(head, new THREE.BoxGeometry(0.035, 0.012, 0.01), C.eye, [side * 0.04, 0.012, 0.112]);
    mesh(head, new THREE.BoxGeometry(0.045, 0.012, 0.012), C.brow, [side * 0.042, 0.04, 0.11], [0, 0, side * (female ? -0.05 : -0.18)]);
    mesh(head, new THREE.BoxGeometry(0.025, 0.045, 0.035), C.skin, [side * 0.11, -0.005, 0.0]); // ear
  }
  mesh(head, new THREE.ConeGeometry(0.016, 0.05, 4), C.skin, [0, -0.012, 0.12], [Math.PI / 2 - 0.25, Math.PI / 4, 0]); // nose
  mesh(head, new THREE.BoxGeometry(0.04, 0.009, 0.01), C.lip, [0, -0.06, 0.112]);

  // hair: back + sides, fringe
  mesh(head, new THREE.SphereGeometry(0.128, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.58), C.hair, [0, 0.015, -0.012], [-0.4, 0, 0]);
  for (const side of [-1, 1]) mesh(head, new THREE.BoxGeometry(0.03, 0.12, 0.07), C.hair, [side * 0.112, 0.0, 0.02]);
  if (!female) {
    for (let i = -2; i <= 2; i++) // spiky fringe
      mesh(head, new THREE.ConeGeometry(0.022, 0.07, 3), C.hair, [i * 0.035, 0.07, 0.1], [Math.PI - 0.6, 0, i * 0.15]);
  }

  // braids hanging in front of the shoulders
  const braids = [];
  if (opts.braids) {
    for (const side of [-1, 1]) {
      const b = pivot(head, [side * 0.1, -0.06, 0.04]);
      const n = female ? 8 : 4;
      for (let i = 0; i < n; i++) {
        const seg = mesh(b, new THREE.OctahedronGeometry(0.028, 0), C.hair, [0, -i * 0.055, 0]);
        seg.scale.y = 1.4;
      }
      mesh(b, new THREE.ConeGeometry(0.03, 0.06, 5), female ? C.buckle : C.fur, [0, -n * 0.055 - 0.01, 0], [Math.PI, 0, 0]); // tip / ring
      b.rotation.x = -0.25;
      braids.push(b);
    }
  }

  // ---- hats ----
  let ribbon = null;
  if (opts.hat === 'furHat') {
    // big shaggy fur brim + red top + red ribbon tail (Temujin turnaround sheet)
    const hat = pivot(head, [0, 0.085, 0]);
    mesh(hat, new THREE.CylinderGeometry(0.15, 0.16, 0.12, 10), C.fur, [0, 0.02, 0]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      mesh(hat, new THREE.DodecahedronGeometry(0.05, 0), C.fur, [Math.sin(a) * 0.15, 0.01 + (i % 2) * 0.03, Math.cos(a) * 0.15]);
    }
    mesh(hat, new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), C.hat, [0, 0.07, 0], null, [1, 0.9, 1]);
    mesh(hat, new THREE.CylinderGeometry(0.018, 0.025, 0.06, 6), C.hat, [0, 0.17, 0]);
    ribbon = pivot(hat, [0, 0.19, 0]);
    mesh(ribbon, new THREE.BoxGeometry(0.05, 0.012, 0.22), C.ribbon, [0.0, 0.0, -0.11]);
    mesh(ribbon, new THREE.BoxGeometry(0.045, 0.012, 0.18), C.ribbon, [0.0, -0.06, -0.27], [0.6, 0, 0]);
    ribbon.rotation.set(0.25, 0.4, 0);
  } else if (opts.hat === 'furCap') {
    const hat = pivot(head, [0, 0.07, 0]);
    mesh(hat, new THREE.SphereGeometry(0.13, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.hat, [0, 0.02, 0], null, [1, 0.85, 1]);
    mesh(hat, new THREE.TorusGeometry(0.128, 0.035, 5, 14), C.fur, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
    mesh(hat, new THREE.CylinderGeometry(0.03, 0.03, 0.012, 10), C.buckle, [0, 0.07, 0.115], [Math.PI / 2 - 0.5, 0, 0]);
    ribbon = pivot(hat, [-0.06, 0.0, -0.11]);
    mesh(ribbon, new THREE.BoxGeometry(0.07, 0.3, 0.015), C.ribbon, [0, -0.15, 0]);
    ribbon.rotation.set(0.2, 0, 0.15);
  }

  // ---- animation ----
  const rig = { hips, torso, skirt, legs, arms, neck, head, braids, ribbon };
  const restArmZ = arms.map((a) => a.shoulder.rotation.z);

  /** phase: walk cycle phase (rad), amount: 0 idle .. 1 full walk, t: time (s) */
  function pose(t, phase, amount) {
    const a = amount;
    const breathe = Math.sin(t * 1.8) * 0.012 * (1 - a);
    rig.hips.position.y = legLen + Math.abs(Math.sin(phase)) * 0.035 * a - 0.015 * a;
    rig.torso.rotation.x = 0.06 * a + breathe;
    rig.torso.rotation.y = Math.sin(phase) * 0.08 * a;
    rig.skirt.rotation.x = Math.sin(phase * 2) * 0.03 * a;
    rig.legs.forEach((l, i) => {
      const p = phase + i * Math.PI;
      l.hip.rotation.x = Math.sin(p) * 0.55 * a;
      l.knee.rotation.x = Math.max(0, -Math.cos(p)) * 0.8 * a;
    });
    rig.arms.forEach((ar, i) => {
      const p = phase + i * Math.PI;
      ar.shoulder.rotation.x = -Math.sin(p) * 0.45 * a + Math.sin(t * 1.8 + i) * 0.02 * (1 - a);
      ar.shoulder.rotation.z = restArmZ[i];
      ar.elbow.rotation.x = -(0.25 + Math.max(0, Math.sin(p)) * 0.35) * a - 0.12 * (1 - a);
    });
    rig.braids.forEach((b, i) => { b.rotation.x = -0.25 + Math.sin(phase * 2 + i) * 0.08 * a; });
    if (rig.ribbon) rig.ribbon.rotation.x = 0.25 + Math.sin(t * 3.2) * 0.12 + 0.2 * a;
  }
  pose(0, 0, 0);
  return { root, rig, pose, height: H };
}
