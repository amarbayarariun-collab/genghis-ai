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

/** Even fur roll. One height all the way around, curled up, no side spikes. */
function curledBrimGeometry(tall) {
  // Lip is the outer edge and stays below the crown, the same height all around.
  const profile = [
    [0.072, 1.300],
    [0.086, 1.318],
    [0.098, 1.348],
    [0.108, 1.378],
    [0.114, 1.400],
    [0.110, 1.412],
    [0.100, 1.418],
  ];
  const pts = [];
  for (const [r, y] of profile) pts.push(new THREE.Vector2(r * tall, y * tall));
  for (let i = profile.length - 2; i >= 0; i--) {
    const [r, y] = profile[i];
    pts.push(new THREE.Vector2(Math.max(0.072, r - 0.012) * tall, (y + 0.008) * tall));
  }
  return new THREE.LatheGeometry(pts, 48);
}

/** Low brown fur malgai. One even rolled brim. No cone, no pompon, no boards over the eyes. */
export function mongolHat(tall = 1) {
  const g = new THREE.Group();
  g.name = 'mongol-hat';
  const fur = flat('#c4a06a');
  const hide = flat('#5c3a22');
  // Dome on the cut crown. Pulled back so it does not shelf over the eyes.
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.10 * tall, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    hide
  );
  crown.scale.set(1.0, 1.95, 1.08);
  crown.position.y = 1.30 * tall;
  // One even roll. No ear boards in front of the eyes.
  const brim = new THREE.Mesh(curledBrimGeometry(tall), fur);
  g.add(brim, crown);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function pivot(parent, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

export function person({ deel = '#8a1a22', skin = '#c48a5e', tall = 1 } = {}) {
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
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14 * t, 0.018 * t, 5, 10), flat('#6a4428'));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.24 * t;
  const hat = mongolHat(t);
  // The low-poly head is a ball. Sit the brim on the brow so the crown covers it.
  hat.position.y = 0.07 * t;
  g.add(body, head, hat, collar);

  const leg = (z) => {
    const hip = pivot(g, 0.02 * t, 0.82 * t, z * t);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * t, 0.09 * t, 0.42 * t, 6), pantMat);
    thigh.position.y = -0.21 * t;
    const knee = pivot(hip, 0, -0.42 * t, 0);
    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.11 * t, 8, 6), pantMat);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * t, 0.07 * t, 0.36 * t, 6), pantMat);
    shin.position.y = -0.18 * t;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14 * t, 0.06 * t, 0.08 * t), bootMat);
    foot.name = 'foot';
    foot.position.set(0.02 * t, -0.38 * t, 0);
    knee.add(kneeBall, shin, foot);
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
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055 * t, 8, 6), skinMat);
    hand.name = 'hand';
    hand.position.y = -0.26 * t;
    elbow.add(fore, hand);
    shoulder.add(upper);
    return { shoulder, elbow, hand };
  };
  g.userData.limbs = { legL: leg(-0.52), legR: leg(0.52), armL: arm(-0.32), armR: arm(0.32) };
  g.userData.tall = t;
  g.userData.hipY = 0.82 * t;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Thighs fold forward along the barrel. Shins rake back into the stirrups. */
export function poseRide(rider) {
  const L = rider?.userData?.limbs;
  if (!L) return;
  const tall = rider.userData.tall || 1;
  const thigh = 1.02;
  const shin = -1.72;
  L.legL.hip.position.x = 0.28 * tall;
  L.legR.hip.position.x = 0.02 * tall;
  L.legL.hip.rotation.z = thigh;
  L.legR.hip.rotation.z = thigh;
  L.legL.knee.rotation.z = shin;
  L.legR.knee.rotation.z = shin;
  const footLevel = -(thigh + shin);
  L.legL.foot.rotation.z = footLevel;
  L.legR.foot.rotation.z = footLevel;
  L.armL.shoulder.rotation.z = 1.25;
  L.armR.shoulder.rotation.z = 1.25;
  L.armL.elbow.rotation.z = -0.7;
  L.armR.elbow.rotation.z = -0.7;
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

export function horse(color = '#6b4228', opts = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: '#3a2418' });
  const leather = flat('#9a5430');
  const metal = flat('#c5c8cc');
  // Barrel along +X. Top of the back is about y=1.42. Head is further forward.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.15, 12), m);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(-0.12, 1.14, 0);
  const hind = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), m);
  hind.scale.set(0.85, 0.95, 0.78);
  hind.position.set(-0.62, 1.16, 0);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), m);
  chest.scale.set(0.9, 0.92, 0.75);
  chest.position.set(0.48, 1.08, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.58, 10), m);
  neck.position.set(0.78, 1.34, 0);
  neck.rotation.z = -0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), m);
  head.name = 'horse-head';
  head.scale.set(1.65, 0.82, 0.7);
  head.position.set(1.16, 1.52, 0);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m);
  muzzle.scale.set(1.55, 0.72, 0.66);
  muzzle.position.set(1.46, 1.46, 0);
  const earGeo = new THREE.ConeGeometry(0.04, 0.14, 5);
  const earL = new THREE.Mesh(earGeo, dark);
  earL.position.set(1.16, 1.68, -0.05);
  const earR = new THREE.Mesh(earGeo, dark);
  earR.position.set(1.16, 1.68, 0.05);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark);
  mane.scale.set(2.4, 0.55, 0.6);
  mane.position.set(0.78, 1.58, 0);
  mane.rotation.z = -0.7;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.7, 6), dark);
  tail.position.set(-0.92, 0.95, 0);
  tail.rotation.z = 0.25;
  const bit = new THREE.Object3D();
  bit.name = 'bit';
  bit.position.set(1.58, 1.44, 0);
  const legPivots = [];
  const addLeg = (x, z, side) => {
    const hip = new THREE.Group();
    hip.name = side;
    hip.position.set(x, 0.86, z);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.4, 8), m);
    upper.position.y = -0.2;
    const hock = new THREE.Group();
    hock.position.y = -0.4;
    hock.rotation.z = side === 'hip-back' ? 0.4 : -0.28;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.38, 8), m);
    lower.position.y = -0.16;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.06, 8), dark);
    hoof.position.y = -0.36;
    hock.add(lower, hoof);
    hip.add(upper, hock);
    g.add(hip);
    legPivots.push(hip);
  };
  addLeg(-0.58, -0.12, 'hip-back');
  addLeg(-0.58, 0.12, 'hip-back');
  addLeg(0.42, -0.12, 'hip-front');
  addLeg(0.42, 0.12, 'hip-front');
  const saddle = new THREE.Group();
  saddle.name = 'saddle-anchor';
  saddle.position.set(-0.16, 1.7, 0);
  const tack = [];
  if (opts.saddle !== false) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.34), leather);
    pad.name = 'saddle-pad';
    pad.position.y = -0.1;
    const cantle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.28), leather);
    cantle.position.set(-0.16, 0.05, 0);
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.18), leather);
    pommel.position.set(0.14, 0.04, 0);
    saddle.add(pad, cantle, pommel);
    const stirrupL = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 14), metal);
    stirrupL.name = 'stirrup';
    stirrupL.position.set(0.2, 1.15, 0.58);
    stirrupL.rotation.y = Math.PI / 2;
    const stirrupR = stirrupL.clone();
    stirrupR.name = 'stirrup';
    stirrupR.position.z = -0.58;
    tack.push(stirrupL, stirrupR);
  }
  g.add(barrel, hind, chest, neck, head, muzzle, earL, earR, mane, tail, bit, saddle, ...tack);
  g.userData.legs = legPivots;
  g.userData.saddle = saddle;
  g.userData.head = head;
  g.userData.bit = bit;
  g.userData.phase = 0;
  g.userData.gait = 'idle';
  // Leg order: back z-, back z+, front z-, front z+. Swing is around Z, in the horse's side plane.
  const offsets = {
    walk: [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5],
    trot: [0, Math.PI, Math.PI, 0],
    canter: [0.15, Math.PI * 0.9, 0, Math.PI],
    gallop: [0, 0.4, Math.PI + 0.15, Math.PI + 0.5],
  };
  g.userData.step = (dt, speed = 0) => {
    const s = Math.max(0, speed || 0);
    const gait = s < 0.4 ? 'idle' : s < 3.2 ? 'walk' : s < 6.2 ? 'trot' : s < 10 ? 'canter' : 'gallop';
    g.userData.gait = gait;
    if (gait === 'idle') {
      for (const hip of legPivots) hip.rotation.z += (0 - hip.rotation.z) * Math.min(1, (dt || 0) * 6);
      return gait;
    }
    const freq = gait === 'walk' ? 1.35 : gait === 'trot' ? 2.15 : gait === 'canter' ? 2.55 : 3.3;
    const amp = gait === 'walk' ? 0.5 : gait === 'trot' ? 0.72 : gait === 'canter' ? 0.9 : 1.05;
    g.userData.phase += Math.max(0, dt || 0) * freq * Math.PI * 2;
    const off = offsets[gait];
    legPivots.forEach((hip, i) => {
      hip.rotation.z = Math.sin(g.userData.phase + off[i]) * amp;
    });
    return gait;
  };
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
  const oldReins = [];
  mount.traverse((o) => { if (o.name === 'reins') oldReins.push(o); });
  for (const r of oldReins) r.parent?.remove(r);
  const bit = mount.userData.bit;
  if (bit && hands.length) {
    const bitLocal = bit.position.clone();
    const reinMat = flat('#2a160e');
    for (const hand of hands) {
      hand.getWorldPosition(_seatWp);
      const local = _seatWp.clone().applyMatrix4(_seatInv);
      const dir = local.clone().sub(bitLocal);
      const len = Math.max(0.08, dir.length());
      const rein = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), reinMat);
      rein.name = 'reins';
      rein.position.copy(bitLocal).add(local).multiplyScalar(0.5);
      rein.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
      mount.add(rein);
    }
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
