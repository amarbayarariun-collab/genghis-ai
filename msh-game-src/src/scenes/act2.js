// Act II — Боорчи · Бөртэ (friendship / marriage beat). One playable steppe camp.
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';

function person({ deel, hat, fur = '#e2d0b0', skin = '#c48a5e', tall = 1 }) {
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

function glowRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 24),
    new THREE.MeshBasicMaterial({ color: '#e8c37a', transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  return ring;
}

export function buildAct2World(scene) {
  const skyGeo = new THREE.SphereGeometry(300, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#4a5a7a') },
      horizon: { value: new THREE.Color('#f0a868') },
      bottom: { value: new THREE.Color('#b87850') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.6));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog('#d4926a', 35, 150);

  scene.add(new THREE.HemisphereLight('#ffd2a8', '#3a2a22', 0.9));
  const sun = new THREE.DirectionalLight('#ffb26b', 2.0);
  sun.position.set(70, 30, -40);
  scene.add(sun);

  const heightAt = (x, z) => {
    const d = Math.hypot(x, z);
    return Math.sin(x * 0.05) * Math.cos(z * 0.04) * 1.6 * Math.min(1, d / 20);
  };

  const geo = new THREE.PlaneGeometry(220, 220, 50, 50);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  const cols = new Float32Array(flat.attributes.position.count * 3);
  const cA = new THREE.Color('#8eae4a'), cB = new THREE.Color('#6f8f3a');
  for (let i = 0; i < flat.attributes.position.count; i++) {
    const c = cA.clone().lerp(cB, Math.random() * 0.5);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Simple ger + horses (Boorchi's camp vibe)
  const felt = new THREE.MeshLambertMaterial({ color: '#e9e1cf', flatShading: true });
  const ger = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2, 12), felt);
  wall.position.y = 1;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 12), felt);
  roof.position.y = 2.7;
  ger.add(wall, roof);
  ger.position.set(-6, 0, -4);
  scene.add(ger);

  const horseMat = new THREE.MeshLambertMaterial({ color: '#6b4428', flatShading: true });
  for (const [x, z] of [[8, 2], [11, 5], [5, 6]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.5), horseMat);
    h.position.set(x, heightAt(x, z) + 1.1, z);
    scene.add(h);
  }

  // Боорчи — earth-tone deel
  const boorchi = person({ deel: '#5a4a32', hat: '#3a2a1c', fur: '#cbb896' });
  boorchi.position.set(2, 0, -1);
  boorchi.rotation.y = Math.PI;
  scene.add(boorchi);
  const boorchiGlow = glowRing();
  boorchiGlow.position.set(2, 0.04, -1);
  scene.add(boorchiGlow);

  // Бөртэ — blue-grey deel (art-ref child blue → adult soft blue)
  const borte = person({ deel: '#4a5a72', hat: '#2a3548', fur: '#d8c6a4', tall: 0.95 });
  borte.position.set(-2.5, 0, 1.5);
  borte.rotation.y = 0.5;
  scene.add(borte);
  const borteGlow = glowRing();
  borteGlow.position.set(-2.5, 0.04, 1.5);
  scene.add(borteGlow);

  const temujin = createTemujin();
  temujin.position.set(0, 0, 8);
  scene.add(temujin);

  const colliders = [
    { x: -6, z: -4, r: 2.8 },
    { x: 2, z: -1, r: 0.8 },
    { x: -2.5, z: 1.5, r: 0.8 },
    { x: 8, z: 2, r: 1 },
    { x: 11, z: 5, r: 1 },
    { x: 5, z: 6, r: 1 },
  ];

  const fire = new THREE.PointLight('#ff8a3c', 1.8, 10);
  fire.position.set(0.5, 0.5, 0.5);
  scene.add(fire);

  function update(dt, t, nearSet, playerPos, playerMoving) {
    temujin.userData.setMoving(!!playerMoving);
    temujin.userData.update(dt, t);
    fire.intensity = 1.5 + Math.sin(t * 11) * 0.3;
    boorchiGlow.material.opacity = THREE.MathUtils.lerp(boorchiGlow.material.opacity, nearSet?.has(boorchi) ? 0.85 : 0, 0.15);
    borteGlow.material.opacity = THREE.MathUtils.lerp(borteGlow.material.opacity, nearSet?.has(borte) ? 0.85 : 0, 0.15);
    boorchiGlow.rotation.z += dt * 0.6;
    borteGlow.rotation.z += dt * 0.6;
  }

  return {
    temujin,
    colliders,
    heightAt,
    update,
    startPos: new THREE.Vector3(0, 0, 8),
    chapterLabel: 'II бүлэг · Боорчи · Бөртэ',
    npcs: [
      { obj: boorchi, name: 'Боорчитой', node: 'boorchi' },
      { obj: borte, name: 'Бөртэтэй', node: 'borte' },
    ],
  };
}
