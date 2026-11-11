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

export function person({ deel = '#8a1a22', hat = '#3a2818', fur = '#e2d0b0', skin = '#c48a5e', tall = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * tall, 0.28 * tall, 0.85 * tall, 8), flat(deel));
  body.position.y = 0.7 * tall;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 * tall, 1), flat(skin));
  head.name = 'head';
  head.position.y = 1.25 * tall;
  g.userData.tall = tall;
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * tall, 0.16 * tall, 0.28 * tall, 8), flat(hat));
  h.position.y = 1.45 * tall;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2 * tall, 0.06 * tall, 5, 10), flat(fur));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.05 * tall;
  g.add(body, head, h, collar);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
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

export function horse(color = '#5a4030') {
  const g = new THREE.Group();
  const m = flat(color);
  const dark = flat('#2a1c14');
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.85, 0.65), m);
  body.position.y = 1.05;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.38), m);
  neck.position.set(0.7, 1.45, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 0.32), m);
  head.name = 'horse-head';
  head.position.set(1.15, 1.85, 0);
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.4), dark);
  mane.position.set(0.55, 1.55, 0);
  [[-0.55, -0.55], [-0.55, 0.55], [0.55, -0.55], [0.55, 0.55]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.18), m);
    leg.position.set(x * 0.7, 0.48, z * 0.35);
    g.add(leg);
  });
  // Saddle sits on the barrel, behind the neck. The head is at x=1.15.
  const saddle = new THREE.Group();
  saddle.name = 'saddle-anchor';
  saddle.position.set(-0.05, 1.48, 0);
  g.add(body, neck, head, mane, saddle);
  g.userData.saddle = saddle;
  g.userData.head = head;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Parent a soldier to the saddle anchor. Hips land on the barrel, not the head. */
export function seatRider(mount, rider) {
  const saddle = mount?.userData?.saddle;
  if (!saddle || !rider) return null;
  saddle.add(rider);
  const tall = rider.userData.tall || 1;
  rider.position.set(0, -0.62 * tall, 0);
  rider.rotation.set(0, 0, 0);
  rider.userData.mounted = true;
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
