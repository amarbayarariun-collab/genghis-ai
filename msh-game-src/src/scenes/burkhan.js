// Act I scene 2 — Бурхан халдун ridge (Taiichiud pursuit / refuge).
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';

export function buildBurkhanWorld(scene) {
  // Cooler dawn / mist mountain palette (still low-poly steppe, not ink-wash)
  const skyGeo = new THREE.SphereGeometry(300, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#2a3550') },
      horizon: { value: new THREE.Color('#c47a55') },
      bottom: { value: new THREE.Color('#5a4a3a') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, bottom, pow(-h, 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog('#8a6a58', 18, 110);

  scene.add(new THREE.HemisphereLight('#ffc9a0', '#2a2430', 0.7));
  const sun = new THREE.DirectionalLight('#ff9a60', 1.6);
  sun.position.set(-40, 30, 20);
  scene.add(sun);
  scene.add(new THREE.DirectionalLight('#6a7aaa', 0.45));

  const heightAt = (x, z) => {
    const ridge = Math.exp(-((x) * (x)) / 180) * 8;
    return Math.sin(x * 0.08) * Math.cos(z * 0.06) * 1.4 + ridge + Math.max(0, -z - 5) * 0.35;
  };

  const geo = new THREE.PlaneGeometry(160, 160, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  const vcol = new Float32Array(flat.attributes.position.count * 3);
  for (let i = 0; i < flat.attributes.position.count; i++) {
    const y = flat.attributes.position.getY(i);
    const c = new THREE.Color().setHSL(0.22, 0.25, 0.28 + Math.min(0.25, y * 0.02));
    vcol[i * 3] = c.r; vcol[i * 3 + 1] = c.g; vcol[i * 3 + 2] = c.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
  scene.add(new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Peak mass
  const rockMat = new THREE.MeshLambertMaterial({ color: '#6e6a68', flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: '#e8e4dc', flatShading: true });
  for (let i = 0; i < 5; i++) {
    const h = 14 + i * 3;
    const m = new THREE.Mesh(new THREE.ConeGeometry(6 + i, h, 5), rockMat);
    m.position.set(-8 + i * 5, heightAt(-8 + i * 5, -40) + h * 0.35, -40 - i * 2);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, h * 0.25, 5), snow);
    cap.position.y = h * 0.38;
    m.add(cap);
    scene.add(m);
  }

  // Sacred thicket (interactable hide spot)
  const thicket = new THREE.Group();
  const bushMat = new THREE.MeshLambertMaterial({ color: '#3d5a32', flatShading: true });
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.5, 0), bushMat);
    b.position.set((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 3);
    b.scale.y = 1.2 + Math.random();
    thicket.add(b);
  }
  thicket.position.set(3, heightAt(3, -8), -8);
  scene.add(thicket);

  const shrine = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.4, 6), rockMat);
  stone.position.y = 0.7;
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.2), new THREE.MeshBasicMaterial({ color: '#c9a35a', side: THREE.DoubleSide }));
  ribbon.position.set(0.35, 1.4, 0);
  shrine.add(stone, ribbon);
  shrine.position.set(-2, heightAt(-2, -12), -12);
  scene.add(shrine);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.35, 24),
    new THREE.MeshBasicMaterial({ color: '#e8c37a', transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.copy(thicket.position);
  glow.position.y += 0.05;
  scene.add(glow);

  // Distant campfire sparks = pursuers (atmosphere only)
  const chase = new THREE.PointLight('#ff6a30', 0.8, 40);
  chase.position.set(25, 4, 30);
  scene.add(chase);

  const mistGeo = new THREE.BufferGeometry();
  const N = 400;
  const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 60;
    arr[i * 3 + 1] = 2 + Math.random() * 10;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  scene.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: '#d8cfc4', size: 0.35, transparent: true, opacity: 0.35, depthWrite: false })));

  const temujin = createTemujin();
  temujin.position.set(0, heightAt(0, 8), 8);
  scene.add(temujin);

  const colliders = [
    { x: thicket.position.x, z: thicket.position.z, r: 2.2 },
    { x: shrine.position.x, z: shrine.position.z, r: 1.0 },
  ];

  // Interactable: thicket = main story beat
  const interact = { obj: thicket, name: 'Бурхан халдуны шугуйтай', node: 'burkhan_start', glow };

  function update(dt, t, nearSet, playerPos, playerMoving) {
    temujin.userData.setMoving(!!playerMoving);
    temujin.userData.update(dt, t);
    chase.intensity = 0.5 + Math.sin(t * 2) * 0.25;
    glow.material.opacity = THREE.MathUtils.lerp(glow.material.opacity, nearSet?.has(thicket) ? 0.85 : 0, 0.15);
    glow.rotation.z += dt * 0.5;
    ribbon.rotation.z = Math.sin(t * 2) * 0.2;
  }

  return {
    temujin,
    colliders,
    heightAt,
    update,
    interactables: [interact],
    startPos: new THREE.Vector3(0, 0, 8),
    chapterLabel: 'I бүлэг · Бурхан халдун',
  };
}
