// Act III — Мэргид хямрал · эвсэл · анхны Чингис (narrative, no combat).
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';

function person({ deel, hat, fur = '#cbb896', skin = '#c48a5e', tall = 1 }) {
  const flat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * tall, 0.28 * tall, 0.85 * tall, 8), flat(deel));
  body.position.y = 0.7 * tall;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 * tall, 1), flat(skin));
  head.position.y = 1.25 * tall;
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * tall, 0.16 * tall, 0.28 * tall, 8), flat(hat));
  h.position.y = 1.45 * tall;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2 * tall, 0.06 * tall, 5, 10), flat(fur));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.05 * tall;
  g.add(body, head, h, collar);
  return g;
}

function glowRing(color = '#e8c37a') {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  return ring;
}

export function buildAct3World(scene) {
  // Night-crisis palette — still low-poly steppe, cooler than Act II sunset
  const skyGeo = new THREE.SphereGeometry(300, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#12182a') },
      horizon: { value: new THREE.Color('#6a3a3a') },
      bottom: { value: new THREE.Color('#2a1c18') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.45)) : mix(horizon, bottom, pow(-h, 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog('#2a1c22', 25, 120);

  scene.add(new THREE.HemisphereLight('#8a6a70', '#101018', 0.55));
  const moon = new THREE.DirectionalLight('#a0b0d0', 0.7);
  moon.position.set(-30, 40, 20);
  scene.add(moon);
  const fireLite = new THREE.PointLight('#ff6a30', 2.2, 18);
  fireLite.position.set(1, 1.2, 1);
  scene.add(fireLite);

  const heightAt = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.05) * 1.2 * Math.min(1, Math.hypot(x, z) / 18);

  const geo = new THREE.PlaneGeometry(200, 200, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  const cols = new Float32Array(flat.attributes.position.count * 3);
  for (let i = 0; i < flat.attributes.position.count; i++) {
    const c = new THREE.Color().setHSL(0.18, 0.2, 0.18 + Math.random() * 0.08);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Ruined / empty ger — Börte taken
  const ash = new THREE.MeshLambertMaterial({ color: '#5a4a40', flatShading: true });
  const wreck = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 10, 1, true), ash);
  wall.position.y = 0.6;
  const lean = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.8), ash);
  lean.position.set(1.2, 1.4, 0);
  lean.rotation.z = 0.5;
  wreck.add(wall, lean);
  wreck.position.set(-5, 0, -3);
  scene.add(wreck);

  const ember = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 6), new THREE.MeshBasicMaterial({ color: '#ff7030' }));
  ember.position.set(1, 0.35, 1);
  scene.add(ember);

  // Crisis marker (messenger / empty doorway)
  const crisis = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), new THREE.MeshLambertMaterial({ color: '#3a2a20', flatShading: true }));
  post.position.y = 1.1;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), new THREE.MeshLambertMaterial({ color: '#6a1f24', side: THREE.DoubleSide, flatShading: true }));
  cloth.position.set(0.5, 1.4, 0);
  crisis.add(post, cloth);
  crisis.position.set(0.5, 0, -1);
  scene.add(crisis);
  const crisisGlow = glowRing('#ff8a5a');
  crisisGlow.position.set(0.5, 0.04, -1);
  scene.add(crisisGlow);

  // Жамуха — anda (blue-gray)
  const jamukha = person({ deel: '#3a4a5a', hat: '#1a2430', fur: '#b0a090' });
  jamukha.position.set(5, 0, 2);
  jamukha.rotation.y = -Math.PI * 0.6;
  scene.add(jamukha);
  const jamGlow = glowRing();
  jamGlow.position.set(5, 0.04, 2);
  scene.add(jamGlow);

  // Ван хан / Тоорил — warmer royal red-brown
  const tooril = person({ deel: '#6a3038', hat: '#c9a35a', fur: '#e2d0b0', tall: 1.05 });
  tooril.position.set(-3, 0, 5);
  tooril.rotation.y = Math.PI * 0.3;
  scene.add(tooril);
  const tooGlow = glowRing();
  tooGlow.position.set(-3, 0.04, 5);
  scene.add(tooGlow);

  // Хуралдай mound — Chinggis elevation
  const mound = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 0.9, 7), new THREE.MeshLambertMaterial({ color: '#6e6860', flatShading: true }));
  rock.position.y = 0.45;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshLambertMaterial({ color: '#7a1f24', side: THREE.DoubleSide }));
  banner.position.set(0, 2.0, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), new THREE.MeshLambertMaterial({ color: '#3a2a1c' }));
  pole.position.y = 1.5;
  mound.add(rock, pole, banner);
  mound.position.set(0, 0, -12);
  scene.add(mound);
  const moundGlow = glowRing('#e8c37a');
  moundGlow.position.set(0, 0.04, -12);
  scene.add(moundGlow);

  const temujin = createTemujin();
  temujin.position.set(0, 0, 8);
  scene.add(temujin);

  const colliders = [
    { x: -5, z: -3, r: 2.5 },
    { x: 0.5, z: -1, r: 0.9 },
    { x: 5, z: 2, r: 0.8 },
    { x: -3, z: 5, r: 0.8 },
    { x: 0, z: -12, r: 2.0 },
  ];

  const npcs = [
    { obj: crisis, name: 'хоосон гэр / зарлаачтай', node: 'mergen_start', glow: crisisGlow },
    { obj: jamukha, name: 'Жамухатай', node: 'jamukha', glow: jamGlow },
    { obj: tooril, name: 'Ван хан Тоорилынтай', node: 'tooril', glow: tooGlow },
    { obj: mound, name: 'хуралдай чулуутай', node: 'chinggis', glow: moundGlow },
  ];

  function update(dt, t, nearSet, playerPos, playerMoving) {
    temujin.userData.setMoving(!!playerMoving);
    temujin.userData.update(dt, t);
    fireLite.intensity = 1.8 + Math.sin(t * 12) * 0.4;
    ember.scale.y = 1 + Math.sin(t * 10) * 0.2;
    banner.rotation.y = Math.sin(t * 1.5) * 0.15;
    for (const n of npcs) {
      n.glow.material.opacity = THREE.MathUtils.lerp(n.glow.material.opacity, nearSet?.has(n.obj) ? 0.85 : 0, 0.15);
      n.glow.rotation.z += dt * 0.55;
    }
  }

  return {
    temujin,
    colliders,
    heightAt,
    update,
    startPos: new THREE.Vector3(0, 0, 8),
    chapterLabel: 'III бүлэг · Мэргид · Чингис',
    npcs: npcs.map(({ obj, name, node }) => ({ obj, name, node })),
  };
}
