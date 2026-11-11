// Shared outdoor scene builder: the open steppe (terrain, river, ranges, clouds,
// grass) under a time-of-day mood, plus helpers for fires, torches, NPC figures
// and a rideable horse. Every chapter outside the ger interior is built on this.
import * as THREE from 'three';
import { buildSteppeEnvironment, riverX } from '../camp-environment.js';
import { createTemujin } from '../characters/temujin.js';
import { createHorse } from '../characters/horse.js';
import { attachHorseModel } from '../characters/horse-model.js';
import { createFigure } from '../characters/figure.js';

export const MOODS = {
  day: {
    sky: { top: '#2f6fbe', mid: '#79b7e6', horizon: '#e7f4fb', ground: '#8fb56a' },
    fog: { color: '#c5d8ea', density: 0.00135 },
    sun: { color: '#fff4dd', intensity: 1.85, pos: [28, 46, 16] },
    hemi: { sky: '#d5e8ff', ground: '#6d8a48', intensity: 0.82 },
    rim: { color: '#c5ddf5', intensity: 0.32 },
  },
  // golden hour: low sun in the west, long shadows, pink-orange cloud banks
  sunset: {
    sky: { top: '#2b3a78', mid: '#b5688a', horizon: '#ffb45e', ground: '#a8743c' },
    sunGlow: { dir: [-0.82, 0.13, -0.55], color: '#ff8a3a', amount: 1.3 },
    fog: { color: '#e2a070', density: 0.0026 },
    cloud: { color: '#ffb890', emissive: '#b8455a', intensity: 0.55 },
    water: { deep: '#2a2a44', sky: '#c9896a', glint: '#ffd9a0' },
    sun: { color: '#ffae66', intensity: 2.5, pos: [-52, 13, -34] },
    hemi: { sky: '#ffc9a8', ground: '#5a4628', intensity: 0.62 },
    rim: { color: '#8a78c8', intensity: 0.45 },
    sunDisc: { color: '#ffe2a0', size: 16, dist: 430 },
  },
  // moonlit night: blue ambient, firelight does the rest
  night: {
    sky: { top: '#050918', mid: '#0d1838', horizon: '#243a66', ground: '#0a1020' },
    sunGlow: { dir: [-0.45, 0.62, -0.5], color: '#8fb0ff', amount: 0.55 },
    fog: { color: '#0f1830', density: 0.0045 },
    cloud: { color: '#33447a', emissive: '#1b2a5c', intensity: 0.9 },
    water: { deep: '#060c1c', sky: '#3a5a9a', glint: '#cfe0ff' },
    sun: { color: '#9ab4ff', intensity: 1.25, pos: [-30, 42, -34] },
    hemi: { sky: '#5a70bc', ground: '#141a30', intensity: 0.9 },
    rim: { color: '#3a4a8a', intensity: 0.25 },
    stars: true,
    moon: { size: 20, dist: 430 },
  },
  // misty dawn over the river
  dawn: {
    sky: { top: '#5a6ea8', mid: '#c8a4b8', horizon: '#ffd6a8', ground: '#8a8a6a' },
    sunGlow: { dir: [0.7, 0.1, -0.7], color: '#ffb070', amount: 1.0 },
    fog: { color: '#d9c4c0', density: 0.0075 },
    cloud: { color: '#ffd8c8', emissive: '#c88a90', intensity: 0.5 },
    water: { deep: '#3a4658', sky: '#f0c8b0', glint: '#fff0d0' },
    sun: { color: '#ffd2a8', intensity: 1.7, pos: [46, 14, -44] },
    hemi: { sky: '#dccfe6', ground: '#4c5440', intensity: 0.8 },
    rim: { color: '#9fb0d8', intensity: 0.35 },
    sunDisc: { color: '#fff0c8', size: 13, dist: 430 },
  },
};

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function glowRing(color = '#e8c37a') {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

export function createSteppeScene(scene, opts = {}) {
  const q = opts.quality || {};
  const mood = typeof opts.mood === 'string' ? MOODS[opts.mood] : (opts.mood || MOODS.day);
  const shadowsOn = q.shadows !== false;

  scene.add(new THREE.HemisphereLight(mood.hemi.sky, mood.hemi.ground, mood.hemi.intensity));
  const sun = new THREE.DirectionalLight(mood.sun.color, mood.sun.intensity);
  sun.position.set(...mood.sun.pos);
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);
  sun.castShadow = shadowsOn;
  const sm = q.shadowMap || 1024;
  sun.shadow.mapSize.set(sm, sm);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 160;
  Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(mood.rim.color, mood.rim.intensity);
  rim.position.set(-mood.sun.pos[0], 18, -mood.sun.pos[2]);
  scene.add(rim);

  const steppe = buildSteppeEnvironment(scene, {
    quality: q, shadows: shadowsOn, mood,
    gers: opts.gers, berries: opts.berries ?? false, herd: opts.herd, herdAt: opts.herdAt,
    hitch: opts.hitch ?? false, forest: opts.forest,
  });
  const heightAt = steppe.heightAt;
  const colliders = [...steppe.colliders];
  const dot = softDot();

  // sun disc / moon / stars
  const dir = new THREE.Vector3(...(mood.sunGlow?.dir || [0, 1, 0])).normalize();
  if (mood.sunDisc) {
    const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: mood.sunDisc.color, fog: false, depthWrite: false }));
    d.scale.setScalar(mood.sunDisc.size * 4.5);
    d.position.copy(dir).multiplyScalar(mood.sunDisc.dist);
    scene.add(d);
  }
  if (mood.moon) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(mood.moon.size, 24), new THREE.MeshBasicMaterial({ color: '#eef3ff', fog: false }));
    m.position.copy(dir).multiplyScalar(mood.moon.dist);
    m.lookAt(0, 0, 0);
    scene.add(m);
    // maria: a few darker flat patches so it reads as a moon, not a lamp
    const mm = new THREE.MeshBasicMaterial({ color: '#c9d4ee', fog: false });
    [[-5, 4, 4.5], [4, -3, 3.4], [2, 6, 2.2], [-6, -6, 2.6]].forEach(([x, y, r]) => {
      const c = new THREE.Mesh(new THREE.CircleGeometry(r, 9), mm);
      c.position.set(x, y, 0.5);
      m.add(c);
    });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#8fb0ff', fog: false, depthWrite: false, opacity: 0.5, transparent: true }));
    halo.scale.setScalar(mood.moon.size * 9);
    halo.position.copy(m.position).multiplyScalar(1.01);
    scene.add(halo);
  }
  if (mood.stars) {
    const n = 900;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.92 + 0.06;
      const th = u * Math.PI * 2, ph = Math.acos(v);
      p.set([Math.sin(ph) * Math.cos(th) * 450, Math.cos(ph) * 450, Math.sin(ph) * Math.sin(th) * 450], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, map: dot, depthWrite: false })));
  }

  const temujin = createTemujin();
  scene.add(temujin);

  const npcs = [];
  const figures = [];
  const fires = [];
  const updaters = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb23a' });
  const flameCore = new THREE.MeshBasicMaterial({ color: '#fff0b0' });
  const logMat = new THREE.MeshLambertMaterial({ color: '#3a2a1c', flatShading: true });
  const stoneMat = new THREE.MeshLambertMaterial({ color: '#6a6660', flatShading: true });

  const api = {
    steppe: true,
    temujin, heightAt, colliders, npcs, riverX,
    scene, sun, mood,
    /** put any object on the ground */
    place(obj, x, z, lift = 0, yaw = null) {
      obj.position.set(x, heightAt(x, z) + lift, z);
      if (yaw != null) obj.rotation.y = yaw;
      scene.add(obj);
      return obj;
    },
    /** a talkable figure / prop with a glow ring and a collider */
    addNpc(obj, x, z, { name, node, yaw = 0, r = 0.55, ring = '#e8c37a', solid = true, when = null } = {}) {
      api.place(obj, x, z, 0, yaw);
      if (obj.userData.homeYaw != null) obj.userData.homeYaw = yaw;
      if (obj.userData.update) figures.push(obj);
      if (solid) colliders.push({ x, z, r, kind: 'npc' });
      let glow = null;
      if (node) {
        glow = glowRing(ring);
        glow.position.set(x, heightAt(x, z) + 0.06, z);
        scene.add(glow);
        npcs.push({ obj, name, node, glow, when });
      }
      return obj;
    },
    /** standing figure that is only set dressing */
    addExtra(obj, x, z, yaw = 0, solid = true) {
      api.place(obj, x, z, 0, yaw);
      if (obj.userData.homeYaw != null) obj.userData.homeYaw = yaw;
      if (obj.userData.update) { obj.userData.noTurn = true; figures.push(obj); }
      if (solid) colliders.push({ x, z, r: 0.5, kind: 'npc' });
      return obj;
    },
    /** campfire with stones, logs, animated flames, a light and sparks */
    addFire(x, z, { size = 1, light = true, range = 16, intensity = 2.2 } = {}) {
      const g = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * size, 0), stoneMat);
        st.position.set(Math.cos(a) * 0.55 * size, 0.06, Math.sin(a) * 0.55 * size);
        st.scale.y = 0.7;
        g.add(st);
      }
      for (let i = 0; i < 4; i++) {
        const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * size, 0.07 * size, 0.8 * size, 5), logMat);
        lg.rotation.z = Math.PI / 2 - 0.5;
        lg.rotation.y = (i / 4) * Math.PI * 2;
        lg.position.y = 0.22 * size;
        g.add(lg);
      }
      const flames = [];
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry((0.2 - i * 0.025) * size, (0.7 + (i % 2) * 0.3) * size, 5), i < 2 ? flameCore : flameMat);
        f.position.set((Math.random() - 0.5) * 0.25 * size, 0.5 * size, (Math.random() - 0.5) * 0.25 * size);
        g.add(f);
        flames.push(f);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ff8a30', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(3.4 * size);
      glow.position.y = 0.6 * size;
      g.add(glow);
      let pl = null;
      if (light) {
        pl = new THREE.PointLight('#ff8a3c', intensity, range, 1.6);
        pl.position.y = 0.9 * size;
        g.add(pl);
      }
      // sparks
      const SN = 14;
      const sp = new Float32Array(SN * 3);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffc060', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false, map: dot }));
      g.add(sparks);
      const seeds = Array.from({ length: SN }, () => Math.random());
      api.place(g, x, z);
      colliders.push({ x, z, r: 0.6 * size, kind: 'fire' });
      const fire = { x, z, group: g, light: pl, base: intensity };
      fires.push(fire);
      updaters.push((dt, t) => {
        flames.forEach((f, i) => {
          f.scale.y = 0.8 + Math.sin(t * (9 + i * 2.3) + i) * 0.28;
          f.scale.x = f.scale.z = 0.9 + Math.sin(t * (7 + i) + i * 2) * 0.15;
          f.rotation.y = t * (1 + i * 0.4);
        });
        if (pl) pl.intensity = intensity * (0.82 + Math.sin(t * 11 + x) * 0.1 + Math.sin(t * 23 + z) * 0.08);
        glow.material.opacity = 0.45 + Math.sin(t * 9 + z) * 0.1;
        for (let i = 0; i < SN; i++) {
          const a = (t * (0.35 + seeds[i] * 0.4) + seeds[i]) % 1;
          sp[i * 3] = Math.sin(seeds[i] * 40 + t) * 0.25 * a * size;
          sp[i * 3 + 1] = (0.5 + a * 2.6) * size;
          sp[i * 3 + 2] = Math.cos(seeds[i] * 33 + t) * 0.25 * a * size;
        }
        sg.attributes.position.needsUpdate = true;
      });
      return fire;
    },
    /** post with a burning torch; returns {x,z,radius} for stealth checks */
    addTorch(x, z, { light = true, radius = 6.2 } = {}) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 5), logMat);
      post.position.y = 1.1;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.25, 6), logMat);
      head.position.y = 2.25;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), flameMat);
      fl.position.y = 2.6;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ff9a40', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(2.2);
      glow.position.y = 2.6;
      g.add(post, head, fl, glow);
      let pl = null;
      if (light) {
        pl = new THREE.PointLight('#ff9040', 1.6, radius * 2.2, 1.6);
        pl.position.y = 2.7;
        g.add(pl);
      }
      api.place(g, x, z);
      colliders.push({ x, z, r: 0.2, kind: 'post' });
      updaters.push((dt, t) => {
        fl.scale.y = 0.85 + Math.sin(t * 11 + x) * 0.2;
        if (pl) pl.intensity = 1.5 + Math.sin(t * 9 + x) * 0.3;
      });
      // warm circle on the ground showing the lit (dangerous) area
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 28), new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0.1, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, heightAt(x, z) + 0.05, z);
      scene.add(disc);
      return { x, z, radius, light: pl };
    },
    /** saddled horse on the user's model; rideable when set as api.mount */
    addHorse(x, z, { yaw = 0, coat = null, lod = 'lo', graze = true, solid = true } = {}) {
      const h = createHorse({ coat: coat || '#8c4a24', saddle: !coat });
      attachHorseModel(h, { lod, herd: coat ? { coat, mane: '#1c1512' } : null });
      api.place(h, x, z, 0, yaw);
      h.userData.grazing = graze;
      if (solid) colliders.push({ x, z, r: 0.9, kind: 'horse' });
      updaters.push((dt, t) => { if (!h.userData.ridden) h.userData.update(dt, t, 0, { graze: h.userData.grazing }); });
      return h;
    },
    /** tall war standard (туг) with horse-tail tuft or cloth banner */
    addBanner(x, z, { color = '#6a2030', cloth = true, h = 4.6 } = {}) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 5), logMat);
      pole.position.y = h / 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), new THREE.MeshLambertMaterial({ color: '#c9a24a' }));
      tip.position.y = h + 0.15;
      g.add(pole, tip);
      let flag = null;
      if (cloth) {
        const geo = new THREE.PlaneGeometry(1.5, 0.9, 8, 3);
        geo.translate(0.75, 0, 0);
        flag = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }));
        flag.position.y = h - 0.6;
        g.add(flag);
        const base = geo.attributes.position.array.slice();
        updaters.push((dt, t) => {
          const p = geo.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const bx = base[i * 3];
            p.setZ(i, Math.sin(bx * 3.2 - t * 4 + x) * 0.14 * bx);
            p.setY(i, base[i * 3 + 1] - bx * bx * 0.06 + Math.sin(bx * 2 - t * 3) * 0.03 * bx);
          }
          p.needsUpdate = true;
          geo.computeVertexNormals();
        });
      } else {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 7), new THREE.MeshLambertMaterial({ color: '#1c1512', flatShading: true }));
        tuft.rotation.x = Math.PI;
        tuft.position.y = h - 0.5;
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 12), new THREE.MeshLambertMaterial({ color: '#c9a24a' }));
        ringM.rotation.x = Math.PI / 2;
        ringM.position.y = h - 0.08;
        g.add(tuft, ringM);
      }
      api.place(g, x, z);
      colliders.push({ x, z, r: 0.2, kind: 'post' });
      return g;
    },
    onUpdate(fn) { updaters.push(fn); },
    update(dt, t, near, pos, moving) {
      temujin.userData.update?.(dt, t);
      steppe.update(t);
      for (const f of figures) f.userData.update(dt, t, pos);
      for (const u of updaters) u(dt, t, pos);
      questTick(dt, t, pos, moving);
      for (const r of riders) {
        r.userData.horse.userData.update(dt, t, r.userData.speed, { graze: false });
        r.userData.speed = 0;
      }
      for (const n of npcs) {
        if (!n.glow) continue;
        const on = near?.has(n.obj) && (!n.when || n.when());
        n.glow.position.set(n.obj.position.x, n.obj.position.y + 0.06, n.obj.position.z);
        n.glow.material.opacity += ((on ? 0.85 : 0) - n.glow.material.opacity) * Math.min(1, 8 * dt);
        n.glow.rotation.z += dt * 0.6;
      }
    },
  };

  // ------------------------------------------------------------------
  // gameplay helpers: quest steps, beacon, usables, riders, chasers
  // ------------------------------------------------------------------
  let ctx = null;
  const riders = [];
  const usables = [];
  api.usables = usables;
  api.torches = [];
  api.bind = (c) => { ctx = c; api.ctx = c; };
  api.use = (x, z, label, fn, { r = 2.6, when = null } = {}) => {
    const u = { x, z, r, label, when, use: fn };
    usables.push(u);
    return u;
  };

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 70, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending })
  );
  const beaconRing = glowRing('#ffe9a8');
  beaconRing.scale.setScalar(2.4);
  beacon.visible = beaconRing.visible = false;
  scene.add(beacon, beaconRing);
  api.beacon = (x, z) => {
    if (x == null) { beacon.visible = beaconRing.visible = false; return; }
    const y = Math.max(heightAt(x, z), -0.1);
    beacon.position.set(x, y + 35, z);
    beaconRing.position.set(x, y + 0.08, z);
    beaconRing.material.opacity = 0.8;
    beacon.visible = beaconRing.visible = true;
  };

  let steps = [];
  let stepIndex = -1;
  let cp = null;
  api.quest = (list) => { steps = list; };
  api.goto = (i) => {
    stepIndex = i;
    const st = steps[i];
    if (ctx) cp = { x: ctx.player.pos.x, z: ctx.player.pos.z };
    if (!st) { api.beacon(null); return; }
    if (st.cp) cp = { x: st.cp[0], z: st.cp[1] };
    if (st.at) api.beacon(st.at[0], st.at[1]); else api.beacon(null);
    st.enter?.();
  };
  api.next = () => api.goto(stepIndex + 1);
  api.is = (id) => steps[stepIndex]?.id === id;
  api.stepId = () => steps[stepIndex]?.id || null;
  api.objective = () => {
    const st = steps[stepIndex];
    if (!st) return null;
    return typeof st.text === 'function' ? st.text() : st.text;
  };
  api.fail = (msg) => {
    if (!ctx) return;
    ctx.toast(msg, 2600);
    if (cp) ctx.teleport(cp.x, cp.z);
    for (const r of [...riders, ...walkers]) {
      if (r.userData.home && r.userData.resetOnFail) { r.position.x = r.userData.home.x; r.position.z = r.userData.home.z; r.position.y = heightAt(r.position.x, r.position.z); }
    }
    steps[stepIndex]?.reset?.();
  };
  function questTick(dt, t, pos, moving) {
    if (!ctx || !pos) return;
    if (stepIndex < 0 && steps.length) api.goto(0);
    beacon.material.opacity = 0.16 + Math.sin(t * 2.4) * 0.06;
    beaconRing.rotation.z += dt * 0.8;
    if (ctx.state() !== 'explore') return;
    const st = steps[stepIndex];
    if (!st) return;
    if (st.at && st.r) {
      const d = Math.hypot(pos.x - st.at[0], pos.z - st.at[1]);
      if (d < st.r && (!st.foot || !ctx.riding()) && (!st.ride || ctx.riding())) {
        const keep = st.done?.();
        if (keep !== false && steps[stepIndex] === st) api.next();
        return;
      }
    }
    if (st.check && st.check(dt, pos, moving)) { if (steps[stepIndex] === st) api.next(); }
  }

  // anything that can be steered across the terrain
  const walkers = [];
  function steerable(obj, isRider) {
    obj.userData.home = { x: obj.position.x, z: obj.position.z };
    obj.userData.speed = 0;
    obj.userData.moveTo = (tx, tz, spd, dt, stopR = 0.4) => {
      const dx = tx - obj.position.x, dz = tz - obj.position.z;
      const d = Math.hypot(dx, dz);
      if (d < stopR) { obj.userData.walk = false; return true; }
      const stepLen = Math.min(d, spd * dt);
      obj.position.x += (dx / d) * stepLen;
      obj.position.z += (dz / d) * stepLen;
      obj.position.y = Math.max(heightAt(obj.position.x, obj.position.z), isRider ? -0.5 : -0.2);
      let dy = Math.atan2(dx, dz) - obj.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      obj.rotation.y += dy * Math.min(1, dt * 6);
      obj.userData.speed = spd;
      obj.userData.walk = true;
      obj.userData.noTurn = true;
      return false;
    };
    return obj;
  }
  /** mounted warrior: the user's horse with a seated figure */
  api.addRider = (x, z, { deel = '#3a3f58', coat = '#5a3a22', yaw = 0, model = 'temujin', shade = 1, lance = false, lod = 'lo', noRider = false } = {}) => {
    const g = new THREE.Group();
    const h = createHorse({ coat, saddle: !noRider });
    attachHorseModel(h, { lod, herd: { coat, mane: '#1c1512' } });
    g.add(h);
    let f = null;
    if (!noRider) {
      f = createFigure({ model, deel, shade, crowd: true, still: true, seated: true });
      f.userData.noTurn = true;
      f.position.y = 1.3 - f.userData.height * 0.5 - 0.01;
      f.position.z = -0.46;
      g.add(f);
    }
    if (lance) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 3.2, 5), logMat);
      l.position.set(0.34, 2.2, 0.1);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), new THREE.MeshLambertMaterial({ color: '#b8bcc4' }));
      tip.position.set(0.34, 3.95, 0.1);
      g.add(l, tip);
    }
    g.userData.horse = h;
    g.userData.figure = f;
    api.place(g, x, z, 0, yaw);
    steerable(g, true);
    riders.push(g);
    return g;
  };
  /** person on foot that can patrol */
  api.addWalker = (fig, x, z, yaw = 0) => {
    api.place(fig, x, z, 0, yaw);
    fig.userData.homeYaw = yaw;
    figures.push(fig);
    steerable(fig, false);
    walkers.push(fig);
    return fig;
  };
  /** hand torch carried by a rider / walker; lit circle counts for stealth */
  api.carryTorch = (obj, radius = 5.5, y = 2.5) => {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), flameMat);
    fl.position.set(0.4, y, 0.2);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ff9a40', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.6);
    glow.position.copy(fl.position);
    obj.add(fl, glow);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 26), new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0.12, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);
    const tr = { x: obj.position.x, z: obj.position.z, radius, light: null };
    api.torches.push(tr);
    updaters.push((dt, t) => {
      tr.x = obj.position.x; tr.z = obj.position.z;
      disc.position.set(tr.x, Math.max(heightAt(tr.x, tr.z), -0.05) + 0.07, tr.z);
      fl.scale.y = 0.85 + Math.sin(t * 12 + tr.x) * 0.2;
    });
    return tr;
  };
  /** patrol a closed loop of points */
  api.patrol = (obj, pts, speed, active = null) => {
    let i = 0;
    updaters.push((dt) => {
      if (active && !active()) return;
      if (obj.userData.moveTo(pts[i][0], pts[i][1], speed, dt, 0.8)) i = (i + 1) % pts.length;
    });
  };
  /** hunters that ride the player down */
  api.chase = (list, { speed = 6.6, catchR = 2.3, active, onCatch, keepOut = null } = {}) => {
    list.forEach((r) => { r.userData.resetOnFail = true; });
    updaters.push((dt, t, pos) => {
      if (!ctx || !pos || ctx.state() !== 'explore' || (active && !active())) return;
      list.forEach((r, i) => {
        let tx = pos.x + Math.sin(i * 2.4) * 2.2, tz = pos.z + Math.cos(i * 2.4) * 2.2;
        if (keepOut) {
          const dx = tx - keepOut.x, dz = tz - keepOut.z, d = Math.hypot(dx, dz);
          if (d < keepOut.r) {
            // circle the edge instead of entering
            const a = Math.atan2(r.position.z - keepOut.z, r.position.x - keepOut.x) + 0.35 * (i % 2 ? 1 : -1);
            tx = keepOut.x + Math.cos(a) * (keepOut.r + 4); tz = keepOut.z + Math.sin(a) * (keepOut.r + 4);
          }
        }
        r.userData.moveTo(tx, tz, speed * (0.92 + (i % 3) * 0.05), dt, 0.5);
        if (Math.hypot(r.position.x - pos.x, r.position.z - pos.z) < catchR) onCatch?.(r);
      });
    });
  };
  /** companions that keep formation behind the player */
  api.follow = (list, { speed = 8.6, spread = 3.2, active = null } = {}) => {
    updaters.push((dt, t, pos) => {
      if (!pos || (active && !active())) return;
      const yaw = temujin.rotation.y;
      const bx = -Math.sin(yaw), bz = -Math.cos(yaw);
      list.forEach((r, i) => {
        const row = 1 + Math.floor(i / 3), colI = (i % 3) - 1;
        const tx = pos.x + bx * row * spread + bz * colI * spread * 0.9;
        const tz = pos.z + bz * row * spread - bx * colI * spread * 0.9;
        const d = Math.hypot(tx - r.position.x, tz - r.position.z);
        if (d > 1.2) r.userData.moveTo(tx, tz, Math.min(speed, 1.5 + d * 1.6), dt, 0.6);
      });
    });
  };
  /** the wooden cangue (буулга) on Temujin's neck */
  let cangue = null;
  api.setCangue = (on) => {
    if (on && !cangue) {
      cangue = new THREE.Group();
      const wood = new THREE.MeshLambertMaterial({ color: '#8a6a40', flatShading: true });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.42), wood);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.08), new THREE.MeshLambertMaterial({ color: '#5a4226', flatShading: true }));
      bar.position.z = 0.2;
      const bar2 = bar.clone(); bar2.position.z = -0.2;
      cangue.add(board, bar, bar2);
      cangue.position.y = 1.4;
      temujin.add(cangue);
    }
    if (cangue) cangue.visible = on;
  };
  /** standing person from the sculpt library */
  api.person = (o = {}) => createFigure(o);

  return api;
}
