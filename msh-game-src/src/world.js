// Act I Onon camp. Environment is camp-world.glb. Characters and controls stay in the game.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHoelun } from './characters/hoelun.js';
import { createTemujin } from './characters/temujin.js';
import { attachCamp } from './camp-gltf.js';
import { buildSteppeEnvironment, riverX as steppeRiverX } from './camp-environment.js';
import { createHorse } from './characters/horse.js';
import { attachHorseModel } from './characters/horse-model.js';

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
  temujin.position.set(0.4, 0, 16);
  scene.add(temujin);
  // Temujin's own saddled horse, tethered near the path south of the camp
  const mount = createHorse({ coat: '#8c4a24', mane: '#1a1410', saddle: true });
  attachHorseModel(mount, { lod: 'hi' });
  const MOUNT_AT = { x: 3.4, z: 11.5 };
  mount.position.set(MOUNT_AT.x, heightAt(MOUNT_AT.x, MOUNT_AT.z), MOUNT_AT.z);
  mount.rotation.y = -1.2;
  scene.add(mount);

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
    if (!mount.userData.ridden) plant(mount, mount.position.x, mount.position.z, 0);
    if (berries) berryPoints.splice(0, berryPoints.length, ...berries);
    const gy = heightAt(0, -36);
    compassBase = gy + 4.5;
    compass.position.y = compassBase;
    const fromGers = steppe?.chimneys?.length === 3
      ? steppe.chimneys.map((v) => [v.x, v.z, v.y])
      : [[0.6, -5.6, heightAt(0.6, -5.6) + 3.1], [-16.8, 8.6, heightAt(-16.8, 8.6) + 3.1], [14.6, -8.8, heightAt(14.6, -8.8) + 3.1]];
    const chimneys = [...fromGers, [FIRE_AT.x, FIRE_AT.z, heightAt(FIRE_AT.x, FIRE_AT.z) + 0.45]];
    chimneys.forEach((p, i) => {
      smokeSources[i][0] = p[0];
      smokeSources[i][1] = p[1];
      smokeSources[i][2] = p[2];
    });
    console.info('[camp] placed', JSON.stringify({
      source: campSource,
      spawn: [0.4, Math.round(heightAt(0.4, 16) * 100) / 100, 16],
      hoelun: [HOELUN_AT.x, HOELUN_AT.z],
      chirha: [CHIRHA_AT.x, CHIRHA_AT.z],
      fish: [fish.x, fish.z],
      berries: berryPoints,
    }));
  }

  const SMOKE_N = 48;
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
  // soft round puffs (procedural radial gradient) instead of square points
  const puffCanvas = document.createElement('canvas');
  puffCanvas.width = puffCanvas.height = 64;
  {
    const g = puffCanvas.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const puffTex = new THREE.CanvasTexture(puffCanvas);
  const smokeSprites = [];
  for (let i = 0; i < SMOKE_N; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#a7a7aa', transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(spr);
    smokeSprites.push(spr);
  }

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
      // rise, then lean downwind (+x) like the reference drawing
      const x = src[0] + a * a * 4.5 + Math.sin(t * 1.4 + i) * 0.18 * a;
      const y = src[2] + a * 3.2 - a * a * 0.6;
      const z = src[1] - a * 0.8 + Math.cos(t * 1.1 + i) * 0.18 * a;
      sp.setXYZ(i, x, y, z);
      const spr = smokeSprites[i];
      spr.position.set(x, y, z);
      const sc = (i % smokeSources.length === 0 ? 0.35 : 0.45) + a * 2.2;
      spr.scale.set(sc, sc * 0.85, 1);
      spr.material.opacity = Math.min(1, a * 6) * (1 - a) * 0.7;
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
    if (!mount.userData.ridden) mount.userData.update(dt, t, 0, { graze: true });

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
    startPos: new THREE.Vector3(0.4, 0, 16),
    chapterLabel: 'I бүлэг · Өнчин өдрүүд',
    aerialView: {
      eye: new THREE.Vector3(6, 16, 34),
      look: new THREE.Vector3(4, 3, -80),
      fov: 52,
    },
    fishSpot,
    mount,
    riverX: steppe ? steppeRiverX : null,
    berryPoints,
    campSource,
    envStats: steppe?.stats || null,
  };
}

const CHIRHA_GLB_URL = './models/chirha.glb';

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
  // Swap the capsule for the sculpted elder (patched deel, fur trim, staff) once it loads.
  new GLTFLoader().load(CHIRHA_GLB_URL, (gltf) => {
    try {
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      m.scale.setScalar(1.62 / (size.y || 1));
      m.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(m);
      m.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mm) => { if ('metalness' in mm) { mm.metalness = 0; mm.roughness = 0.9; } });
      });
      chirha.remove(body, cHead, feltPad);
      chirha.add(m);
    } catch (err) {
      console.warn('[chirha] model setup failed, capsule kept', err);
    }
  }, undefined, (err) => console.warn('[chirha] model failed, capsule kept', err));
  return chirha;
}
