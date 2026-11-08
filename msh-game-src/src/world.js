// Act I Onon camp. Environment is camp-world.glb. Characters and controls stay in the game.
import * as THREE from 'three';
import { createHoelun } from './characters/hoelun.js';
import { createTemujin } from './characters/temujin.js';
import { attachCamp } from './camp-gltf.js';
import { buildSteppeEnvironment } from './camp-environment.js';

const HOELUN_AT = { x: 0.8, z: 2.8 };
const CHIRHA_AT = { x: 7.4, z: 8.8 };
const FIRE_AT = { x: -4.2, z: 1.2 };

export function buildWorld(scene, opts = {}) {
  const q = opts.quality || {};
  const doDustBits = q.dustBits !== false;
  const shadowsOn = q.shadows !== false;
  const shadowMap = q.shadowMap || 1024;

  scene.add(new THREE.HemisphereLight('#d5e8ff', '#6d8a48', 0.82));
  const sun = new THREE.DirectionalLight('#fff4dd', 1.85);
  sun.position.set(28, 46, 16);
  sun.target.position.set(0, 0, -4);
  scene.add(sun.target);
  sun.castShadow = shadowsOn;
  sun.shadow.mapSize.set(shadowMap || 512, shadowMap || 512);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#c5ddf5', 0.32);
  rim.position.set(-24, 18, -12);
  scene.add(rim);

  const colliders = [];
  let heightAt = () => 0;
  let envUpdate = () => {};
  let campSource = 'steppe';
  let fishAt = { x: 2.2, z: 15 };
  const berryPoints = [];
  let steppe = null;
  try {
    steppe = buildSteppeEnvironment(scene, { quality: q, shadows: shadowsOn });
    heightAt = steppe.heightAt;
    envUpdate = steppe.update;
    colliders.push(...steppe.colliders);
    berryPoints.push(...steppe.berries);
    fishAt = steppe.fish;
  } catch (err) {
    console.warn('[camp] steppe failed, GLB fallback', err);
    campSource = 'fallback';
    const camp = attachCamp(scene, { shadows: shadowsOn, colliders });
    heightAt = (x, z) => camp.heightAt(x, z);
    camp.whenReady((info) => {
      settlePeople({ x: 2.2, z: 15 }, info.report?.berries || []);
    });
  }

  const N = doDustBits ? 160 : 0;
  const dGeo = new THREE.BufferGeometry();
  const arr = new Float32Array(Math.max(1, N) * 3);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 70;
    arr[i * 3 + 1] = Math.random() * 6;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  if (N > 0) {
    scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({ color: '#efe6d2', size: 0.06, transparent: true, opacity: 0.45 })));
  }

  const hoelun = createHoelun();
  hoelun.rotation.y = 0;
  hoelun.position.set(HOELUN_AT.x, 0, HOELUN_AT.z);
  scene.add(hoelun);
  colliders.push({ x: HOELUN_AT.x, z: HOELUN_AT.z, r: 0.85, kind: 'hoelun' });

  const chirha = buildChirha();
  chirha.rotation.y = 0.4;
  chirha.position.set(CHIRHA_AT.x, 0, CHIRHA_AT.z);
  scene.add(chirha);
  colliders.push({ x: CHIRHA_AT.x, z: CHIRHA_AT.z, r: 0.7, kind: 'chirha' });

  function glowRing(color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    return ring;
  }
  const hoelunGlow = glowRing('#e8c37a');
  hoelunGlow.position.set(HOELUN_AT.x, 0.05, HOELUN_AT.z);
  scene.add(hoelunGlow);
  const chirhaGlow = glowRing('#e8c37a');
  chirhaGlow.position.set(CHIRHA_AT.x, 0.05, CHIRHA_AT.z);
  scene.add(chirhaGlow);

  const temujin = createTemujin();
  temujin.position.set(0.4, 0, 28);
  scene.add(temujin);

  const fire = new THREE.PointLight('#ff8a3c', 1.6, 11);
  fire.position.set(FIRE_AT.x, 0.7, FIRE_AT.z);
  scene.add(fire);
  const ember = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.55, 6),
    new THREE.MeshBasicMaterial({ color: '#ff9a3c' })
  );
  ember.position.set(FIRE_AT.x, 0.28, FIRE_AT.z);
  scene.add(ember);

  const compass = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.1, 6),
    new THREE.MeshBasicMaterial({ color: '#e8c37a', transparent: true, opacity: 0.8 })
  );
  compass.rotation.x = Math.PI;
  compass.position.set(0, 6, -36);
  scene.add(compass);
  let compassBase = 6;

  const fishSpot = new THREE.Group();
  fishSpot.name = 'onon-bank';
  const bankRing = glowRing('#7eb0c4');
  bankRing.material.opacity = 0.9;
  const bankPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.15, 6),
    new THREE.MeshLambertMaterial({ color: '#6a4a30' })
  );
  bankPost.position.y = 0.55;
  const bankFlag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.28),
    new THREE.MeshLambertMaterial({ color: '#2f6f86', side: THREE.DoubleSide })
  );
  bankFlag.position.set(0.16, 1.05, 0);
  fishSpot.add(bankRing, bankPost, bankFlag);
  scene.add(fishSpot);

  function plant(obj, x, z, lift = 0) {
    obj.position.set(x, heightAt(x, z) + lift, z);
  }

  function settlePeople(fish, berries) {
    plant(hoelun, HOELUN_AT.x, HOELUN_AT.z);
    plant(chirha, CHIRHA_AT.x, CHIRHA_AT.z);
    plant(hoelunGlow, HOELUN_AT.x, HOELUN_AT.z, 0.05);
    plant(chirhaGlow, CHIRHA_AT.x, CHIRHA_AT.z, 0.05);
    plant(fire, FIRE_AT.x, FIRE_AT.z, 0.65);
    plant(ember, FIRE_AT.x, FIRE_AT.z, 0.25);
    plant(fishSpot, fish.x, fish.z, 0);
    if (berries) berryPoints.splice(0, berryPoints.length, ...berries);
    const gy = heightAt(0, -36);
    compassBase = gy + 4.5;
    compass.position.y = compassBase;
    const chimneys = [[0.6, -5.6], [-16.8, 8.6], [14.6, -8.8], [FIRE_AT.x, FIRE_AT.z]];
    chimneys.forEach((p, i) => {
      smokeSources[i][0] = p[0];
      smokeSources[i][1] = p[1];
      smokeSources[i][2] = heightAt(p[0], p[1]) + (i === 3 ? 0.45 : 3.1);
    });
    console.info('[camp] placed', JSON.stringify({
      source: campSource,
      spawn: [0.4, Math.round(heightAt(0.4, 28) * 100) / 100, 28],
      hoelun: [HOELUN_AT.x, HOELUN_AT.z],
      chirha: [CHIRHA_AT.x, CHIRHA_AT.z],
      fish: [fish.x, fish.z],
      berries: berryPoints,
    }));
  }

  const SMOKE_N = 32;
  const smokeGeo = new THREE.BufferGeometry();
  const smokeArr = new Float32Array(SMOKE_N * 3);
  const smokeAge = new Float32Array(SMOKE_N);
  const smokeSources = [
    [FIRE_AT.x, FIRE_AT.z, 0.4],
    [0, -5, 3.2],
    [-8, -2, 2.8],
    [7, -3, 2.9],
  ];
  for (let i = 0; i < SMOKE_N; i++) {
    const src = smokeSources[i % smokeSources.length];
    smokeArr[i * 3] = src[0];
    smokeArr[i * 3 + 1] = src[2];
    smokeArr[i * 3 + 2] = src[1];
    smokeAge[i] = Math.random();
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeArr, 3));
  if (steppe) settlePeople(fishAt, null);
  scene.add(new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({ color: '#d5d2cc', size: 0.55, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true })
  ));

  let tug = null;
  const tugBase = new THREE.Quaternion();
  const tugSwing = new THREE.Quaternion();
  const tugAxis = new THREE.Vector3(0, 0, 1);
  const slopeAhead = new THREE.Vector3();
  function update(dt, t, nearSet, playerPos, playerMoving) {
    temujin.userData.setMoving?.(!!playerMoving);
    temujin.userData.update?.(dt, t);
    hoelun.userData.update?.(t, playerPos, dt);
    if (playerPos) {
      const dx = playerPos.x - chirha.position.x;
      const dz = playerPos.z - chirha.position.z;
      if (dx * dx + dz * dz < 36) {
        const want = Math.atan2(dx, dz);
        let d = want - chirha.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        chirha.rotation.y += d * Math.min(1, dt * 3);
      }
    }

    if (playerPos) {
      const yaw = temujin.rotation.y;
      slopeAhead.set(Math.sin(yaw), 0, Math.cos(yaw));
      const y0 = heightAt(playerPos.x, playerPos.z);
      const y1 = heightAt(playerPos.x + slopeAhead.x * 0.7, playerPos.z + slopeAhead.z * 0.7);
      temujin.userData.setSlope?.(y1 - y0);
    }

    if (N > 0) {
      const p = dGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let x = p.getX(i) + dt * 4.5;
        if (x > 36) x = -36;
        p.setX(i, x);
      }
      p.needsUpdate = true;
    }

    const sp = smokeGeo.attributes.position;
    for (let i = 0; i < SMOKE_N; i++) {
      smokeAge[i] += dt * 0.28;
      if (smokeAge[i] > 1) smokeAge[i] = 0;
      const a = smokeAge[i];
      const src = smokeSources[i % smokeSources.length];
      sp.setX(i, src[0] + Math.sin(t * 1.4 + i) * 0.18 * a);
      sp.setY(i, src[2] + a * 2.4);
      sp.setZ(i, src[1] + Math.cos(t * 1.1 + i) * 0.18 * a);
    }
    sp.needsUpdate = true;

    if (!tug) {
      scene.traverse((o) => {
        if (!tug && o.name && o.name.startsWith('tug_placement')) tug = o;
      });
      if (tug) tugBase.copy(tug.quaternion);
    }
    if (tug) {
      tugSwing.setFromAxisAngle(tugAxis, Math.sin(t * 1.5) * 0.16);
      tug.quaternion.copy(tugBase).multiply(tugSwing);
    }
    envUpdate(t);

    fire.intensity = 1.35 + Math.sin(t * 11) * 0.28;
    ember.scale.y = 1 + Math.sin(t * 9) * 0.16;
    compass.position.y = compassBase + Math.sin(t * 2) * 0.15;

    hoelunGlow.material.opacity = THREE.MathUtils.lerp(hoelunGlow.material.opacity, nearSet?.has(hoelun) ? 0.85 : 0, 0.15);
    chirhaGlow.material.opacity = THREE.MathUtils.lerp(chirhaGlow.material.opacity, nearSet?.has(chirha) ? 0.85 : 0, 0.15);
    hoelunGlow.rotation.z += dt * 0.55;
    chirhaGlow.rotation.z += dt * 0.55;
  }

  return {
    hoelun,
    chirha,
    temujin,
    colliders,
    heightAt,
    update,
    startPos: new THREE.Vector3(0.4, 0, 28),
    chapterLabel: 'I бүлэг · Өнчин өдрүүд',
    aerialView: {
      eye: new THREE.Vector3(6, 16, 34),
      look: new THREE.Vector3(4, 3, -80),
      fov: 52,
    },
    fishSpot,
    berryPoints,
    campSource,
    envStats: steppe?.stats || null,
  };
}

function buildChirha() {
  const mat = (hex) => new THREE.MeshLambertMaterial({ color: hex });
  const chirha = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), mat('#5a4630'));
  body.position.y = 0.85;
  const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat('#b98a60'));
  cHead.position.y = 1.55;
  const feltPad = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.8), mat('#8c7a5e'));
  feltPad.position.y = 0.04;
  chirha.add(feltPad, body, cHead);
  chirha.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return chirha;
}
