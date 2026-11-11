// Ia · Сорхан-Ширагийн гэр (§85–87): inside the ger at night. The cangue is
// burnt in the hearth, Temujin hides under the wool while the searchers poke
// around, then Khadaan sends him off.
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';
import { createFigure } from '../characters/figure.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const R = 6.2;

function latticeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#cfc4ac';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 256, 30, 3); }
  g.strokeStyle = '#8a4a22';
  g.lineWidth = 5;
  for (let x = -256; x < 768; x += 32) {
    g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 150, 30); g.stroke();
    g.beginPath(); g.moveTo(x, 256); g.lineTo(x - 150, 30); g.stroke();
  }
  g.fillStyle = '#7a2a1c'; g.fillRect(0, 0, 512, 30);
  g.fillStyle = '#d9a23a';
  for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x + 16, 6); g.lineTo(x + 32, 26); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rugTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = b; g.lineWidth = 6; g.strokeRect(8, 8, 112, 112);
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.save(); g.translate(32 + i * 32, 32 + j * 32); g.rotate(Math.PI / 4); g.strokeRect(-9, -9, 18, 18); g.restore(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function chest(w = 1.3) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.75, 0.6), new THREE.MeshLambertMaterial({ map: rugTexture('#c8581c', '#f0c040') }));
  b.position.y = 0.38;
  g.add(b);
  return g;
}

export function buildSorkhanGer(scene) {
  scene.background = new THREE.Color('#0b0806');
  scene.fog = new THREE.Fog('#0b0806', 14, 30);
  scene.add(new THREE.HemisphereLight('#a89070', '#3a2a1c', 1.25));
  const moon = new THREE.DirectionalLight('#8fa4d8', 0.35);
  moon.position.set(0, 10, 2);
  scene.add(moon);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 40), lam('#6a5236'));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.9, 40, 1, true), new THREE.MeshLambertMaterial({ map: latticeTexture(), side: THREE.BackSide }));
  wall.position.y = 0.95;
  scene.add(wall);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.95, R, 1.9, 40, 1, true), new THREE.MeshLambertMaterial({ color: '#b8ab90', side: THREE.BackSide }));
  roof.position.y = 2.85;
  scene.add(roof);
  const poleM = lam('#c8581c');
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const A = new THREE.Vector3(Math.cos(a) * R, 1.9, Math.sin(a) * R);
    const B = new THREE.Vector3(Math.cos(a) * 0.95, 3.8, Math.sin(a) * 0.95);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, A.distanceTo(B), 4), poleM);
    p.position.copy(A).add(B).multiplyScalar(0.5);
    p.position.y -= 0.04;
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    scene.add(p);
  }
  const toono = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 20), poleM);
  toono.rotation.x = Math.PI / 2;
  toono.position.y = 3.8;
  scene.add(toono);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), new THREE.MeshBasicMaterial({ color: '#1a2a55' }));
  sky.rotation.x = Math.PI / 2;
  sky.position.y = 3.82;
  scene.add(sky);
  for (const sx of [-1.15, 1.15]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.8, 6), poleM);
    post.position.set(sx, 1.9, -0.9);
    scene.add(post);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.1), new THREE.MeshLambertMaterial({ map: rugTexture('#a8301c', '#f0c040') }));
  door.position.set(0, 0.85, R - 0.08);
  scene.add(door);

  // rugs
  [[0, 2.6, 3.4, 2.2, '#8a2a22', '#e8c37a'], [-3.2, -1.2, 2.2, 3, '#2a4a7a', '#e8e4d8'], [3.2, -1.2, 2.2, 3, '#7a4a1a', '#e8c37a']].forEach(([x, z, w, d, a, b]) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: rugTexture(a, b) }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.02, z);
    scene.add(r);
  });
  // chests on the north side (хоймор), beds east and west
  [[-1.5, -5.2, 0], [0, -5.35, 0], [1.5, -5.2, 0]].forEach(([x, z]) => { const c = chest(); c.position.set(x, 0, z); scene.add(c); });
  for (const sx of [-1, 1]) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 2.4), lam('#7a3a1c'));
    bed.position.set(sx * 4.6, 0.23, -1.6);
    bed.rotation.y = sx * 0.35;
    const felt = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 2.2), lam('#d9d2c2'));
    felt.position.set(sx * 4.6, 0.5, -1.6);
    felt.rotation.y = bed.rotation.y;
    scene.add(bed, felt);
  }

  // hearth: iron tripod, cauldron, fire
  const iron = lam('#2a2624');
  const hearth = new THREE.Group();
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 5, 14), iron);
  ringM.rotation.x = Math.PI / 2;
  ringM.position.y = 0.55;
  hearth.add(ringM);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), iron);
    leg.position.set(Math.cos(a) * 0.5, 0.28, Math.sin(a) * 0.5);
    hearth.add(leg);
  }
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), iron);
  pot.position.y = 0.98;
  pot.material = lam('#2a2624', { side: THREE.DoubleSide });
  hearth.add(pot);
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), new THREE.MeshBasicMaterial({ color: i < 2 ? '#fff0b0' : '#ffa030' }));
    f.position.set((Math.random() - 0.5) * 0.3, 0.3, (Math.random() - 0.5) * 0.3);
    hearth.add(f);
    flames.push(f);
  }
  const fireLight = new THREE.PointLight('#ffa860', 5.5, 22, 1.2);
  fireLight.position.y = 1.0;
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(512, 512);
  hearth.add(fireLight);
  scene.add(hearth);

  // the wool cart
  const cartPos = { x: -3.6, z: 2.6 };
  const cartG = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 2.2), lam('#6a4a2a'));
  bed.position.y = 0.6;
  cartG.add(bed);
  for (const sx of [-0.82, 0.82]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 12), lam('#5a3e22'));
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx, 0.58, 0);
    cartG.add(wh);
  }
  const woolM = lam('#e6e0d2');
  const wool = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + Math.random() * 0.2, 1), woolM);
    b.position.set((Math.random() - 0.5) * 1.0, 0.95 + Math.random() * 0.55, (Math.random() - 0.5) * 1.7);
    cartG.add(b);
    wool.push(b);
  }
  cartG.position.set(cartPos.x, 0, cartPos.z);
  cartG.rotation.y = 0.5;
  cartG.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(cartG);

  const temujin = createTemujin();
  scene.add(temujin);
  const cangue = new THREE.Group();
  {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.42), lam('#8a6a40'));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.08), lam('#5a4226'));
    bar.position.z = 0.2;
    const bar2 = bar.clone(); bar2.position.z = -0.2;
    cangue.add(board, bar, bar2);
    cangue.position.y = 1.4;
    temujin.add(cangue);
  }

  const figures = [];
  const person = (opts, x, z, yaw) => {
    const f = createFigure(opts);
    f.position.set(x, 0, z);
    f.rotation.y = yaw;
    f.userData.homeYaw = yaw;
    scene.add(f);
    figures.push(f);
    return f;
  };
  const glow = (x, z) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 28), new THREE.MeshBasicMaterial({ color: '#e8c37a', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.05, z);
    scene.add(ring);
    return ring;
  };
  const sorkhan = person({ model: 'elder', deel: '#4a5a6a' }, 2.3, -1.6, -0.9);
  person({ model: 'temujin', deel: '#2f5a8a', height: 1.58 }, 1.9, 1.3, -2.2); // Чимбай
  person({ model: 'temujin', deel: '#5a4a2a', height: 1.46 }, -1.7, 1.2, 2.2); // Чилаун
  const khadaan = person({ model: 'hoelun', deel: '#2f6a4a', height: 1.45 }, -1.4, -3.2, 0.4);

  let ctx = null;
  let step = 0; // 0 burn, 1 cart, 2 hold, 3 khadaan
  let hold = 0;
  const searchers = [];
  const npcs = [
    { obj: khadaan, name: 'Хадаантай', node: 'taichiud_khadaan', glow: glow(-1.4, -3.2), when: () => step === 3 },
  ];
  const usables = [
    {
      x: 0, z: 0, r: 2.1, label: 'Буулгаа галд түлэх', when: () => step === 0,
      use: () => { cangue.visible = false; step = 1; ctx.startDialogue('taichiud_burn'); },
    },
    {
      x: cartPos.x, z: cartPos.z, r: 2.6, label: 'Ноосон дотор нуугдах', when: () => step === 1,
      use: () => {
        step = 2; hold = 0;
        temujin.visible = false;
        ctx.teleport(cartPos.x + 0.9, cartPos.z + 0.9);
        ctx.toast('Тайчууд орж ирлээ! Бүү хөдөл', 2600);
        for (let i = 0; i < 2; i++) {
          const s = createFigure({ model: 'temujin', deel: ['#3a3f58', '#54402a'][i], shade: 0.9 });
          s.position.set(-0.5 + i, 0, R - 0.8);
          s.rotation.y = Math.PI;
          s.userData.noTurn = true;
          scene.add(s);
          figures.push(s);
          searchers.push(s);
        }
      },
    },
  ];
  const HOLD = 10;
  const world = {
    temujin,
    heightAt: () => 0,
    colliders: [
      { x: 0, z: 0, r: 0.75 }, { x: cartPos.x, z: cartPos.z, r: 1.25 }, { x: 2.3, z: -1.6, r: 0.5 }, { x: -1.4, z: -3.2, r: 0.5 },
      { x: 1.9, z: 1.3, r: 0.45 }, { x: -1.7, z: 1.2, r: 0.45 }, { x: -1.15, z: -0.9, r: 0.15 }, { x: 1.15, z: -0.9, r: 0.15 },
      { x: 0, z: -5.3, r: 1.2 }, { x: -1.6, z: -5.1, r: 0.8 }, { x: 1.6, z: -5.1, r: 0.8 }, { x: -4.6, z: -1.6, r: 1.1 }, { x: 4.6, z: -1.6, r: 1.1 },
    ],
    npcs,
    usables,
    limit: 4.1,
    startPos: new THREE.Vector3(0, 0, 4),
    startYaw: 0,
    chapterLabel: 'Ia · Сорхан-Ширагийн гэр',
    chapterId: 'taichiud',
    intro: 'taichiud_ger',
    stealth: null,
    bind(c) { ctx = c; },
    speedMul: () => (step === 2 ? 0.001 : 1),
    objective() {
      if (step === 0) return 'Гал дээр очиж буулгаа түлүүл (E)';
      if (step === 1) return 'Ноосон тэргэнд нуугд (E)';
      if (step === 2) return `Амьсгалаа дар · бүү хөдөл · ${Math.max(0, Math.ceil(HOLD - hold))}`;
      return 'Хадаанаас хоол авч ярь (E)';
    },
    update(dt, t, near) {
      temujin.userData.update?.(dt, t);
      flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * (9 + i * 2) + i) * 0.3; f.rotation.y = t * (1 + i * 0.3); });
      fireLight.intensity = 5.2 + Math.sin(t * 8) * 0.4 + Math.sin(t * 19) * 0.2;
      for (const f of figures) f.userData.update(dt, t, searchers.includes(f) ? null : temujin.position);
      for (const n of npcs) {
        const on = near?.has(n.obj) && n.when();
        n.glow.material.opacity += ((on ? 0.85 : 0) - n.glow.material.opacity) * Math.min(1, 8 * dt);
      }
      if (step === 2 && ctx && ctx.state() === 'explore') {
        const k = ctx.keys;
        if (k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.Space) {
          if (hold > 0.6) ctx.toast('Ноос хөдөллөө! Амьсгалаа дар', 1800);
          hold = 0;
        } else hold += dt;
        // searchers walk in, poke at the cart, walk out
        const ph = hold / HOLD;
        searchers.forEach((s, i) => {
          const tgt = ph < 0.75 ? [cartPos.x + 1.6 + i * 0.9, cartPos.z + 0.6 - i * 1.5] : [-0.5 + i, R - 0.8];
          const dx = tgt[0] - s.position.x, dz = tgt[1] - s.position.z, d = Math.hypot(dx, dz);
          if (d > 0.15) { s.position.x += (dx / d) * 1.7 * dt; s.position.z += (dz / d) * 1.7 * dt; s.rotation.y = Math.atan2(dx, dz); } else s.rotation.y = Math.atan2(cartPos.x - s.position.x, cartPos.z - s.position.z);
        });
        wool.forEach((b, i) => { b.position.y += Math.sin(t * 6 + i) * 0.0008; });
        if (hold >= HOLD) {
          step = 3;
          searchers.forEach((s) => { s.visible = false; });
          temujin.visible = true;
          ctx.startDialogue('taichiud_wool');
        }
      }
    },
  };
  return world;
}
