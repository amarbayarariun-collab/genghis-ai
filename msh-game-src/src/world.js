// Act I Onon camp. Environment is camp-world.glb. Characters and controls stay in the game.
import * as THREE from 'three';
import { createHoelun } from './characters/hoelun.js';
import { createTemujin } from './characters/temujin.js';
import { attachCamp } from './camp-gltf.js';

const HOELUN_AT = { x: 0.8, z: 2.8 };
const CHIRHA_AT = { x: -7.6, z: 4.2 };
const FIRE_AT = { x: -4.6, z: -2.6 };

function smokePuff() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,248,240,0.9)');
  grd.addColorStop(0.45, 'rgba(236,226,210,0.28)');
  grd.addColorStop(1, 'rgba(236,226,210,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function buildWorld(scene, opts = {}) {
  const q = opts.quality || {};
  const cloudN = q.clouds ?? 8;
  const doDustBits = q.dustBits !== false;
  const shadowsOn = q.shadows === true;
  const shadowMap = shadowsOn ? (q.shadowMap || 512) : 0;

  const skyGeo = new THREE.SphereGeometry(320, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#c46a48') },
      mid: { value: new THREE.Color('#e7a15a') },
      horizon: { value: new THREE.Color('#ffe0b0') },
      bottom: { value: new THREE.Color('#b88858') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, mid, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c;
        if (h > 0.12) c = mix(mid, top, pow((h - 0.12) / 0.88, 0.55));
        else if (h > 0.0) c = mix(horizon, mid, h / 0.12);
        else c = mix(horizon, bottom, pow(-h, 0.45));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.background = new THREE.Color('#e7c08a');
  scene.fog = new THREE.FogExp2('#f0ddc0', 0.0016 * (q.fogDensityScale ?? 1));

  scene.add(new THREE.HemisphereLight('#ffe6c4', '#6a5430', 0.78));
  const sun = new THREE.DirectionalLight('#ffc27a', 2.45);
  sun.position.set(18, 26, 22);
  sun.target.position.set(0, 0, -3);
  scene.add(sun.target);
  sun.castShadow = shadowsOn;
  sun.shadow.mapSize.set(shadowMap || 512, shadowMap || 512);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#d7e4ee', 0.28);
  rim.position.set(-28, 14, -10);
  scene.add(rim);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: '#fff6dc', fog: false, depthWrite: false })
  );
  sunDisc.position.set(26, 18, -150);
  sunDisc.lookAt(0, 4, 0);
  scene.add(sunDisc);

  const cloudMat = new THREE.MeshLambertMaterial({ color: '#f4efe6', flatShading: true });
  const clouds = [];
  for (let i = 0; i < cloudN; i++) {
    const c = new THREE.Group();
    const puffs = cloudN > 6 ? 4 : 3;
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2 + Math.random() * 2.2, 0), cloudMat);
      puff.position.set(j * 3.2 - 5, Math.random() * 1.2, Math.random() * 1.6);
      puff.scale.set(1 + Math.random() * 0.6, 0.45, 0.8);
      c.add(puff);
    }
    c.position.set((Math.random() - 0.5) * 160, 36 + Math.random() * 14, -40 - Math.random() * 70);
    scene.add(c);
    clouds.push(c);
  }

  const colliders = [];
  const camp = attachCamp(scene, { shadows: shadowsOn, colliders });
  const heightAt = (x, z) => camp.heightAt(x, z);

  const N = doDustBits ? 160 : 72;
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

  function plant(obj, x, z, lift = 0) {
    obj.position.set(x, heightAt(x, z) + lift, z);
  }

  camp.whenReady((info) => {
    plant(hoelun, HOELUN_AT.x, HOELUN_AT.z);
    plant(chirha, CHIRHA_AT.x, CHIRHA_AT.z);
    plant(hoelunGlow, HOELUN_AT.x, HOELUN_AT.z, 0.05);
    plant(chirhaGlow, CHIRHA_AT.x, CHIRHA_AT.z, 0.05);
    plant(fire, FIRE_AT.x, FIRE_AT.z, 0.65);
    plant(ember, FIRE_AT.x, FIRE_AT.z, 0.25);
    const gy = heightAt(0, -36);
    compassBase = gy + 4.5;
    compass.position.y = compassBase;
    const spawnY = heightAt(0.4, 28);
    console.info('[camp] spawn', JSON.stringify({ x: 0.4, y: Math.round(spawnY * 100) / 100, z: 28, gers: info.report.gers }));
  });

  const SMOKE_N = 16;
  const smokeGeo = new THREE.BufferGeometry();
  const smokeArr = new Float32Array(SMOKE_N * 3);
  const smokeAge = new Float32Array(SMOKE_N);
  const smokeAt = [FIRE_AT.x, FIRE_AT.z, 0.45];
  for (let i = 0; i < SMOKE_N; i++) {
    smokeArr[i * 3] = smokeAt[0];
    smokeArr[i * 3 + 1] = smokeAt[2];
    smokeArr[i * 3 + 2] = smokeAt[1];
    smokeAge[i] = Math.random();
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeArr, 3));
  smokeGeo.setAttribute('aAge', new THREE.BufferAttribute(smokeAge, 1));
  const smokeTex = smokePuff();
  const smoke = new THREE.Points(smokeGeo, new THREE.ShaderMaterial({
    uniforms: {
      map: { value: smokeTex },
      uColor: { value: new THREE.Color('#e7dccb') },
    },
    vertexShader: `
      attribute float aAge;
      varying float vAge;
      void main() {
        vAge = aAge;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(210.0 * (0.28 + aAge * 0.9) / max(0.2, -mv.z), 2.0, 42.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 uColor;
      varying float vAge;
      void main() {
        float puff = texture2D(map, gl_PointCoord).a;
        float fade = sin(vAge * 3.14159);
        if (puff * fade < 0.02) discard;
        gl_FragColor = vec4(uColor, puff * fade * 0.42);
      }`,
    transparent: true,
    depthWrite: false,
    fog: false,
  }));
  smoke.frustumCulled = false;
  smoke.renderOrder = 2;
  scene.add(smoke);

  let tug = null;
  let tugBanner = null;
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
    const ages = smokeGeo.attributes.aAge;
    for (let i = 0; i < SMOKE_N; i++) {
      smokeAge[i] += dt * 0.22;
      if (smokeAge[i] > 1) smokeAge[i] = 0;
      const a = smokeAge[i];
      ages.setX(i, a);
      sp.setX(i, smokeAt[0] + Math.sin(t * 0.7 + i * 1.7) * 0.42 * a);
      sp.setY(i, smokeAt[2] + 0.2 + a * 1.55);
      sp.setZ(i, smokeAt[1] + Math.cos(t * 0.6 + i) * 0.32 * a);
    }
    sp.needsUpdate = true;
    ages.needsUpdate = true;

    if (!tug) {
      scene.traverse((o) => {
        if (!tug && o.name && o.name.startsWith('tug_placement')) tug = o;
      });
      if (tug) {
        tugBase.copy(tug.quaternion);
        tug.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          if (mats.some((m) => /horsehair/i.test(m?.name || ''))) o.visible = false;
        });
        tugBanner = new THREE.Mesh(
          new THREE.PlaneGeometry(0.58, 0.82),
          new THREE.MeshLambertMaterial({ color: '#8d1c24', side: THREE.DoubleSide })
        );
        tugBanner.name = 'tug-banner';
        tugBanner.position.set(0.3, 2.48, 0);
        tug.add(tugBanner);
      }
    }
    if (tug) {
      tugSwing.setFromAxisAngle(tugAxis, Math.sin(t * 1.1) * 0.05);
      tug.quaternion.copy(tugBase).multiply(tugSwing);
      if (tugBanner) tugBanner.rotation.y = Math.sin(t * 1.4) * 0.22;
    }
    camp.wind?.(t);

    fire.intensity = 1.35 + Math.sin(t * 11) * 0.28;
    ember.scale.y = 1 + Math.sin(t * 9) * 0.16;
    clouds.forEach((c, i) => {
      c.position.x += dt * (0.28 + (i % 3) * 0.06);
      if (c.position.x > 90) c.position.x = -90;
    });
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
      eye: new THREE.Vector3(16, 22, 32),
      look: new THREE.Vector3(-1, 1.2, -4),
      fov: 48,
    },
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
