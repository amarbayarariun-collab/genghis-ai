// Low-poly Mongolian horse (short, stocky, thick neck, long mane and tail).
// Flat colours only. Faces +Z. ~1.35 m at the withers. Legs pivot at the
// shoulder/hip so walk, trot and gallop can be driven from one phase.
import * as THREE from 'three';

const lam = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function createHorse({ coat = '#6a4328', mane = '#1e1712', saddle = false } = {}) {
  const root = new THREE.Group();
  root.name = 'horse';
  const cM = lam(coat);
  const mM = lam(mane);
  const hoof = lam('#2a2420');

  const body = new THREE.Group();
  body.position.y = 0.92;
  root.add(body);
  // barrel: tapered capsule-ish (two boxes + a rounded belly)
  const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.78, 3, 7), cM);
  barrel.rotation.x = Math.PI / 2;
  barrel.scale.set(1, 1, 1.12);
  barrel.castShadow = true;
  body.add(barrel);
  box(0.5, 0.42, 0.42, cM, 0, 0.04, -0.46, body); // rump
  box(0.48, 0.46, 0.36, cM, 0, 0.06, 0.42, body); // chest

  // neck + head
  const neck = new THREE.Group();
  neck.position.set(0, 0.2, 0.52);
  body.add(neck);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.62, 6), cM);
  neckM.position.set(0, 0.22, 0.12);
  neckM.rotation.x = 0.75;
  neckM.castShadow = true;
  neck.add(neckM);
  const head = new THREE.Group();
  head.position.set(0, 0.46, 0.34);
  neck.add(head);
  const skull = box(0.2, 0.22, 0.3, cM, 0, 0, 0.02, head);
  skull.rotation.x = 0.25;
  const muzzle = box(0.15, 0.16, 0.24, cM, 0, -0.1, 0.22, head);
  muzzle.rotation.x = 0.55;
  box(0.152, 0.07, 0.08, mM, 0, -0.18, 0.31, head); // nose
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), cM);
    ear.position.set(s * 0.07, 0.15, -0.06);
    head.add(ear);
  }
  // mane: a row of flat shards down the neck + forelock
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const shard = box(0.05, 0.16, 0.12, mM, 0, 0.5 - t * 0.42, 0.28 - t * 0.36, neck);
    shard.rotation.x = 0.6;
  }
  box(0.08, 0.1, 0.06, mM, 0, 0.13, 0.09, head);
  if (saddle) {
    // white blaze down the face + leather bridle with brass studs
    const blaze = box(0.06, 0.02, 0.3, lam('#efe6d6'), 0, 0.06, 0.12, head);
    blaze.rotation.x = 0.45;
    const strap = lam('#3b2416');
    const brass = lam('#c9a24a');
    const nb = box(0.17, 0.035, 0.035, strap, 0, -0.08, 0.27, head); nb.rotation.x = 0.55;
    for (const sx of [-1, 1]) {
      const ch = box(0.02, 0.24, 0.035, strap, sx * 0.105, -0.02, 0.06, head); ch.rotation.x = 0.3;
      box(0.03, 0.05, 0.05, brass, sx * 0.11, -0.04, 0.17, head);
      const rein = box(0.015, 0.015, 0.62, strap, sx * 0.12, -0.12, -0.18, neck);
      rein.rotation.x = -0.35;
    }
    // breast collar with a round brass medallion and tassel
    box(0.5, 0.06, 0.04, strap, 0, 0.0, 0.62, body);
    const med = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), brass);
    med.rotation.x = Math.PI / 2; med.position.set(0, -0.02, 0.65); body.add(med);
    box(0.04, 0.12, 0.04, lam('#e8dcc0'), 0, -0.12, 0.65, body);
  }

  // tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.66);
  body.add(tail);
  const tailM = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.72, 5), mM);
  tailM.position.set(0, -0.32, -0.08);
  tailM.rotation.x = Math.PI + 0.25;
  tailM.castShadow = true;
  tail.add(tailM);

  // legs: [x, z, front?]
  const legs = [];
  for (const [x, z, front] of [[-0.15, 0.4, 1], [0.15, 0.4, 1], [-0.15, -0.45, 0], [0.15, -0.45, 0]]) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.12, z);
    body.add(hip);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.42, 5), cM);
    upper.position.y = -0.2;
    upper.castShadow = true;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    hip.add(knee);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.36, 5), cM);
    lower.position.y = -0.18;
    lower.castShadow = true;
    knee.add(lower);
    box(0.09, 0.07, 0.11, hoof, 0, -0.38, 0.01, knee);
    legs.push({ hip, knee, front, side: x < 0 ? 0 : 1 });
  }

  if (saddle) {
    const leather = lam('#7a4a26');
    const felt = lam('#9b2d24');
    // red saddle cloth hanging down both flanks with a gold border and endless-knot patch
    const gold = lam('#d4a24a');
    box(0.5, 0.04, 0.6, felt, 0, 0.3, 0.02, body);
    for (const sx of [-1, 1]) {
      const flap = box(0.03, 0.36, 0.56, felt, sx * 0.3, 0.13, 0.02, body);
      flap.rotation.z = sx * 0.12;
      const trim = box(0.032, 0.04, 0.58, gold, sx * 0.33, -0.05, 0.02, body);
      trim.rotation.z = sx * 0.12;
      const knot = box(0.034, 0.1, 0.1, gold, sx * 0.315, 0.13, 0.02, body);
      knot.rotation.x = Math.PI / 4;
      // saddle bag on the left
      if (sx < 0) box(0.1, 0.16, 0.18, lam('#8a5a30'), -0.37, 0.12, -0.24, body);
    }
    box(0.36, 0.1, 0.42, leather, 0, 0.36, 0.02, body);
    box(0.34, 0.14, 0.06, leather, 0, 0.44, 0.22, body); // pommel
    box(0.34, 0.1, 0.06, leather, 0, 0.42, -0.18, body); // cantle
    for (const s of [-1, 1]) box(0.02, 0.3, 0.03, lam('#3b2a1c'), s * 0.31, 0.16, 0.02, body); // stirrup straps
  }

  // gait: walk/trot/gallop share one phase; footfall offsets per leg
  const OFF = [0, 0.5, 0.75, 0.25];
  let phase = Math.random() * 10;
  let graze = 0;
  root.userData.update = (dt, t, speed = 0, opts = {}) => {
    const sp = Math.max(0, speed);
    const moving = sp > 0.15;
    phase += dt * (moving ? 2.2 + sp * 1.25 : 0);
    const amp = moving ? Math.min(0.75, 0.32 + sp * 0.07) : 0;
    legs.forEach((L, i) => {
      const p = (phase / (Math.PI * 2) + OFF[i]) * Math.PI * 2;
      L.hip.rotation.x = Math.sin(p) * amp * (L.front ? 1 : 0.9);
      L.knee.rotation.x = (L.front ? -1 : 1) * Math.max(0, Math.cos(p)) * amp * 1.1;
    });
    body.position.y = 0.92 + (moving ? Math.abs(Math.sin(phase * 2)) * Math.min(0.06, 0.012 * sp) : Math.sin(t * 1.2) * 0.006);
    body.rotation.x = moving ? Math.sin(phase * 2) * 0.03 : 0;
    // head: grazing when idle (unless ridden), bobbing when moving
    const wantGraze = !moving && opts.graze ? 1 : 0;
    graze += (wantGraze - graze) * Math.min(1, dt * 1.5);
    neck.rotation.x = graze * 1.15 + (moving ? Math.sin(phase * 2) * 0.08 : Math.sin(t * 0.7) * 0.03);
    tail.rotation.x = 0.2 + (moving ? Math.min(0.6, sp * 0.07) : 0) + Math.sin(t * 2.3) * 0.05;
    tail.rotation.z = Math.sin(t * 1.7 + 1) * 0.12;
  };
  root.userData.seatY = 1.32; // where a rider's hips sit
  return root;
}
