// Act I Onon camp — PRIMARY look: media/refs/step1-reference-video.mp4 (+ art-ref 18 characters).
import * as THREE from 'three';
import { createHoelun } from './characters/hoelun.js';
import { createTemujin } from './characters/temujin.js';
import { steppeShade, paintedDepth } from './systems/harvest/steppe-shade.js';

let _useShade = true;
const flatMat = (color, opts = {}) => {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
  return _useShade ? steppeShade(m) : m;
};

export function buildWorld(scene, opts = {}) {
  const q = opts.quality || {};
  _useShade = q.steppeShade !== false;
  const grassN = q.grass ?? 2200;
  const cloudN = q.clouds ?? 11;
  const hillN = q.hills ?? 10;
  const herdN = q.herd ?? 16;
  const doSmoke = q.smoke !== false;
  const doDustBits = q.dustBits !== false;
  const shadowsOn = q.shadows !== false;
  const shadowMap = q.shadowMap || 1024;

  // ---- Sky: peach-cream (sampled from step1-f03: sky ~#e2c191) ----
  const skyGeo = new THREE.SphereGeometry(320, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#d4b48a') },
      mid: { value: new THREE.Color('#e8c89a') },
      horizon: { value: new THREE.Color('#ffe8c0') },
      bottom: { value: new THREE.Color('#c4a070') },
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
  // Warm haze: gers readable, far hills dissolve to peach (f03)
  scene.background = new THREE.Color('#e8c9a0');
  const fogD = 0.0095 * (q.fogDensityScale ?? 1);
  scene.fog = new THREE.FogExp2('#e8c9a0', fogD);

  // Backlit golden hour: sun low on horizon (video)
  scene.add(new THREE.HemisphereLight('#ffe8c0', '#8a7048', 0.9));
  const sun = new THREE.DirectionalLight('#ffe2a8', 2.7);
  sun.position.set(-18, 10, -130);
  sun.castShadow = shadowsOn;
  sun.shadow.mapSize.set(shadowMap || 512, shadowMap || 512);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffe8c0', 0.35);
  rim.position.set(-40, 10, 30);
  scene.add(rim);
  const bounce = new THREE.DirectionalLight('#ffd090', 0.4);
  bounce.position.set(20, 6, 50);
  scene.add(bounce);

  // ---- Soft pillowy hills (video: low-frequency undulation, olive/gold) ----
  // River on the LEFT of camp like the reference frames
  // Winds bottom-left → horizon (visible in f03 aerial)
  const riverX = (z) => -24 + Math.sin((z + 200) * 0.018) * 16 + Math.sin((z + 40) * 0.045) * 7 + Math.sin(z * 0.09) * 3 + z * 0.015;
  const heightAt = (x, z) => {
    // Soft rolling gold-green grass hills (stronger mid-field undulation than desert flat)
    let h =
      Math.sin(x * 0.014) * Math.cos(z * 0.012) * 7.2 +
      Math.sin(x * 0.038 + z * 0.026) * 3.2 +
      Math.cos(x * 0.01 - z * 0.016) * 3.8 +
      Math.sin(x * 0.065 - z * 0.048) * 1.4;
    const d = Math.hypot(x * 0.6, z);
    h *= Math.min(1.2, 0.5 + d / 48);
    // gentle river valley
    const k = 1 - THREE.MathUtils.smoothstep(Math.abs(x - riverX(z)), 2.0, 9);
    h = h * (1 - k * 0.85) - 0.65 * k;
    // soft far rise (no jagged peaks)
    if (z < -70) h += Math.min(5, (-70 - z) * 0.08);
    // Soft camp clearing — keep some roll so mid-field isn't desert-flat
    const camp = Math.exp(-(x * x + (z + 4) * (z + 4)) / 70);
    h = THREE.MathUtils.lerp(h, 0.35 + Math.sin(x * 0.08) * 0.25, camp * 0.45);
    return h;
  };

  const segs = grassN <= 500 ? 40 : grassN <= 1400 ? 80 : 110;
  const geo = new THREE.PlaneGeometry(420, 420, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const vcol = new Float32Array(pos.count * 3);
  // f03: ochre-olive (~#b9a65a → #d6b86a), NOT saturated green
  const cGrass = new THREE.Color('#b0a852'); // ochre-olive body
  const cGold = new THREE.Color('#d0b460');
  const cDark = new THREE.Color('#7a7840');
  const cOlive = new THREE.Color('#9a9850'); // olive in valleys
  const cDirt = new THREE.Color('#c4a868');
  const cPeach = new THREE.Color('#e8c9a0');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const nearRiver = Math.abs(x - riverX(z)) < 9;
    const crest = Math.max(0, y) / 5;
    const dist = Math.hypot(x * 0.5, z);
    let c = cGrass.clone().lerp(cGold, 0.3 + crest * 0.45);
    c.lerp(cOlive, 0.18 * (1 - crest));
    if (y < 0.15 || nearRiver) c.lerp(cDark, 0.22);
    c.lerp(cPeach, THREE.MathUtils.smoothstep(dist, 55, 130) * 0.55);
    if (Math.abs(x) < 1.4 && z > -4 && z < 16) c.lerp(cDirt, 0.35);
    if (Math.hypot(x + 2, z + 6) < 7) c.lerp(cDirt, 0.12);
    vcol[i * 3] = c.r; vcol[i * 3 + 1] = c.g; vcol[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
  const flatGeo = geo.toNonIndexed();
  flatGeo.computeVertexNormals();
  const fc = flatGeo.attributes.color;
  for (let i = 0; i < fc.count; i += 3) {
    fc.setXYZ(i + 1, fc.getX(i), fc.getY(i), fc.getZ(i));
    fc.setXYZ(i + 2, fc.getX(i), fc.getY(i), fc.getZ(i));
  }
  let groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (_useShade) {
    groundMat = steppeShade(groundMat, {
      ground: true, amount: 0.28, warm: 0.16, shadow: '#6a5840', light: '#ffe2a8',
    });
  }
  const ground = new THREE.Mesh(flatGeo, groundMat);
  ground.receiveShadow = shadowsOn;
  scene.add(ground);

  // ---- Soft far hills — peach dissolve ----
  let hillBase = new THREE.MeshLambertMaterial({ color: '#c4b06a', flatShading: true });
  if (_useShade) hillBase = steppeShade(hillBase, { amount: 0.25, warm: 0.14 });
  const hillMat = paintedDepth(hillBase, { saturation: 0.55, contrast: 0.8, fog: 0.4, fogColor: '#e8c9a0' });
  for (let i = 0; i < hillN; i++) {
    const r = 18 + Math.random() * 22;
    const h = 8 + Math.random() * 12;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, hillN <= 4 ? 6 : 10, hillN <= 4 ? 5 : 8), hillMat);
    m.scale.y = 0.28 + Math.random() * 0.12;
    m.position.set(-120 + i * 28, heightAt(-120 + i * 28, -130) + h * 0.15, -130 - Math.random() * 40);
    scene.add(m);
  }

  // Sun disc — large soft orb on horizon (f03), facing camp
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: '#fff8e0', fog: false, depthWrite: false })
  );
  sunDisc.position.set(2, 6, -188);
  sunDisc.lookAt(2, 2, 50);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(42, 32),
    new THREE.MeshBasicMaterial({ color: '#ffe4a8', transparent: true, opacity: 0.4, fog: false, depthWrite: false })
  );
  sunGlow.position.copy(sunDisc.position);
  sunGlow.position.z += 1;
  sunGlow.lookAt(2, 2, 50);
  scene.add(sunGlow);
  const sunBloom = new THREE.Mesh(
    new THREE.CircleGeometry(78, 32),
    new THREE.MeshBasicMaterial({ color: '#ffd090', transparent: true, opacity: 0.16, fog: false, depthWrite: false })
  );
  sunBloom.position.copy(sunDisc.position);
  sunBloom.position.z += 2;
  sunBloom.lookAt(2, 2, 50);
  scene.add(sunBloom);

  // ---- River: molten gold ribbon (video) on camp-left ----
  const riverPts = [];
  for (let i = 0; i <= 50; i++) {
    const z = -190 + i * 7.2;
    riverPts.push(new THREE.Vector3(riverX(z), -0.15, z));
  }
  const curve = new THREE.CatmullRomCurve3(riverPts);
  const rVerts = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPoint(i / steps);
    const tng = curve.getTangent(i / steps);
    const w = 2.4 + (i / steps) * 3.2; // readable gold ribbon from aerial
    const nx = -tng.z, nz = tng.x;
    rVerts.push(p.x + nx * w, -0.2, p.z + nz * w, p.x - nx * w, -0.2, p.z - nz * w);
  }
  const rIdx = [];
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    rIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
  rGeo.setIndex(rIdx);
  rGeo.computeVertexNormals();
  // Gold/sand ribbon (Lambert so warm light grades it — Basic+fog:false reads as white)
  const riverMat = new THREE.MeshLambertMaterial({ color: '#b89858', side: THREE.DoubleSide, flatShading: true });
  scene.add(new THREE.Mesh(rGeo, riverMat));
  const foamMat = new THREE.MeshLambertMaterial({
    color: '#d4bc82', transparent: true, opacity: 0.65, side: THREE.DoubleSide, flatShading: true,
  });
  for (const side of [-1, 1]) {
    const fVerts = [];
    for (let i = 0; i <= steps; i++) {
      const p = curve.getPoint(i / steps);
      const tng = curve.getTangent(i / steps);
      const w = 2.2 + (i / steps) * 2.8;
      const nx = -tng.z, nz = tng.x;
      const ox = p.x + nx * w * side;
      const oz = p.z + nz * w * side;
      fVerts.push(ox, -0.12, oz, ox + nx * 0.35 * side, -0.12, oz + nz * 0.35 * side);
    }
    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.Float32BufferAttribute(fVerts, 3));
    const fIdx = [];
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      fIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    fGeo.setIndex(fIdx);
    scene.add(new THREE.Mesh(fGeo, foamMat));
  }

  // ---- Chunky sunset clouds ----
  const cloudMat = new THREE.MeshLambertMaterial({
    color: '#e8b888', flatShading: true, transparent: true, opacity: 0.7, depthWrite: false,
  });
  const cloudShade = new THREE.MeshLambertMaterial({
    color: '#d49a78', flatShading: true, transparent: true, opacity: 0.65, depthWrite: false,
  });
  const clouds = [];
  for (let i = 0; i < cloudN; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < (cloudN > 6 ? 5 : 3); j++) {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(3.5 + Math.random() * 2.5, 0),
        j % 2 ? cloudMat : cloudShade
      );
      puff.position.set(j * 3.5 - 6, Math.random() * 1.5, Math.random() * 2);
      puff.scale.set(1 + Math.random(), 0.55 + Math.random() * 0.3, 0.8);
      c.add(puff);
    }
    c.position.set((Math.random() - 0.5) * 200, 32 + Math.random() * 16, -70 - Math.random() * 80);
    scene.add(c);
    clouds.push(c);
  }

  // ---- Colliders ----
  const colliders = [];

  // Ger builder — white felt, wood trim, red patterned door
  function ger(x, z, s = 1, doorDetail = true) {
    const g = new THREE.Group();
    const felt = flatMat('#efe6d4');
    const feltShade = flatMat('#d8cfc0');
    const wood = flatMat('#7a5a38');
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.05, 2.35, 16), felt);
    wall.position.y = 1.15;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.28, 16), wood);
    band.position.y = 0.35;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.35, 1.7, 16), feltShade);
    roof.position.y = 3.15;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.35, 10), wood);
    crown.position.y = 4.1;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.65, 0.18), flatMat('#9a2a28'));
    door.position.set(0, 0.82, 3.0);
    g.add(wall, band, roof, crown, door);
    if (doorDetail) {
      const orn = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.05), flatMat('#f0e8d8'));
      orn.position.set(0, 1.35, 3.1);
      g.add(orn);
      const orn2 = orn.clone();
      orn2.position.y = 0.55;
      g.add(orn2);
    }
    // smoke stack tip
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 6), wood);
    tip.position.y = 4.4;
    g.add(tip);
    g.position.set(x, heightAt(x, z), z);
    g.scale.setScalar(s);
    g.rotation.y = Math.PI + (Math.random() - 0.5) * 0.15;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = shadowsOn; o.receiveShadow = shadowsOn; } });
    scene.add(g);
    colliders.push({ x, z, r: 3.15 * s });
    return g;
  }
  // Exactly 3 gers — mid-LEFT cluster (f03 framing)
  ger(-3.5, -8, 1.0);
  ger(-8.5, -5.5, 0.88);
  ger(0.5, -5.8, 0.9);

  // Wooden fence around camp
  const fenceMat = flatMat('#6a4a2e');
  function fenceSegment(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const midX = (x1 + x2) / 2, midZ = (z1 + z2) / 2;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.1), fenceMat);
    rail.position.set(midX, heightAt(midX, midZ) + 0.55, midZ);
    rail.rotation.y = Math.atan2(dx, dz);
    scene.add(rail);
    const rail2 = rail.clone();
    rail2.position.y += 0.35;
    scene.add(rail2);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const px = x1 + dx * t, pz = z1 + dz * t;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 5), fenceMat);
      post.position.set(px, heightAt(px, pz) + 0.55, pz);
      scene.add(post);
    }
  }
  fenceSegment(-12, 1, -4, 3);
  fenceSegment(-4, 3, 3, 4);
  fenceSegment(3, 4, 10, 2);
  fenceSegment(10, 2, 12, -2);

  // Red sulde / clan banner
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 5.5, 6), flatMat('#3a2818'));
  pole.position.set(4.2, heightAt(4.2, -8.5) + 2.7, -8.5);
  scene.add(pole);
  const bannerGeo = new THREE.PlaneGeometry(1.5, 2.0, 8, 1);
  const banner = new THREE.Mesh(bannerGeo, flatMat('#8a1a22', { side: THREE.DoubleSide }));
  banner.position.set(5.0, heightAt(4.2, -8.5) + 4.2, -8.5);
  scene.add(banner);
  // white trident mark
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), new THREE.MeshBasicMaterial({ color: '#f2e8d8', side: THREE.DoubleSide }));
  mark.position.set(5.0, heightAt(4.2, -8.5) + 4.35, -8.42);
  scene.add(mark);
  colliders.push({ x: 4.2, z: -8.5, r: 0.35 });
  const bannerBase = bannerGeo.attributes.position.array.slice();

  // Dirt path stones
  const pathMat = flatMat('#9a7a55');
  for (let i = 0; i < 28; i++) {
    const z = 12 - i * 0.7;
    const x = Math.sin(i * 0.4) * 0.35;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.12, 0), pathMat);
    s.position.set(x, heightAt(x, z) + 0.04, z);
    s.scale.y = 0.35;
    scene.add(s);
  }

  // ---- Horses ----
  function horse(x, z, color, scale = 1, grazing = true) {
    const m = flatMat(color);
    const dark = flatMat('#2a1810');
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.85, 0.65), m);
    body.position.y = 1.25;
    const neck = new THREE.Group();
    neck.position.set(0.85, 1.45, 0);
    const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.38), m);
    neckMesh.position.set(0.22, 0.35, 0);
    neckMesh.rotation.z = -0.55;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 0.32), m);
    head.position.set(0.75, 0.7, 0);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.4), dark);
    mane.position.set(0.1, 0.4, 0);
    mane.rotation.z = -0.55;
    neck.add(neckMesh, head, mane);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.16), dark);
    tail.position.set(-1.0, 1.05, 0);
    tail.rotation.z = 0.35;
    h.add(body, neck, tail);
    for (const [lx, lz] of [[0.65, 0.22], [0.65, -0.22], [-0.65, 0.22], [-0.65, -0.22]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.18), m);
      leg.position.set(lx, 0.48, lz);
      h.add(leg);
    }
    h.position.set(x, heightAt(x, z), z);
    h.scale.setScalar(scale);
    h.rotation.y = grazing ? Math.random() * 6 : 0.4;
    scene.add(h);
    colliders.push({ x, z, r: 1.05 * scale });
    return { neck, group: h, phase: Math.random() * 6 };
  }
  const horses = [];
  // Herd RIGHT — close enough to sit in default wide / cinematic view (f03)
  const herdColors = ['#7a4a28', '#5c3820', '#8b5a34', '#6b4428', '#4a3020', '#7a5030', '#6a4028'];
  for (let i = 0; i < herdN; i++) {
    const hx = 8 + (i % 5) * 1.9 + Math.random() * 0.8;
    const hz = -1 + Math.floor(i / 5) * 2.4 + Math.random() * 1.0;
    horses.push(horse(hx, hz, herdColors[i % herdColors.length], 0.85 + Math.random() * 0.2));
  }
  // Player horse foreground on path (aerial: small bottom-center)
  const playerHorse = horse(-0.8, 27.5, '#6a4028', 1.05, false);
  // saddle bags
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.45), flatMat('#4a3020'));
  bag.position.set(-0.2, 1.35, 0.4);
  playerHorse.group.add(bag);
  const bag2 = bag.clone();
  bag2.position.z = -0.4;
  playerHorse.group.add(bag2);
  horses.push(playerHorse);

  // ---- Sparse rocks (video hills are soft; few stones) + grass ----
  const rockMat = flatMat('#8a8278');
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    if (Math.hypot(x, z + 2) < 12) continue;
    if (Math.abs(x - riverX(z)) < 7) continue;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.7, 0), rockMat);
    r.position.set(x, heightAt(x, z) + 0.06, z);
    r.scale.set(1, 0.4 + Math.random() * 0.35, 1);
    r.rotation.set(Math.random(), Math.random() * 6, Math.random() * 0.3);
    scene.add(r);
  }

  // Dense ochre-olive grass tufts — ONE InstancedMesh, frustum-culled
  const tuftGeo = new THREE.ConeGeometry(0.16, 0.35, 4);
  const GRASS_N = grassN;
  const tufts = new THREE.InstancedMesh(tuftGeo, flatMat('#c8b060'), GRASS_N);
  tufts.frustumCulled = true;
  tufts.castShadow = false;
  tufts.receiveShadow = false;
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const eul = new THREE.Euler();
  let placed = 0;
  for (let i = 0; i < GRASS_N * 2 && placed < GRASS_N; i++) {
    const x = (Math.random() - 0.5) * 130;
    const z = (Math.random() - 0.5) * 130;
    if (Math.abs(x - riverX(z)) < 5) continue;
    p3.set(x, heightAt(x, z) + 0.28, z);
    eul.set(0, Math.random() * 6, (Math.random() - 0.5) * 0.2);
    quat.setFromEuler(eul);
    const sc = 0.7 + Math.random() * 0.9;
    scl.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
    m4.compose(p3, quat, scl);
    tufts.setMatrixAt(placed++, m4);
  }
  tufts.count = placed;
  tufts.instanceMatrix.needsUpdate = true;
  tufts.computeBoundingSphere?.();
  if (!tufts.boundingSphere) tufts.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 95);
  scene.add(tufts);

  // Firewood pile
  const logMat = flatMat('#4a3220');
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), logMat);
    log.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    log.rotation.y = Math.random();
    log.position.set(2.2 + (i % 3) * 0.15, 0.12 + Math.floor(i / 3) * 0.12, 0.3 + (i % 2) * 0.2);
    scene.add(log);
  }

  // Campfire + smoke
  const fire = new THREE.PointLight('#ff8a3c', 2.4, 14);
  fire.position.set(1.5, 0.7, 1.2);
  scene.add(fire);
  const ember = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 6), new THREE.MeshBasicMaterial({ color: '#ff9a3c' }));
  ember.position.set(1.5, 0.35, 1.2);
  scene.add(ember);
  const SMOKE_N = doSmoke ? 48 : 0;
  const smokeGeo = new THREE.BufferGeometry();
  const smokeArr = new Float32Array(Math.max(1, SMOKE_N) * 3);
  const smokeAge = new Float32Array(Math.max(1, SMOKE_N));
  const smokeSources = [
    [1.5, 1.2],
    [-3.5, -8],
    [-8.5, -5.5],
    [0.5, -5.8],
  ];
  for (let i = 0; i < SMOKE_N; i++) {
    const src = smokeSources[i % smokeSources.length];
    smokeArr[i * 3] = src[0];
    smokeArr[i * 3 + 1] = 1 + Math.random() * 3;
    smokeArr[i * 3 + 2] = src[1];
    smokeAge[i] = Math.random();
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeArr, 3));
  if (SMOKE_N > 0) {
    scene.add(new THREE.Points(
      smokeGeo,
      new THREE.PointsMaterial({ color: '#cfc7bb', size: 0.55, transparent: true, opacity: 0.32, depthWrite: false })
    ));
  }

  // Wind dust
  const N = doDustBits ? 220 : 0;
  const dGeo = new THREE.BufferGeometry();
  const arr = new Float32Array(Math.max(1, N) * 3);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 90;
    arr[i * 3 + 1] = Math.random() * 7;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  if (N > 0) {
    scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({ color: '#efe6d2', size: 0.07, transparent: true, opacity: 0.5 })));
  }

  // Hoelun
  const hoelun = createHoelun();
  hoelun.rotation.y = 0.5;
  hoelun.position.set(3.2, heightAt(3.2, -1.2), -1.2);
  scene.add(hoelun);
  colliders.push({ x: 3.2, z: -1.2, r: 0.85 });

  function glowRing(color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    return ring;
  }
  const hoelunGlow = glowRing('#e8c37a');
  hoelunGlow.position.set(3.2, heightAt(3.2, -1.2) + 0.04, -1.2);
  scene.add(hoelunGlow);

  // Chirha
  const chirha = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 8), flatMat('#5a4630'));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.3;
  const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), flatMat('#b98a60'));
  cHead.position.set(0.95, 0.35, 0);
  const feltPad = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1), flatMat('#8c7a5e'));
  feltPad.position.y = 0.04;
  chirha.add(feltPad, body, cHead);
  chirha.position.set(-6.5, heightAt(-6.5, 0.8), 0.8);
  scene.add(chirha);
  colliders.push({ x: -6.5, z: 0.8, r: 1.3 });
  const chirhaGlow = glowRing('#e8c37a');
  chirhaGlow.position.set(-6.5, heightAt(-6.5, 0.8) + 0.04, 0.8);
  scene.add(chirhaGlow);

  // Player body for chase cam
  const temujin = createTemujin();
  temujin.position.set(0, 0, 10);
  scene.add(temujin);

  // Compass toward Burkhan (north teaser)
  const compass = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.2, 6),
    new THREE.MeshBasicMaterial({ color: '#e8c37a', transparent: true, opacity: 0.75 })
  );
  compass.position.set(0, 2.4, -72);
  compass.rotation.x = Math.PI;
  scene.add(compass);

  function update(dt, t, nearSet, playerPos, playerMoving) {
    temujin.userData.setMoving?.(!!playerMoving);
    temujin.userData.update?.(dt, t);
    hoelun.userData.update(t, playerPos);

    if (N > 0) {
      const p = dGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let x = p.getX(i) + dt * 5.5;
        if (x > 45) x = -45;
        p.setX(i, x);
        p.setY(i, p.getY(i) + Math.sin(t * 2 + i) * 0.004);
      }
      p.needsUpdate = true;
    }

    if (SMOKE_N > 0) {
      const sp = smokeGeo.attributes.position;
      for (let i = 0; i < SMOKE_N; i++) {
        smokeAge[i] += dt * 0.28;
        if (smokeAge[i] > 1) smokeAge[i] = 0;
        const a = smokeAge[i];
        const src = smokeSources[i % smokeSources.length];
        const baseY = i % smokeSources.length === 0 ? 0.7 : 4.2;
        sp.setX(i, src[0] + Math.sin(t * 1.8 + i) * 0.2 * a);
        sp.setY(i, baseY + a * 3.2);
        sp.setZ(i, src[1] + Math.cos(t * 1.5 + i) * 0.2 * a);
      }
      sp.needsUpdate = true;
    }

    fire.intensity = 1.9 + Math.sin(t * 13) * 0.35 + Math.random() * 0.15;
    ember.scale.y = 1 + Math.sin(t * 9) * 0.18;
    clouds.forEach((c, i) => {
      c.position.x += dt * (0.35 + (i % 3) * 0.08);
      if (c.position.x > 110) c.position.x = -110;
    });
    compass.position.y = 2.4 + Math.sin(t * 2) * 0.15;
    horses.forEach((h) => {
      h.neck.rotation.z = -0.85 + Math.sin(t * 0.7 + h.phase) * 0.32;
    });
    const bp = bannerGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x0 = bannerBase[i * 3];
      bp.setZ(i, Math.sin(t * 3.5 + x0 * 3) * 0.18 * (x0 + 0.75));
    }
    bp.needsUpdate = true;
    riverMat.color.setHSL(0.11, 0.38, 0.48 + Math.sin(t * 1.2) * 0.015);

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
    // True f03 aerial: ~58m up, pitch ~-25°, look toward low sun
    // Camp mid-frame left ~1/3; rider small bottom-center; river BL→horizon
    aerialView: {
      eye: new THREE.Vector3(16, 58, 92),
      look: new THREE.Vector3(-8, 4, -48),
      fov: 44,
    },
  };
}
