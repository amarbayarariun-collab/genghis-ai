// Shared low-poly props for dense camps (Mongolian palette).
import * as THREE from 'three';

export const flat = (color, opts = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });

export function skyDome({ top, mid, horizon, bottom }, radius = 300) {
  const uniforms = {
    top: { value: new THREE.Color(top) },
    mid: { value: new THREE.Color(mid || horizon) },
    horizon: { value: new THREE.Color(horizon) },
    bottom: { value: new THREE.Color(bottom) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, mid, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c;
        if (h > 0.045) c = mix(mid, top, pow(clamp((h - 0.045) / 0.35, 0.0, 1.0), 0.55));
        else if (h > -0.01) c = mix(horizon, mid, clamp((h + 0.01) / 0.055, 0.0, 1.0));
        else c = mix(bottom, horizon, pow(clamp((-h - 0.01) / 0.25, 0.0, 1.0), 0.8));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(Math.min(radius, 150), 28, 18), mat);
}

/** Low fur malgai. Wide brim, flat crown, ear flaps. No cone and no pompon. */
export function mongolHat(tall = 1) {
  const g = new THREE.Group();
  g.name = 'mongol-hat';
  const fur = flat('#c4a574');
  const hide = flat('#6a4424');
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * tall, 0.28 * tall, 0.035 * tall, 16), fur);
  brim.position.y = 1.33 * tall;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * tall, 0.15 * tall, 0.07 * tall, 12), hide);
  crown.position.y = 1.38 * tall;
  const flapGeo = new THREE.BoxGeometry(0.07 * tall, 0.26 * tall, 0.04 * tall);
  const flapL = new THREE.Mesh(flapGeo, fur);
  flapL.position.set(-0.2 * tall, 1.16 * tall, 0.02 * tall);
  const flapR = new THREE.Mesh(flapGeo, fur);
  flapR.position.set(0.2 * tall, 1.16 * tall, 0.02 * tall);
  g.add(brim, crown, flapL, flapR);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function pivot(parent, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

export function person({ deel = '#8a1a22', fur = '#e2d0b0', skin = '#c48a5e', tall = 1 } = {}) {
  const g = new THREE.Group();
  const t = tall;
  const deelMat = flat(deel);
  const skinMat = flat(skin);
  const bootMat = flat('#3a2416');
  const pantMat = flat('#f0d090');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * t, 0.24 * t, 0.5 * t, 8), deelMat);
  body.position.y = 1.05 * t;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 * t, 1), skinMat);
  head.name = 'head';
  head.position.y = 1.4 * t;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17 * t, 0.045 * t, 5, 10), flat(fur));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.24 * t;
  g.add(body, head, mongolHat(t), collar);

  const leg = (z) => {
    const hip = pivot(g, 0.02 * t, 0.82 * t, z * t);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * t, 0.08 * t, 0.38 * t, 6), pantMat);
    thigh.position.y = -0.18 * t;
    const knee = pivot(hip, 0, -0.36 * t, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * t, 0.06 * t, 0.34 * t, 6), bootMat);
    shin.position.y = -0.16 * t;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08 * t, 0.045 * t, 0.16 * t), bootMat);
    foot.name = 'foot';
    foot.position.set(0.04 * t, -0.34 * t, 0);
    knee.add(shin, foot);
    hip.add(thigh);
    return { hip, knee, foot };
  };
  const arm = (z) => {
    const shoulder = pivot(g, 0.02 * t, 1.22 * t, z * t);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * t, 0.036 * t, 0.26 * t, 5), deelMat);
    upper.position.y = -0.13 * t;
    const elbow = pivot(shoulder, 0, -0.26 * t, 0);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.034 * t, 0.03 * t, 0.24 * t, 5), skinMat);
    fore.position.y = -0.12 * t;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035 * t, 6, 5), skinMat);
    hand.name = 'hand';
    hand.position.y = -0.26 * t;
    elbow.add(fore, hand);
    shoulder.add(upper);
    return { shoulder, elbow, hand };
  };
  g.userData.limbs = { legL: leg(-0.5), legR: leg(0.5), armL: arm(-0.28), armR: arm(0.28) };
  g.userData.tall = t;
  g.userData.hipY = 0.82 * t;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Thighs forward, shins straight down, hands out to the reins. Mesh pivots only. */
export function poseRide(rider) {
  const L = rider?.userData?.limbs;
  if (!L) return;
  const right = Math.PI / 2;
  L.legL.hip.rotation.z = right;
  L.legR.hip.rotation.z = right;
  L.legL.knee.rotation.z = -right;
  L.legR.knee.rotation.z = -right;
  L.armL.shoulder.rotation.z = 1.05;
  L.armR.shoulder.rotation.z = 1.05;
  L.armL.elbow.rotation.z = -0.95;
  L.armR.elbow.rotation.z = -0.95;
  rider.userData.mounted = true;
}

export function makeGer(s = 1, doorColor = '#9a2a28') {
  const g = new THREE.Group();
  const felt = flat('#efe6d4');
  const feltShade = flat('#d8cfc0');
  const wood = flat('#7a5a38');
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.05, 2.35, 16), felt);
  wall.position.y = 1.15;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.28, 16), wood);
  band.position.y = 0.35;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.35, 1.7, 16), feltShade);
  roof.position.y = 3.15;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.35, 10), wood);
  crown.position.y = 4.1;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.65, 0.18), flat(doorColor));
  door.position.set(0, 0.82, 3.0);
  g.add(wall, band, roof, crown, door);
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

const _seatWp = new THREE.Vector3();
const _seatInv = new THREE.Matrix4();

export function horse(color = '#c4894a') {
  const g = new THREE.Group();
  const m = flat(color);
  const dark = flat('#3a2416');
  const leather = flat('#8d4e2a');
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.7, 0.5), m);
  body.position.set(0, 1.02, 0);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.26), m);
  neck.position.set(0.98, 1.22, 0);
  neck.rotation.z = -0.45;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.22), m);
  head.name = 'horse-head';
  head.position.set(1.45, 1.42, 0);
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.28), dark);
  mane.position.set(0.82, 1.4, 0);
  const legPivots = [];
  [[-0.72, -0.16, 'hip-back'], [-0.72, 0.16, 'hip-back'], [0.62, -0.16, 'hip-front'], [0.62, 0.16, 'hip-front']].forEach(([x, z, side]) => {
    const hip = new THREE.Group();
    hip.name = side;
    hip.position.set(x, 0.72, z);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), m);
    leg.position.y = -0.35;
    hip.add(leg);
    g.add(hip);
    legPivots.push(hip);
  });
  // Seat is on the barrel, more than a metre behind the head.
  const saddle = new THREE.Group();
  saddle.name = 'saddle-anchor';
  saddle.position.set(-0.32, 1.62, 0);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.4), leather);
  pad.name = 'saddle-pad';
  pad.position.y = -0.1;
  const cantle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.38), leather);
  cantle.position.set(-0.2, 0.06, 0);
  saddle.add(pad, cantle);
  const stirrupL = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12), dark);
  stirrupL.name = 'stirrup';
  stirrupL.position.set(0, 0.7, 0.5);
  stirrupL.rotation.y = Math.PI / 2;
  const stirrupR = stirrupL.clone();
  stirrupR.name = 'stirrup';
  stirrupR.position.z = -0.5;
  const reins = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), flat('#1a120c'));
  reins.name = 'reins';
  reins.rotation.x = Math.PI / 2;
  g.add(body, neck, head, mane, saddle, stirrupL, stirrupR, reins);
  g.userData.legs = legPivots;
  g.userData.saddle = saddle;
  g.userData.head = head;
  g.userData.reins = reins;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Parent a soldier to the saddle. Hips on the pad, feet in the stirrups, hands on the reins. */
export function seatRider(mount, rider) {
  const saddle = mount?.userData?.saddle;
  if (!saddle || !rider) return null;
  saddle.add(rider);
  const hip = rider.userData.hipY || 0.82 * (rider.userData.tall || 1);
  rider.position.set(0, -hip, 0);
  rider.rotation.set(0, 0, 0);
  poseRide(rider);
  mount.updateMatrixWorld(true);
  _seatInv.copy(mount.matrixWorld).invert();
  const feet = [];
  const hands = [];
  rider.traverse((o) => {
    if (o.name === 'foot') feet.push(o);
    if (o.name === 'hand') hands.push(o);
  });
  const stirrups = [];
  mount.traverse((o) => { if (o.name === 'stirrup') stirrups.push(o); });
  for (const foot of feet) {
    foot.getWorldPosition(_seatWp);
    const local = _seatWp.clone().applyMatrix4(_seatInv);
    let best = null;
    let bestD = Infinity;
    for (const s of stirrups) {
      const d = Math.abs((s.userData.homeZ ?? s.position.z) - local.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) continue;
    best.userData.homeZ = local.z;
    best.position.copy(local);
  }
  if (hands.length && mount.userData.reins) {
    const mid = new THREE.Vector3();
    for (const hand of hands) {
      hand.getWorldPosition(_seatWp);
      mid.add(_seatWp);
    }
    mid.multiplyScalar(1 / hands.length).applyMatrix4(_seatInv);
    mount.userData.reins.position.copy(mid);
  }
  return saddle;
}

export function glowRing(color = '#e8c37a') {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  return ring;
}

export function scatterGrass(scene, heightAt, count = 1800, spread = 55, color = '#9ab04a') {
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.55, 4);
  const mesh = new THREE.InstancedMesh(tuftGeo, flat(color), count);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread * 2;
    const z = (Math.random() - 0.5) * spread * 2;
    if (Math.hypot(x, z) < 2.2) continue;
    dummy.position.set(x, heightAt(x, z) + 0.22, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.6 + Math.random() * 1.1);
    dummy.updateMatrix();
    mesh.setMatrixAt(n++, dummy.matrix);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

export function scatterRocks(scene, heightAt, count = 40, spread = 50) {
  const mat = flat('#6a655e');
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread * 2;
    const z = (Math.random() - 0.5) * spread * 2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.9, 0), mat);
    r.position.set(x, heightAt(x, z) + 0.08, z);
    r.rotation.set(Math.random(), Math.random(), Math.random());
    r.castShadow = true;
    scene.add(r);
  }
}

export function terrainMesh(heightAt, size = 220, seg = 70, colorFn) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  const flatGeo = geo.toNonIndexed();
  flatGeo.computeVertexNormals();
  const cols = new Float32Array(flatGeo.attributes.position.count * 3);
  const cA = new THREE.Color('#7a9a3a');
  const cB = new THREE.Color('#c4a84a');
  for (let i = 0; i < flatGeo.attributes.position.count; i++) {
    const x = flatGeo.attributes.position.getX(i);
    const z = flatGeo.attributes.position.getZ(i);
    const y = flatGeo.attributes.position.getY(i);
    let c;
    if (colorFn) c = colorFn(x, y, z);
    else c = cA.clone().lerp(cB, 0.3 + Math.sin(x * 0.05) * 0.2);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  flatGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(flatGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function campfire(scene, x, z, heightAt, lights = true) {
  const y = heightAt(x, z);
  const logMat = flat('#3a2818');
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.set(x, y + 0.12, z);
    scene.add(log);
  }
  const ember = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.7, 6),
    new THREE.MeshBasicMaterial({ color: '#ff9a3c' })
  );
  ember.position.set(x, y + 0.45, z);
  scene.add(ember);
  let light = null;
  if (lights) {
    light = new THREE.PointLight('#ff8a40', 1.8, 14, 2);
    light.position.set(x, y + 1.2, z);
    scene.add(light);
  }
  return { ember, light, x, z, y, radius: 7.5 };
}

export function moonDisc(scene, pos = [-60, 70, -40]) {
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshBasicMaterial({ color: '#f2f6ff', fog: false })
  );
  moon.position.set(...pos);
  moon.lookAt(0, 10, 0);
  scene.add(moon);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 24),
    new THREE.MeshBasicMaterial({ color: '#9aafd4', transparent: true, opacity: 0.16, fog: false, depthWrite: false })
  );
  glow.position.copy(moon.position);
  glow.lookAt(0, 10, 0);
  scene.add(glow);
  return moon;
}
