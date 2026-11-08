// Shared props for dense camps (Mongolian palette): Blender GLB props when loaded
// (src/assets/models), procedural low-poly fallbacks otherwise; jointed horses and
// humanoid people from the character kit.
import * as THREE from 'three';
import { createHorse } from './characters/horse.js';
import { buildHumanoid } from './characters/humanoid.js';
import { getProp } from './assets/props.js';

/** Shared wind clock for grass sway (main.js sets windU.value = t each frame). */
export const windU = { value: 0 };

/** Adds a tip-sway in the wind to an instanced grass material (roots stay put). */
export function windSway(material, strength = 1) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uWind = windU;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #else
      vec4 ip = vec4(0.0);
      #endif
      float tip = clamp(position.y * 1.8 + 0.5, 0.0, 1.0);
      float gust = 0.6 + 0.4 * sin(uWind * 0.7 + ip.x * 0.05 - ip.z * 0.03);
      transformed.x += sin(uWind * 1.9 + ip.x * 0.35 + ip.z * 0.21) * ${(0.11 * strength).toFixed(3)} * tip * gust;
      transformed.z += cos(uWind * 1.5 + ip.z * 0.31) * ${(0.05 * strength).toFixed(3)} * tip * gust;`);
  };
  material.customProgramCacheKey = () => 'windsway-' + strength;
  material.needsUpdate = true;
  return material;
}

function shadowed(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

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
        if (h > 0.2) c = mix(mid, top, pow((h-0.2)/0.8, 0.65));
        else if (h > 0.0) c = mix(horizon, mid, h/0.2);
        else c = mix(horizon, bottom, pow(-h, 0.55));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 18), mat);
}

export function person({ deel = '#8a1a22', hat = '#3a2818', fur = '#e2d0b0', skin = '#c48a5e', tall = 1, female = false } = {}) {
  const h = buildHumanoid({
    height: 1.72 * tall,
    build: female ? 'female' : 'male',
    robeLength: 0.7,
    hat: female ? 'furCap' : 'furHat',
    furMantle: true,
    braids: female,
    colors: {
      deel, trim: '#c9a35a', inner: '#3b2a1c', belt: '#4a3020', buckle: '#b8834a',
      pants: '#3a2418', boot: '#4a3020', skin, hair: '#1c1410', fur,
      hat, ribbon: '#8e2a2c', eye: '#1c1410', brow: '#2a1a14', lip: '#9a5a48',
    },
  });
  const g = new THREE.Group();
  g.add(h.root);
  h.pose(Math.random() * 6, 0, 0);
  g.userData.rig = h.rig;
  g.userData.update = (t) => h.pose(t, 0, 0);
  /** Seated-on-horse pose (legs around the barrel, hands on the reins). */
  g.userData.sit = () => {
    h.rig.legs.forEach((l, i) => {
      l.hip.rotation.x = -1.35;
      l.hip.rotation.z = (i ? 1 : -1) * 0.32;
      l.knee.rotation.x = 1.45;
    });
    h.rig.arms.forEach((a) => { a.shoulder.rotation.x = -0.55; a.elbow.rotation.x = -1.1; });
    h.rig.torso.rotation.x = 0.1;
    g.userData.update = () => {};
    return g;
  };
  return shadowed(g);
}

/** Grass tuft geometry: Blender grass_clump when loaded, else a thin cone. */
export function grassGeometry() {
  const prop = getProp('grass_clump');
  let geo = null;
  prop?.traverse((o) => { if (!geo && o.isMesh) geo = o.geometry; });
  return geo || new THREE.ConeGeometry(0.12, 0.55, 4).translate(0, 0.275, 0);
}

export function makeGer(s = 1, doorColor = '#9a2a28') {
  const prop = getProp('ger');
  if (prop) {
    const g = new THREE.Group();
    g.add(prop);
    g.scale.setScalar(s * 0.95);
    return shadowed(g);
  }
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

export function horse(color = '#5a4030', { saddle = false } = {}) {
  const g = createHorse({ coat: color, saddle });
  // Static scenes never drive the gait; leave the horse in a grazing/idle stance.
  g.userData.update(0.016, 0);
  return shadowed(g);
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
  const tuftGeo = grassGeometry();
  const mat = windSway(new THREE.MeshLambertMaterial({ color: '#ffffff' }));
  const mesh = new THREE.InstancedMesh(tuftGeo, mat, count);
  const base = new THREE.Color(color);
  const shades = [0.82, 0.92, 1, 1.08, 1.16].map((k) => base.clone().multiplyScalar(k));
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread * 2;
    const z = (Math.random() - 0.5) * spread * 2;
    if (Math.hypot(x, z) < 2.2) continue;
    dummy.position.set(x, heightAt(x, z) + 0.02, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.6 + Math.random() * 1.1);
    dummy.updateMatrix();
    mesh.setColorAt(n, shades[n % shades.length]);
    mesh.setMatrixAt(n++, dummy.matrix);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

export function scatterRocks(scene, heightAt, count = 40, spread = 50) {
  const mat = flat('#6a655e');
  const variants = ['rock_a', 'rock_b', 'rock_c'];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread * 2;
    const z = (Math.random() - 0.5) * spread * 2;
    const prop = getProp(variants[i % variants.length]);
    if (prop) {
      prop.position.set(x, heightAt(x, z) - 0.05, z);
      prop.rotation.y = Math.random() * 6;
      prop.scale.setScalar(0.7 + Math.random() * 1.3);
      scene.add(shadowed(prop));
      continue;
    }
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
  const pile = getProp('woodpile');
  if (pile) {
    pile.position.set(x + 1.6, heightAt(x + 1.6, z + 0.6), z + 0.6);
    pile.rotation.y = 0.6;
    scene.add(shadowed(pile));
  }
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
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: '#e8eef8', fog: false })
  );
  moon.position.set(...pos);
  moon.lookAt(0, 10, 0);
  scene.add(moon);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ color: '#a8b8d8', transparent: true, opacity: 0.2, fog: false, depthWrite: false })
  );
  glow.position.copy(moon.position);
  glow.lookAt(0, 10, 0);
  scene.add(glow);
  return moon;
}

/** Blender prop placed on the terrain (null when the model is unavailable). */
export function placeProp(scene, name, x, z, heightAt, { rot = 0, scale = 1, sink = 0 } = {}) {
  const o = getProp(name);
  if (!o) return null;
  o.position.set(x, heightAt(x, z) - sink, z);
  o.rotation.y = rot;
  o.scale.setScalar(scale);
  scene.add(shadowed(o));
  return o;
}

/** Fence line from GLB panels (4.2 m each) or procedural rails. */
export function fenceLine(scene, x0, z0, x1, z1, heightAt) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  // panels/rails are authored along local +X
  const ang = Math.atan2(-(z1 - z0), x1 - x0);
  const panel = getProp('fence');
  if (panel) {
    const n = Math.max(1, Math.round(len / 4.18));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const p = i === 0 ? panel : panel.clone(true);
      p.position.set(x, heightAt(x, z) - 0.05, z);
      p.rotation.y = ang;
      p.scale.setScalar((len / n) / 4.18);
      scene.add(shadowed(p));
    }
    return;
  }
  const wood = flat('#6a4a2e');
  const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
  for (const yy of [0.55, 0.9]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.1), wood);
    rail.position.set(midX, heightAt(midX, midZ) + yy, midZ);
    rail.rotation.y = ang;
    scene.add(rail);
  }
  const posts = Math.max(2, Math.round(len / 2));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 5), wood);
    post.position.set(px, heightAt(px, pz) + 0.55, pz);
    scene.add(post);
  }
}
