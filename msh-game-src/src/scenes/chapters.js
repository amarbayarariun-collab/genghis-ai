// Chapters after the camp, all played on the open steppe: flight to Burkhan
// Khaldun, the Taichiud capture and escape, Boorchi and the eight geldings,
// the Merkit raid and the khuraldai. Each one is a chain of quest steps
// (ride, hide, sneak, track, drive, search) between the story dialogues.
import * as THREE from 'three';
import { createSteppeScene } from './steppe-scene.js';
import { riverX } from '../camp-environment.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
const faceTo = (sx, sz, tx, tz) => Math.atan2(-(tx - sx), -(tz - sz));
const lam = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

function base(scene, q, opts) {
  const w = createSteppeScene(scene, { quality: q.quality, ...opts });
  w.limit = 175;
  w.stealth = null;
  w.night = opts.mood === 'night';
  const closers = {};
  /** run fn when the dialogue that ended on node `id` closes; fn may return a node to show instead */
  w.after = (id, fn) => { closers[id] = fn; };
  w.onNode = (id, prev) => (id === 'close' && closers[prev] ? closers[prev]() : undefined);
  return w;
}

function ring(cx, cz, r, n, s = 1, a0 = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, s, rot: -a + Math.PI / 2 };
  });
}

function ovoo() {
  const g = new THREE.Group();
  const st = lam('#8a8680');
  for (let i = 0; i < 26; i++) {
    const k = i / 26;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.25, 0), st);
    const a = Math.random() * Math.PI * 2, r = (1 - k) * 1.5 * Math.random();
    m.position.set(Math.cos(a) * r, 0.15 + k * 1.3, Math.sin(a) * r);
    m.scale.y = 0.7;
    g.add(m);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 5), lam('#4a3622'));
  pole.position.y = 2.4;
  g.add(pole);
  ['#2f6fd0', '#e8e4d8', '#2f6fd0'].forEach((c, i) => {
    const k = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1.2), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
    k.position.set(0.14 * (i - 1), 3.2 - i * 0.12, 0.05 * i);
    k.rotation.z = 0.25 * (i - 1);
    g.add(k);
  });
  return g;
}

function boulder(size = 3.2, color = '#e9e6de') {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), lam(color));
  const p = m.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + Math.sin(p.getX(i) * 3.1 + p.getY(i) * 2.3) * 0.12 + Math.cos(p.getZ(i) * 2.7) * 0.1;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.72, p.getZ(i) * k);
  }
  m.geometry.computeVertexNormals();
  m.castShadow = true;
  return m;
}

function cart({ canopy = true, wool = false } = {}) {
  const g = new THREE.Group();
  const wood = lam('#6a4a2a');
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 2.4), wood);
  bed.position.y = 0.85;
  g.add(bed);
  for (const sx of [-0.85, 0.85]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.1, 12), wood);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx, 0.78, 0);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 8), lam('#3a2a18'));
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wh.position);
    g.add(wh, hub);
  }
  for (const sx of [-0.5, 0.5]) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), wood);
    sh.rotation.x = Math.PI / 2;
    sh.position.set(sx, 0.85, 2.4);
    g.add(sh);
  }
  if (canopy) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 10, 1, false, 0, Math.PI), lam('#d9d2c2'));
    c.rotation.z = Math.PI / 2;
    c.rotation.y = Math.PI / 2;
    c.position.y = 0.95;
    g.add(c);
  }
  if (wool) {
    const wm = lam('#e6e0d2');
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 + Math.random() * 0.2, 1), wm);
      b.position.set((Math.random() - 0.5) * 1.0, 1.15 + Math.random() * 0.5, (Math.random() - 0.5) * 1.8);
      g.add(b);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function reedPatch(w, x, z, r = 3.4, n = 90) {
  const geo = new THREE.ConeGeometry(0.035, 1.9, 4);
  geo.translate(0, 0.95, 0);
  const im = new THREE.InstancedMesh(geo, lam('#8f9a4c'), n);
  const tip = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 5), lam('#5a3d22'), n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const py = Math.max(w.heightAt(px, pz), -0.45);
    const s = 0.8 + Math.random() * 0.7;
    d.position.set(px, py, pz);
    d.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * 6, (Math.random() - 0.5) * 0.25);
    d.scale.set(1, s, 1);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    d.position.y = py + 1.75 * s;
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    tip.setMatrixAt(i, d.matrix);
  }
  w.scene.add(im, tip);
}

function hoofprints(w, x, z, yaw) {
  const m = new THREE.MeshBasicMaterial({ color: '#2a2014', transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.16, 7), m);
    const k = (i - 7) * 0.9, side = (i % 2 ? 0.3 : -0.3);
    const px = x + Math.sin(yaw) * k + Math.cos(yaw) * side, pz = z + Math.cos(yaw) * k - Math.sin(yaw) * side;
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, w.heightAt(px, pz) + 0.05, pz);
    w.scene.add(p);
  }
}

const TAICHIUD_C = { x: -6, z: 74 };
const taichiudGers = () => [...ring(TAICHIUD_C.x, TAICHIUD_C.z, 17, 7, 1, 0.3), { x: -30, z: 86, s: 0.95, rot: 1.2 }];
const FOREST = { x: -78, z: -86, r: 44 };
const forestList = () => [
  { x: FOREST.x, z: FOREST.z, r: FOREST.r, n: 520 },
  { x: -132, z: -38, r: 26, n: 170 },
  { x: -24, z: -138, r: 24, n: 150 },
];

// ---------------------------------------------------------------------------
// I · Бурхан халдун (§79–81): ride for the forest, hide nine days, the white rock
// ---------------------------------------------------------------------------
export function buildBurkhan(scene, q) {
  const w = base(scene, q, { mood: 'dawn', gers: [{ x: 9, z: 3, s: 1, rot: 0.5 }], herd: false, forest: forestList() });
  w.chapterLabel = 'I бүлэг · Бурхан халдун';
  w.startPos = V(0, 16);
  w.startYaw = faceTo(0, 16, -50, -55);
  w.intro = 'burkhan_intro';
  w.mount = w.addHorse(2.6, 13.5, { lod: 'hi', graze: false, solid: false, yaw: 2.4 });

  const hunters = [0, 1, 2, 3, 4].map((i) => w.addRider(16 + i * 4, 92 + (i % 2) * 5, {
    deel: ['#3a3f58', '#4a3a30', '#2f4a48', '#54402a', '#3a3044'][i], coat: ['#4a3020', '#2a2220', '#6a4a2c', '#3a2a22', '#7a5a3a'][i], lance: i % 2 === 0, yaw: Math.PI,
  }));
  w.addBanner(22, 96, { color: '#5a1a22' });
  w.chase(hunters, {
    speed: 6.5,
    keepOut: { x: FOREST.x, z: FOREST.z, r: FOREST.r - 6 },
    active: () => ['flee', 'enter', 'hide'].includes(w.stepId()),
    onCatch: () => w.fail('Тайчууд гүйцэж барилаа. Морио унаж (F) ой руу давхи!'),
  });

  const mouth = [-49, -57];
  const rock = w.place(boulder(3.4), mouth[0] + 5, mouth[1] + 4.5, 1.2);
  rock.visible = false;
  w.colliders.push({ x: mouth[0] + 5, z: mouth[1] + 4.5, r: 0.01, kind: 'rock' });
  const rockCol = w.colliders[w.colliders.length - 1];
  const peak = [-98, -104];
  w.place(ovoo(), peak[0], peak[1]);
  w.colliders.push({ x: peak[0], z: peak[1], r: 1.6 });

  let still = 0;
  w.quest([
    { id: 'flee', text: 'Морио унаж (F) баруун хойд зүгийн ой руу давхи', at: [-50, -55], r: 10, cp: [0, 16] },
    {
      id: 'enter', text: 'Шугуй өтгөн, морь явахгүй · бууж (F) ойн гүн рүү яв', at: [FOREST.x, FOREST.z], r: 4.5, foot: true,
      done: () => { w.ctx.startDialogue('burkhan_start'); },
    },
    {
      id: 'hide',
      text: () => `Шугуйд хөдөлгөөнгүй нуугд · ${Math.max(0, Math.ceil(8 - still))}`,
      enter: () => { still = 0; },
      check: (dt, pos, moving) => {
        if (moving) still = 0; else still += dt;
        if (still >= 8) { rock.visible = true; rockCol.r = 3.4; w.ctx.startDialogue('burkhan_after'); return true; }
        return false;
      },
    },
    { id: 'exit', text: 'Ойн аманд очиж гарцыг шалга', at: mouth, r: 5.5, done: () => { w.ctx.startDialogue('burkhan_boulder'); } },
    { id: 'peak', text: 'Ойн оройн овоон дээр гарч эргэн тойрноо хар', at: peak, r: 4.5, done: () => { w.ctx.startDialogue('burkhan_decide'); } },
  ]);
  return w;
}

// ---------------------------------------------------------------------------
// Ia · Олзлолт (§81–82): the ambush at the forest mouth, the march in the cangue
// ---------------------------------------------------------------------------
export function buildCapture(scene, q) {
  const w = base(scene, q, { mood: 'sunset', gers: taichiudGers(), herd: false, forest: forestList() });
  w.chapterLabel = 'Ia бүлэг · Тайчууд олзлолт';
  w.chapterId = 'taichiud';
  w.startPos = V(-41, -46);
  w.startYaw = faceTo(-41, -46, -28, -30);
  w.place(boulder(3.4), -47, -54, 1.2);
  w.colliders.push({ x: -47, z: -54, r: 3.4 });

  const spot = [-28, -30];
  const targutai = w.addRider(spot[0] + 46, spot[1] + 30, { deel: '#6a1f24', coat: '#2a2220', lance: false, lod: 'hi' });
  const escorts = [0, 1, 2, 3, 4].map((i) => w.addRider(spot[0] + Math.cos(i * 1.4 + 0.6) * 55, spot[1] + Math.sin(i * 1.4 + 0.6) * 55, {
    deel: ['#3a3f58', '#4a3a30', '#2f4a48', '#54402a', '#3a3044'][i], coat: ['#4a3020', '#6a4a2c', '#3a2a22', '#7a5a3a', '#55402c'][i], lance: true,
  }));
  w.addBanner(TAICHIUD_C.x - 5, TAICHIUD_C.z - 26, { color: '#5a1a22' });
  w.addBanner(TAICHIUD_C.x + 4, TAICHIUD_C.z - 26, { cloth: false });
  w.addFire(TAICHIUD_C.x, TAICHIUD_C.z, { size: 1.5, range: 30, intensity: 3 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    w.addExtra(w.person({ model: i % 3 === 2 ? 'elder' : 'temujin', deel: ['#3a3f58', '#54402a', '#2f4a48', '#5a2a3a'][i % 4], crowd: true }), TAICHIUD_C.x + Math.cos(a) * 4.2, TAICHIUD_C.z + Math.sin(a) * 4.2, -a - Math.PI / 2);
  }

  let captured = false;
  let amb = 0;
  w.speedMul = () => (w.is('ambush') ? 0.001 : captured ? 0.66 : 1);
  w.onUpdate((dt, t, pos) => {
    if (!pos) return;
    if (w.is('ambush')) {
      [targutai, ...escorts].forEach((r, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        r.userData.moveTo(pos.x + Math.cos(a) * 5.2, pos.z + Math.sin(a) * 5.2, 13, dt, 0.7);
      });
    } else if (w.is('march')) {
      const dPl = Math.hypot(targutai.position.x - pos.x, targutai.position.z - pos.z);
      if (dPl < 9) targutai.userData.moveTo(TAICHIUD_C.x - 1, TAICHIUD_C.z - 27, 2.6, dt, 1);
    }
  });
  w.follow(escorts, { speed: 5, spread: 3.6, active: () => w.is('march') });

  w.quest([
    { id: 'out', text: 'Ойгоос гарч тал руу алх', at: spot, r: 6 },
    {
      id: 'ambush', text: 'Тайчууд бүслэв!',
      enter: () => { amb = 0; },
      check: (dt) => { amb += dt; if (amb > 4.2) { w.ctx.startDialogue('taichiud_capture'); return true; } return false; },
    },
    { id: 'wait', text: 'Таргутай-Хирилтуг' },
    {
      id: 'march', text: 'Буулгатай · Таргутайг дагаж Тайчуудын хүрээ рүү яв', at: [TAICHIUD_C.x - 1, TAICHIUD_C.z - 30], r: 6,
      done: () => { w.ctx.startDialogue('capture_arrive'); },
    },
  ]);
  w.after('taichiud_capture_after', () => { captured = true; w.setCangue(true); w.next(); });
  return w;
}

// ---------------------------------------------------------------------------
// Ia · Улаан тэргэл шөнө (§83–84): strike the guard, slip past the torches
// ---------------------------------------------------------------------------
export function buildEscape(scene, q) {
  const w = base(scene, q, { mood: 'night', gers: taichiudGers(), herd: false });
  w.chapterLabel = 'Ia · Буулга · Улаан тэргэл шөнө';
  w.chapterId = 'taichiud';
  w.startPos = V(-28, 67);
  w.startYaw = faceTo(-28, 67, -6, 74);
  w.intro = 'escape_intro';
  w.setCangue(true);
  w.speedMul = () => 0.82;
  w.addFire(TAICHIUD_C.x, TAICHIUD_C.z, { size: 1.6, range: 34, intensity: 3.2 });
  w.addFire(-34, 92, { size: 0.8, light: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    w.addExtra(w.person({ model: i % 3 === 2 ? 'elder' : 'temujin', deel: ['#3a3f58', '#54402a', '#2f4a48'][i % 3], crowd: true, shade: 0.8 }), TAICHIUD_C.x + Math.cos(a) * 4.4, TAICHIUD_C.z + Math.sin(a) * 4.4, -a - Math.PI / 2);
  }
  w.addBanner(TAICHIUD_C.x - 5, TAICHIUD_C.z - 26, { color: '#5a1a22' });

  const guard = w.person({ model: 'temujin', deel: '#4a5a3a', height: 1.6 });
  w.addNpc(guard, -26.2, 65.4, { name: 'Харуул залуу', node: 'taichiud_cangue_hit', when: () => w.is('guard') });

  const rx = riverX(98);
  const goal = [rx - 7.5, 98];
  reedPatch(w, goal[0], goal[1], 4.5, 150);
  reedPatch(w, goal[0] - 1, goal[1] + 9, 3.5, 90);
  reedPatch(w, goal[0] + 1, goal[1] - 9, 3.5, 90);

  const stat = [[-13, 92], [-1, 84], [6, 97], [-9, 104], [13, 86], [2, 110]].map(([x, z], i) => w.addTorch(x, z, { light: i < 2, radius: 5.4 }));
  const g1 = w.addWalker(w.person({ model: 'temujin', deel: '#3a3f58', shade: 0.85 }), -18, 98);
  const g2 = w.addWalker(w.person({ model: 'temujin', deel: '#54402a', shade: 0.85 }), 8, 106);
  const r1 = w.addRider(-24, 116, { deel: '#3a3044', coat: '#2a2220', shade: 0.85 });
  w.carryTorch(g1, 5, 1.9);
  w.carryTorch(g2, 5, 1.9);
  w.carryTorch(r1, 6, 2.6);
  w.patrol(g1, [[-18, 98], [-4, 95], [-6, 108], [-20, 108]], 1.5);
  w.patrol(g2, [[8, 106], [10, 92], [0, 100]], 1.4);
  w.patrol(r1, [[-24, 116], [18, 118], [18, 124], [-24, 122]], 3.4);
  w.stealth = { torches: [...stat, ...w.torches], spotted: false };
  w.onSpotted = () => { w.ctx.teleport(-28, 67); };

  w.quest([
    { id: 'guard', text: 'Харуул залуу дээр очиж E дар' },
    {
      id: 'sneak', text: 'Бамбарын гэрлээс зайлж зүүн урд зүгт Ононы зэгс рүү яв', at: goal, r: 4,
      done: () => { w.ctx.startDialogue('taichiud_escape_run'); },
    },
  ]);
  w.after('taichiud_cangue_after', () => {
    guard.rotation.x = -Math.PI / 2;
    guard.position.y += 0.25;
    guard.userData.update = () => {};
    w.next();
  });
  return w;
}

// ---------------------------------------------------------------------------
// Ia · Ононы зэгс (§85): lie in the water while the searchers pass twice
// ---------------------------------------------------------------------------
export function buildRiver(scene, q) {
  const w = base(scene, q, { mood: 'dawn', gers: taichiudGers(), herd: false });
  w.chapterLabel = 'Ia · Онон · Зэгс';
  w.chapterId = 'taichiud';
  w.fordable = true;
  w.night = true;
  const zone = (z) => ({ x: riverX(z) - 5.2, z });
  const A = zone(98), B = zone(72);
  [A, B, zone(124), zone(48)].forEach((p) => { reedPatch(w, p.x, p.z, 4.2, 150); reedPatch(w, p.x - 2.5, p.z + 4, 2.8, 60); });
  w.startPos = V(A.x, A.z);
  w.startYaw = faceTo(A.x, A.z, A.x - 10, A.z + 2);
  w.intro = 'river_intro';
  w.speedMul = () => 0.7;

  const bankX = (z) => riverX(z) - 15;
  const searchers = [0, 1, 2].map((i) => w.addRider(bankX(150) - i * 3, 150 + i * 7, { deel: ['#3a3f58', '#54402a', '#3a3044'][i], coat: ['#2a2220', '#4a3020', '#6a4a2c'][i], lance: i === 1, yaw: Math.PI }));
  searchers.forEach((s) => w.carryTorch(s, 6, 2.6));
  let dir = -1; // -1 riding downstream (south), +1 coming back
  let lead = 150;
  const resetSearch = () => {
    const back = w.is('hideB');
    dir = back ? 1 : -1;
    lead = back ? 34 : 150;
    searchers.forEach((s, i) => { const z = lead - dir * i * 7; s.position.set(bankX(z) - i * 3, w.heightAt(bankX(z), z), z); });
  };
  const inZone = (pos) => [A, B].some((p) => Math.hypot(pos.x - p.x, pos.z - p.z) < 4.2);
  let grace = 0;
  w.onUpdate((dt, t, pos, ) => {
    if (!w.ctx || w.ctx.state() !== 'explore' || w.is('sorkhan')) return;
    const speed = 4.4;
    if (w.is('moveB') && lead < 36) { /* wait at the turn until the player is in place */ } else lead += dir * speed * dt;
    if (dir < 0 && lead < 34) { lead = 34; if (!w.is('moveB')) dir = 1; }
    searchers.forEach((s, i) => { const z = lead - dir * i * 7; s.userData.moveTo(bankX(z) - i * 3, z, speed, dt, 0.2); });
    grace = Math.max(0, grace - dt);
    if (grace > 0 || !pos) return;
    const moving = w.movingNow;
    for (const s of searchers) {
      const d = Math.hypot(s.position.x - pos.x, s.position.z - pos.z);
      if (d < 15 && (!inZone(pos) || moving)) {
        grace = 3;
        w.ctx.startDialogue('river_spotted');
        w.ctx.teleport(w.is('hideA') ? A.x : B.x, w.is('hideA') ? A.z : B.z);
        if (w.is('moveB')) w.ctx.teleport(A.x, A.z);
        resetSearch();
        return;
      }
    }
  });

  const sorkhan = w.addRider(B.x - 40, B.z + 30, { model: 'elder', deel: '#4a5a6a', coat: '#7a5a3a' });
  sorkhan.visible = false;
  w.addNpc(sorkhan, B.x - 40, B.z + 30, { name: 'Сорхан-Ширатай', node: 'taichiud_river', when: () => w.is('sorkhan'), solid: false });
  w.onUpdate((dt) => { if (w.is('sorkhan')) sorkhan.userData.moveTo(B.x - 6.5, B.z + 1, 5, dt, 0.6); });

  w.quest([
    {
      id: 'hideA', text: 'Зэгсэн дунд хөдөлгөөнгүй хэвт · эрлийнхэн ойртож байна',
      check: (dt, pos, moving) => { w.movingNow = moving; return dir < 0 && lead < 62; },
    },
    {
      id: 'moveB', text: 'Тэд буцаж ирнэ · урсгал уруудан дараагийн зэгс рүү шилж', at: [B.x, B.z], r: 2.6,
      check: (dt, pos, moving) => { w.movingNow = moving; return false; },
      done: () => { dir = 1; },
    },
    {
      id: 'hideB', text: 'Хөдөлгөөнгүй хэвт · эрлийнхэн буцаж өнгөрч байна',
      check: (dt, pos, moving) => { w.movingNow = moving; return dir > 0 && lead - 14 > B.z + 22; },
    },
    { id: 'sorkhan', text: 'Хоцорч яваа нэг хүн чамайг олж харлаа · түүнтэй ярь (E)', enter: () => { sorkhan.visible = true; } },
  ]);
  return w;
}

// ---------------------------------------------------------------------------
// Ia · Гүүгээр гарсан нь (§87–88): ride the mare past the patrols, home
// ---------------------------------------------------------------------------
export function buildFlight(scene, q) {
  const home = { x: -122, z: -98 };
  const w = base(scene, q, { mood: 'night', gers: [...taichiudGers(), { x: home.x, z: home.z - 5, s: 0.95, rot: 0.3 }], herd: false, forest: [{ x: -150, z: -120, r: 22, n: 130 }] });
  w.chapterLabel = 'Ia · Гүүгээр гарсан нь';
  w.chapterId = 'taichiud';
  w.startPos = V(-37, 91);
  w.startYaw = faceTo(-37, 91, home.x, home.z);
  w.intro = 'flight_intro';
  w.mount = w.addHorse(-39.5, 88.5, { lod: 'hi', coat: '#a8743c', graze: false, solid: false, yaw: -2.2 });
  w.addFire(TAICHIUD_C.x, TAICHIUD_C.z, { size: 1.3, range: 30, intensity: 2.6 });
  w.addExtra(w.person({ model: 'elder', deel: '#4a5a6a' }), -35, 92.5, -2.4);

  const loops = [
    [[-52, 60], [-70, 30], [-48, 22], [-36, 50]],
    [[-78, 2], [-100, -24], [-72, -34], [-60, -10]],
    [[-100, 40], [-120, 8], [-96, 4]],
    [[-96, -56], [-128, -66], [-104, -78]],
  ];
  loops.forEach((lp, i) => {
    const r = w.addRider(lp[0][0], lp[0][1], { deel: ['#3a3f58', '#54402a', '#3a3044', '#2f4a48'][i], coat: ['#2a2220', '#4a3020', '#6a4a2c', '#3a2a22'][i], lance: true, shade: 0.85 });
    w.carryTorch(r, 8.5, 2.6);
    w.patrol(r, lp, 3.6 + i * 0.3);
  });
  w.stealth = { torches: w.torches, spotted: false };
  w.spottedNode = 'taichiud_spotted';
  w.onSpotted = () => { if (w.ctx.riding()) w.ctx.dismount(); w.ctx.teleport(-37, 91); w.mount.position.set(-39.5, w.heightAt(-39.5, 88.5), 88.5); };

  w.addFire(home.x + 3, home.z + 2, { size: 0.8, range: 14, intensity: 1.8 });
  w.addExtra(w.person({ model: 'hoelun' }), home.x + 1, home.z + 4, 0.6);
  w.addExtra(w.person({ model: 'temujin', deel: '#3a4a6a', height: 1.35, crowd: true }), home.x + 4.4, home.z + 4.2, -0.6);
  w.addExtra(w.person({ model: 'temujin', deel: '#5a4a2a', height: 1.15, crowd: true }), home.x + 5, home.z + 1.4, -1.2);
  w.quest([
    {
      id: 'ride', text: 'Гүүгээ унаж (F) бамбартай харуулаас зайлан баруун хойш давхи', at: [home.x + 2, home.z + 7], r: 7,
      done: () => { w.ctx.dismount(); w.ctx.startDialogue('taichiud_home'); },
    },
  ]);
  return w;
}

// ---------------------------------------------------------------------------
// II · Боорчи · Бөртэ (§90–94): track the eight geldings, drive them home
// ---------------------------------------------------------------------------
export function buildAct2(scene, q) {
  const BO = { x: -116, z: -58 };
  const TH = { x: -44, z: -138 };
  const DS = { x: 84, z: -34 };
  const w = base(scene, q, {
    mood: 'sunset',
    gers: [{ x: -5, z: 1, s: 1, rot: 0.5 }, { x: 5, z: -3, s: 0.9, rot: -0.4 }, { x: BO.x - 6, z: BO.z - 6, s: 1.05, rot: 0.8 },
      ...ring(TH.x, TH.z, 12, 5, 0.95, 0.5), ...ring(DS.x, DS.z, 11, 4, 1.05, 0.2)],
    herd: true, herdAt: { x: BO.x + 12, z: BO.z + 6 }, forest: [{ x: -150, z: -130, r: 26, n: 150 }],
  });
  w.chapterLabel = 'II бүлэг · Боорчи · Бөртэ';
  w.startPos = V(0, 15);
  w.startYaw = faceTo(0, 15, -42, 6);
  w.intro = 'act2_intro';
  w.mount = w.addHorse(2.8, 12.5, { lod: 'hi', coat: '#b08a52', graze: false, solid: false, yaw: 2.2 });
  w.addExtra(w.person({ model: 'hoelun' }), -2.5, 6, 0.3);

  const tracks = [[-42, 6], [-84, -22], [-104, -48]];
  tracks.forEach(([x, z], i) => hoofprints(w, x, z, Math.atan2((tracks[i + 1]?.[0] ?? BO.x) - x, (tracks[i + 1]?.[1] ?? BO.z) - z)));

  const boorchi = w.person({ model: 'temujin', deel: '#2f5a8a', height: 1.7 });
  w.addNpc(boorchi, BO.x, BO.z, { name: 'Боорчитой', node: 'boorchi', when: () => w.is('boorchi') });
  const boorchiR = w.addRider(BO.x + 2, BO.z + 1, { deel: '#2f5a8a', coat: '#c9b48a', lod: 'hi' });
  boorchiR.visible = false;
  w.follow([boorchiR], { speed: 9, spread: 3, active: () => boorchiR.visible && !w.is('borte') });

  const geldings = Array.from({ length: 8 }, (_, i) => {
    const r = w.addRider(TH.x + 16 + (i % 4) * 2.4, TH.z + 12 + Math.floor(i / 4) * 2.6, { noRider: true, coat: ['#d9c08a', '#cdb47c', '#e0c894'][i % 3], yaw: 0.6 });
    return r;
  });
  let driven = false;
  w.follow(geldings, { speed: 9.4, spread: 2.6, active: () => driven });
  const thieves = [0, 1, 2].map((i) => w.addRider(TH.x + i * 3 - 3, TH.z + 3, { deel: ['#4a3a30', '#3a3044', '#54402a'][i], coat: i === 0 ? '#e6e2d8' : '#3a2a22', lance: i !== 0 }));
  w.addFire(TH.x, TH.z, { size: 1.1, range: 22, intensity: 2.4 });
  w.chase(thieves, {
    speed: 6.9, active: () => w.is('escape') && Math.hypot(w.ctx.player.pos.x - herdSpot[0], w.ctx.player.pos.z - herdSpot[1]) > 14,
    onCatch: () => w.fail('Нэхэгчид уургалав! Дахин тууж гар.'),
  });
  const herdSpot = [TH.x + 19, TH.z + 13];
  w.use(herdSpot[0], herdSpot[1], 'Найман шаргыг тууж гарах', () => {
    driven = true;
    w.ctx.startDialogue('act2_drive');
    w.next();
  }, { r: 6, when: () => w.is('drive') });

  const borte = w.person({ model: 'hoelun', deel: '#a8242c', height: 1.62 });
  w.addNpc(borte, DS.x - 1.5, DS.z + 1, { name: 'Бөртэтэй', node: 'borte', when: () => w.is('borte') });
  w.addExtra(w.person({ model: 'elder', deel: '#6a5a2a' }), DS.x + 1.4, DS.z - 0.5, -0.8);
  w.addBanner(DS.x + 4, DS.z + 4, { color: '#a8242c' });
  w.addHorse(DS.x - 6, DS.z + 5, { coat: '#e6e2d8' });

  w.quest([
    { id: 't1', text: 'Мориор (F) баруун зүгт мөрийг нэх · 1/3', at: tracks[0], r: 6, done: () => w.ctx.toast('Мөр баруун урагш эргэжээ', 2200) },
    { id: 't2', text: 'Мөрийг нэх · 2/3', at: tracks[1], r: 6, done: () => w.ctx.toast('Гурав хоног нэхлээ. Мөр шинэхэн байна', 2200) },
    { id: 't3', text: 'Мөрийг нэх · 3/3', at: tracks[2], r: 6, done: () => w.ctx.toast('Их адуун дунд гүү сааж буй залуу харагдана', 2600) },
    { id: 'boorchi', text: 'Гүү сааж буй залуутай ярь (E)', at: [BO.x, BO.z] },
    { id: 'kuriyen', text: 'Боорчитой хамт дээрэмчдийн хүрээ рүү давхи', at: herdSpot, r: 9 },
    { id: 'drive', text: 'Найман шарга агтыг тууж гар (E)', at: herdSpot },
    {
      id: 'escape', text: 'Нэхэгчдээс мултарч Боорчийн гэр рүү давхи', at: [BO.x + 2, BO.z + 4], r: 8, cp: herdSpot,
      done: () => { w.ctx.startDialogue('boorchi_part'); },
    },
    { id: 'borte', text: 'Ононыг мориор гаталж зүүн зүгт Дэй сэцэний хүрээнд очиж Бөртэтэй ярь', at: [DS.x - 1.5, DS.z + 1] },
  ]);
  w.after('boorchi_after', () => {
    boorchi.visible = false;
    boorchiR.visible = true;
    w.next();
  });
  return w;
}

// ---------------------------------------------------------------------------
// III · Мэргид · Чингис (§102–123): gather the allies, the night raid, the khuraldai
// ---------------------------------------------------------------------------
export function buildAct3(scene, q) {
  const TO = { x: -96, z: -96 };
  const JA = { x: -112, z: 66 };
  const ME = { x: 96, z: -84 };
  const KH = { x: -2, z: -44 };
  const w = base(scene, q, {
    mood: 'night',
    gers: [{ x: -5, z: 1, s: 1, rot: 0.5 }, ...ring(TO.x, TO.z, 11, 4, 1.1, 0.4), ...ring(JA.x, JA.z, 11, 4, 1.0, 1.0), ...ring(ME.x, ME.z, 15, 6, 0.95, 0.2)],
    herd: false, forest: [{ x: TO.x - 26, z: TO.z - 20, r: 30, n: 240 }, { x: JA.x - 24, z: JA.z + 18, r: 22, n: 130 }],
  });
  w.chapterLabel = 'III бүлэг · Мэргид · Чингис';
  w.startPos = V(0, 15);
  w.startYaw = faceTo(0, 15, TO.x, TO.z);
  w.intro = 'mergen_start';
  w.mount = w.addHorse(2.8, 12.5, { lod: 'hi', graze: false, solid: false, yaw: 2.2 });
  w.addFire(1, 7, { size: 0.7, range: 14, intensity: 1.6 });

  const tooril = w.person({ model: 'elder', deel: '#8a6a1a', height: 1.72 });
  w.addNpc(tooril, TO.x, TO.z, { name: 'Ван хан Тоорилтой', node: 'tooril', when: () => w.is('tooril') });
  w.addFire(TO.x + 2.5, TO.z + 2, { size: 1.1, range: 22, intensity: 2.4 });
  w.addBanner(TO.x - 3, TO.z + 1, { color: '#8a6a1a' });
  w.addExtra(w.person({ model: 'temujin', deel: '#54402a', crowd: true }), TO.x - 2, TO.z - 2.5, 0.6);

  const jamukha = w.person({ model: 'temujin', deel: '#22262e', height: 1.76 });
  w.addNpc(jamukha, JA.x, JA.z, { name: 'Жамуха андтай', node: 'jamukha', when: () => w.is('jamukha') });
  w.addFire(JA.x + 2.5, JA.z + 2, { size: 1.1, range: 22, intensity: 2.4 });
  w.addBanner(JA.x - 3, JA.z + 1, { cloth: false });

  const army = Array.from({ length: 9 }, (_, i) => {
    const r = w.addRider(JA.x + 8 + (i % 3) * 3, JA.z + 8 + Math.floor(i / 3) * 3, {
      deel: ['#22262e', '#8a6a1a', '#3a3f58'][i % 3], coat: ['#2a2220', '#4a3020', '#6a4a2c', '#7a5a3a'][i % 4], lance: i % 2 === 0, model: i === 4 ? 'elder' : 'temujin',
    });
    return r;
  });
  let marching = false;
  w.follow(army, { speed: 9.2, spread: 3.4, active: () => marching });

  // Merkit camp: fires, people who scatter, three carts rolling away
  w.addFire(ME.x, ME.z, { size: 1.4, range: 30, intensity: 3 });
  w.addFire(ME.x + 9, ME.z - 6, { size: 0.9, light: false });
  const merkit = Array.from({ length: 7 }, (_, i) => w.addWalker(w.person({ model: i % 3 ? 'temujin' : 'elder', deel: ['#4a3a30', '#3a3044', '#54402a'][i % 3], crowd: true, shade: 0.9 }), ME.x + Math.cos(i * 0.9) * 6, ME.z + Math.sin(i * 0.9) * 6));
  const carts = [0, 1, 2].map((i) => {
    const c = cart({ canopy: true });
    w.place(c, ME.x + 14 + i * 9, ME.z - 16 - i * 6, 0, 0.9);
    const ox = w.addRider(c.position.x + 2.6, c.position.z + 2.2, { noRider: true, coat: '#3a2a22', yaw: 0.9 });
    return { obj: c, ox, checked: false, use: null };
  });
  let raid = false;
  let found = 0;
  w.onUpdate((dt) => {
    if (!raid) return;
    merkit.forEach((m, i) => m.userData.moveTo(ME.x + 60 + i * 5, ME.z - 70 - (i % 3) * 8, 2.6, dt, 1));
    carts.forEach((c, i) => {
      if (c.checked) return;
      const tx = ME.x + 62 + i * 6, tz = ME.z - 52 - i * 12;
      const dx = tx - c.obj.position.x, dz = tz - c.obj.position.z, d = Math.hypot(dx, dz);
      if (d > 1) {
        c.obj.position.x += (dx / d) * 1.5 * dt; c.obj.position.z += (dz / d) * 1.5 * dt;
        c.obj.position.y = w.heightAt(c.obj.position.x, c.obj.position.z);
        c.obj.rotation.y = Math.atan2(dx, dz);
        c.ox.userData.moveTo(c.obj.position.x + (dx / d) * 3.4, c.obj.position.z + (dz / d) * 3.4, 1.5, dt, 0.1);
      }
      c.use.x = c.obj.position.x; c.use.z = c.obj.position.z;
    });
  });
  const borte = w.person({ model: 'hoelun', deel: '#a8242c', height: 1.62 });
  borte.visible = false;
  w.addExtra(borte, ME.x, ME.z, 0, false);
  carts.forEach((c) => {
    c.use = w.use(c.obj.position.x, c.obj.position.z, '«Бөртэ!» гэж дуудах', () => {
      c.checked = true;
      found++;
      if (found < 3) { w.ctx.toast('Энэ тэргэнд Бөртэ алга… дараагийнхыг шалга', 2400); return; }
      borte.visible = true;
      borte.position.set(c.obj.position.x - 1.6, w.heightAt(c.obj.position.x - 1.6, c.obj.position.z + 1), c.obj.position.z + 1);
      w.ctx.dismount();
      w.ctx.startDialogue('borte_found');
    }, { r: 4.2, when: () => w.is('search') && !c.checked });
  });

  // khuraldai mound
  w.addFire(KH.x, KH.z + 4, { size: 1.5, range: 30, intensity: 3 });
  for (let i = 0; i < 9; i++) w.addBanner(KH.x + Math.cos(i * 0.7 + 0.2) * 9, KH.z + Math.sin(i * 0.7 + 0.2) * 9 - 2, { cloth: i % 3 !== 0, color: i % 2 ? '#e8e4d8' : '#6a2030', h: i === 4 ? 6.4 : 4.6 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.5, 9), lam('#d9d2c2'));
  w.addNpc(seat, KH.x, KH.z, { name: 'Хуралдайн цагаан эсгий', node: 'chinggis', r: 1.9, when: () => w.is('council') });
  for (let i = 0; i < 14; i++) {
    const a = 0.5 + (i / 14) * (Math.PI * 2 - 1.0), r = 7 + (i % 2) * 2.2;
    w.addExtra(w.person({ model: i % 4 === 3 ? 'elder' : 'temujin', deel: ['#22262e', '#8a6a1a', '#3a3f58', '#2f5a8a', '#54402a'][i % 5], crowd: true }), KH.x + Math.sin(a) * r, KH.z + 4 + Math.cos(a) * r, a + Math.PI);
  }

  w.quest([
    { id: 'tooril', text: 'Мориор (F) баруун хойш Туулын Хар шугуйд Ван хан Тоорил дээр оч', at: [TO.x, TO.z] },
    { id: 'jamukha', text: 'Баруун урд зүгт Хорхонаг шугуйд Жамуха анда дээр оч', at: [JA.x, JA.z] },
    {
      id: 'raid', text: 'Цэргээ дагуулан Ононыг гаталж зүүн хойд зүгт Мэргидийн хүрээ рүү дайр', at: [ME.x, ME.z], r: 16,
      done: () => { raid = true; marching = false; w.ctx.startDialogue('act3_raid'); },
    },
    { id: 'search', text: () => `Зугтаж буй тэрэгнүүдээс Бөртэг хай · ${found}/3` },
    { id: 'council', text: 'Хуралдайн дов руу буцаж оч', at: [KH.x, KH.z] },
  ]);
  w.after('tooril_after', () => w.next());
  w.after('jamukha_after', () => { marching = true; w.next(); });
  w.after('act3_council', () => w.next());
  return w;
}
