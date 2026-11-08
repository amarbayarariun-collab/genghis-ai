// Low-poly horse with jointed legs, used for the galloping herd and the horse
// Temujin leads by the reins. Flat colours only, no textures.
//
//   createHorse({ coat, mane, saddle }) -> THREE.Group  (hooves at y=0, facing +Z)
//   group.userData.update(dt, speed)   speed in m/s: 0 idle, ~1.5 walk, 6+ gallop
//   group.userData.head                Object3D at the bridle (for reins)
//   group.userData.saddle              Object3D on top of the seat (rider's pelvis goes here)

import * as THREE from 'three';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

export function createHorse({ coat = '#9a5a30', mane = '#2a1a12', belly = null, saddle = false } = {}) {
  const C = lam(coat), D = lam(mane), B = lam(belly || coat), hoof = lam('#2b2018');
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.25;
  g.add(body);

  // barrel: stretched capsule, slightly deeper at the chest
  const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.1, 4, 10), C);
  barrel.rotation.x = Math.PI / 2;
  barrel.scale.set(0.95, 1, 1.12);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), C);
  chest.position.set(0, 0.02, 0.62);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.43, 10, 8), C);
  rump.position.set(0, 0.06, -0.6);
  const under = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), B);
  under.rotation.x = Math.PI / 2;
  under.position.y = -0.14;
  body.add(barrel, chest, rump, under);

  // neck + head on a pivot so it can bob
  const neck = new THREE.Group();
  neck.position.set(0, 0.2, 0.78);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.95, 8), C);
  neckMesh.position.set(0, 0.38, 0.18);
  neckMesh.rotation.x = 0.55;
  const maneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.95, 0.22), D);
  maneMesh.position.set(0, 0.45, 0.0);
  maneMesh.rotation.x = 0.55;
  const head = new THREE.Group();
  head.position.set(0, 0.82, 0.45);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.42), C);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), C);
  muzzle.position.set(0, -0.1, 0.3);
  muzzle.rotation.x = 0.35;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.08), D);
  nose.position.set(0, -0.17, 0.44);
  const ears = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), C);
    e.position.set(s * 0.08, 0.2, -0.1);
    return e;
  });
  head.add(skull, muzzle, nose, ...ears);
  head.rotation.x = 0.55;
  neck.add(neckMesh, maneMesh, head);
  body.add(neck);

  // tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.15, -0.98);
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.85, 6), D);
  tailMesh.position.y = -0.4;
  tailMesh.rotation.x = Math.PI;
  tail.add(tailMesh);
  tail.rotation.x = 0.35;
  body.add(tail);

  // legs: hip pivot -> upper, knee pivot -> lower + hoof
  const legs = [];
  for (const [x, z, front] of [[-0.2, 0.62, 1], [0.2, 0.62, 1], [-0.2, -0.6, 0], [0.2, -0.6, 0]]) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.12, z);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.6, 6), C);
    up.position.y = -0.3;
    const knee = new THREE.Group();
    knee.position.y = -0.58;
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.5, 6), C);
    low.position.y = -0.25;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 6), hoof);
    h.position.y = -0.52;
    knee.add(low, h);
    hip.add(up, knee);
    body.add(hip);
    legs.push({ hip, knee, front });
  }

  const seat = new THREE.Object3D();
  seat.position.set(0, 0.57, 0.05); // top of the saddle, rides with the body bob
  body.add(seat);
  g.userData.saddle = seat;

  if (saddle) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.07, 0.75), lam('#7a2420'));
    pad.position.set(0, 0.42, 0.05);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.55), lam('#4a2e1c'));
    seat.position.set(0, 0.5, 0.05);
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), lam('#4a2e1c'));
    pommel.position.set(0, 0.58, 0.3);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.35), lam('#6a4426'));
    bag.position.set(0.42, 0.2, -0.25);
    body.add(pad, seat, pommel, bag);
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // gait: blend a walk (4-beat, small swing) into a gallop (big swing, body pitch)
  let phase = Math.random() * 6;
  let bob = 0;
  g.userData.head = head;
  g.userData.update = (dt, speed = 0) => {
    const gallop = THREE.MathUtils.clamp((speed - 2) / 4, 0, 1);
    const walk = THREE.MathUtils.clamp(speed / 1.5, 0, 1);
    phase += dt * (speed < 0.05 ? 0 : 3.5 + speed * 1.3);
    const amp = 0.35 * walk + 0.45 * gallop;
    legs.forEach((l, i) => {
      // walk: diagonal pairs; gallop: fronts together, backs together
      const off = gallop > 0.5 ? (l.front ? 0 : Math.PI * 0.9) + (i % 2) * 0.35 : [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5][i];
      const s = Math.sin(phase + off);
      l.hip.rotation.x = s * amp;
      l.knee.rotation.x = (l.front ? 1 : -1) * Math.max(0, Math.cos(phase + off)) * amp * 1.4;
    });
    bob = Math.sin(phase * 2) * 0.05 * walk + Math.sin(phase) * 0.12 * gallop;
    body.position.y = 1.25 + bob;
    body.rotation.x = Math.sin(phase) * 0.06 * gallop;
    neck.rotation.x = Math.sin(phase + 0.6) * (0.06 + 0.12 * gallop) + (speed < 0.05 ? 0.25 + Math.sin(performance.now() / 1400) * 0.06 : 0);
    tail.rotation.x = 0.35 + gallop * 0.6 + Math.sin(phase * 1.5) * 0.08;
  };
  g.userData.update(0, 0);
  return g;
}
