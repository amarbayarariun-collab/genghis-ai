// Тайчууд олзлолт — §79–§87 beats (capture / cangue night / river / Sorkan ger).
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';
import {
  skyDome, person, makeGer, horse, glowRing, scatterGrass, scatterRocks,
  terrainMesh, campfire, moonDisc, flat,
} from '../world-kit.js';

function banner(x, z, heightAt, color = '#8a1a22') {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 5.2, 6), flat('#3a2818'));
  pole.position.y = 2.6;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), flat(color, { side: THREE.DoubleSide }));
  cloth.position.set(0.55, 4.2, 0);
  g.add(pole, cloth);
  g.position.set(x, heightAt(x, z), z);
  return g;
}

/** 1 — Capture march: Targutai leads bound Temüjin at sunset. */
export function buildTaichiudCapture(scene) {
  scene.background = new THREE.Color('#0c1428');
  scene.add(skyDome({ top: '#0c1428', mid: '#24365c', horizon: '#c45a28', bottom: '#120c0a' }));
  scene.fog = new THREE.FogExp2('#1a140e', 0.012);
  scene.add(new THREE.HemisphereLight('#6a7898', '#1a100c', 0.32));
  const sun = new THREE.DirectionalLight('#ff8a3a', 0.85);
  sun.position.set(40, 8, -20);
  scene.add(sun);

  const heightAt = (x, z) =>
    Math.sin(x * 0.03) * Math.cos(z * 0.028) * 2.2 + Math.sin(x * 0.08) * 0.6;
  scene.add(terrainMesh(heightAt, 260, 80));
  scatterGrass(scene, heightAt, 2200, 60);
  scatterRocks(scene, heightAt, 35, 55);

  // Distant camp gers
  [[22, -28], [28, -32], [18, -34]].forEach(([x, z], i) => {
    const g = makeGer(0.85 + i * 0.05);
    g.position.set(x, heightAt(x, z), z);
    scene.add(g);
  });

  // Bound escort path: Targutai on horse + riders
  const colliders = [];
  const targutai = person({ deel: '#4a2a48', hat: '#2a1810', fur: '#c8b090', tall: 1.08 });
  const th = horse('#4a3028');
  th.position.set(2.2, heightAt(2.2, -2), -2);
  th.rotation.y = Math.PI * 0.5;
  targutai.position.set(2.2, heightAt(2.2, -2) + 1.15, -2);
  targutai.rotation.y = Math.PI * 0.5;
  scene.add(th, targutai);
  colliders.push({ x: 2.2, z: -2, r: 1.2 });

  const riders = [];
  for (let i = 0; i < 4; i++) {
    const hx = -4 - i * 2.4;
    const hz = 1 + (i % 2) * 1.2;
    const h = horse(i % 2 ? '#5a4030' : '#3a2820');
    h.position.set(hx, heightAt(hx, hz), hz);
    h.rotation.y = Math.PI * 0.55;
    const r = person({ deel: '#5a3428', hat: '#2a1810' });
    r.position.set(hx, heightAt(hx, hz) + 1.1, hz);
    r.rotation.y = Math.PI * 0.55;
    scene.add(h, r);
    scene.add(banner(hx - 0.3, hz - 0.8, heightAt));
    riders.push(r);
    colliders.push({ x: hx, z: hz, r: 1.0 });
  }

  // Rope visual on ground near start
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6), flat('#c8b090'));
  rope.rotation.z = Math.PI / 2;
  rope.position.set(0.4, heightAt(0.4, 4) + 0.08, 4);
  scene.add(rope);

  const temujin = createTemujin();
  scene.add(temujin);
  const tGlow = glowRing('#e8c37a');
  targutai.add(tGlow);

  const npcs = [
    { obj: targutai, name: 'Таргутай-Хирилтугтай', node: 'taichiud_capture', glow: tGlow },
  ];

  return {
    temujin,
    colliders,
    heightAt,
    npcs,
    startPos: new THREE.Vector3(0, 0, 8),
    chapterLabel: 'Ia бүлэг · Тайчууд олзлолт',
    chapterId: 'taichiud',
    stealth: null,
    update(dt, t, near, _pos, moving) {
      temujin.userData.setMoving?.(moving);
      temujin.userData.update?.(dt, t);
      for (const n of npcs) {
        if (!n.glow) continue;
        const on = near?.has(n.obj);
        n.glow.material.opacity += ((on ? 0.85 : 0) - n.glow.material.opacity) * Math.min(1, 8 * dt);
      }
    },
  };
}

/** 2 — Cangue night stealth escape. */
export function buildTaichiudEscape(scene) {
  scene.background = new THREE.Color('#050814');
  scene.add(skyDome({ top: '#050814', mid: '#10182c', horizon: '#e08a48', bottom: '#080a10' }));
  scene.fog = new THREE.FogExp2('#101820', 0.015);
  scene.add(new THREE.HemisphereLight('#7a8cb0', '#140c08', 0.28));
  const moonLight = new THREE.DirectionalLight('#c5d4f2', 0.62);
  moonLight.position.set(-50, 60, -30);
  scene.add(moonLight);
  moonDisc(scene, [-55, 65, -35]);

  const heightAt = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.035) * 1.4;
  scene.add(terrainMesh(heightAt, 200, 70, (x, y, z) => {
    const c = new THREE.Color('#3a4a32').lerp(new THREE.Color('#2a3830'), Math.random() * 0.4);
    return c;
  }));
  scatterGrass(scene, heightAt, 1600, 48, '#4a6a38');
  scatterRocks(scene, heightAt, 28, 45);

  const colliders = [];
  const torches = [];

  // Night camp
  const gerSpots = [[-8, -6], [-2, -10], [6, -8], [10, -14]];
  gerSpots.forEach(([x, z]) => {
    const g = makeGer(0.95, '#7a1a22');
    g.position.set(x, heightAt(x, z), z);
    scene.add(g);
    colliders.push({ x, z, r: 3.1 });
    const fire = campfire(scene, x + 3.5, z + 2.2, heightAt, true);
    torches.push(fire);
  });

  // Extra torch posts (patrol)
  [[0, 2], [-5, 4], [4, 0], [-2, -2]].forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), flat('#3a2818'));
    post.position.set(x, heightAt(x, z) + 1.1, z);
    scene.add(post);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.45, 5),
      new THREE.MeshBasicMaterial({ color: '#ffaa44' })
    );
    flame.position.set(x, heightAt(x, z) + 2.3, z);
    scene.add(flame);
    const pl = new THREE.PointLight('#ff8a40', 1.4, 11, 2);
    pl.position.set(x, heightAt(x, z) + 2.4, z);
    scene.add(pl);
    torches.push({ x, z, y: heightAt(x, z), light: pl, ember: flame, radius: 6.2 });
  });

  // Cangue on ground (буулга)
  const cangue = new THREE.Group();
  const plank = flat('#6a5030');
  const a = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.45), plank);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.45), plank);
  b.position.y = 0.22;
  const hole = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 12), flat('#4a3820'));
  hole.rotation.x = Math.PI / 2;
  hole.position.y = 0.11;
  cangue.add(a, b, hole);
  cangue.position.set(-1.5, heightAt(-1.5, 5) + 0.12, 5);
  cangue.rotation.y = 0.4;
  scene.add(cangue);

  // Sleeping / drowsy guard
  const guard = person({ deel: '#4a3428', hat: '#2a1810' });
  guard.position.set(1.5, heightAt(1.5, 1.5), 1.5);
  guard.rotation.y = -0.8;
  scene.add(guard);
  colliders.push({ x: 1.5, z: 1.5, r: 0.7 });
  const gGlow = glowRing('#e8c37a');
  guard.add(gGlow);

  // Escape thicket goal
  const thicket = new THREE.Group();
  const bush = flat('#2a4a28');
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.6, 0), bush);
    m.position.set((Math.random() - 0.5) * 5, 0.6, (Math.random() - 0.5) * 4);
    m.scale.y = 1.3 + Math.random();
    thicket.add(m);
  }
  thicket.position.set(14, heightAt(14, 8), 8);
  scene.add(thicket);
  const escapeMarker = { obj: thicket, name: 'Шугуй руу зугтах', node: 'taichiud_escape_run', glow: null };

  const guardNpc = { obj: guard, name: 'Харуултай', node: 'taichiud_cangue_hit', glow: gGlow };

  const temujin = createTemujin();
  scene.add(temujin);

  return {
    temujin,
    colliders,
    heightAt,
    npcs: [guardNpc, escapeMarker],
    startPos: new THREE.Vector3(-3, 0, 6),
    chapterLabel: 'Ia · Буулга · Улаан тойрог шөнө',
    chapterId: 'taichiud',
    stealth: { torches, spotted: false },
    update(dt, t, near, pos, moving) {
      temujin.userData.setMoving?.(moving);
      temujin.userData.update?.(dt, t);
      // Flicker torches
      for (const tr of torches) {
        if (tr.light) tr.light.intensity = 1.7 + Math.sin(t * 9 + tr.x) * 0.4;
        if (tr.ember) tr.ember.scale.y = 0.9 + Math.sin(t * 11 + tr.z) * 0.15;
      }
      if (guardNpc.glow) {
        const on = near?.has(guard.obj);
        guardNpc.glow.material.opacity += ((on ? 0.85 : 0) - guardNpc.glow.material.opacity) * Math.min(1, 8 * dt);
      }
    },
  };
}

/** 3 — Onon reeds dawn; Sorkan-Shira finds Temüjin. */
export function buildTaichiudRiver(scene) {
  scene.background = new THREE.Color('#0a1428');
  scene.add(skyDome({ top: '#0a1428', mid: '#1a3050', horizon: '#8a5a38', bottom: '#101810' }));
  scene.fog = new THREE.FogExp2('#16202c', 0.013);
  scene.add(new THREE.HemisphereLight('#7a90b0', '#1a140e', 0.38));
  const sun = new THREE.DirectionalLight('#c8d4ee', 0.55);
  sun.position.set(-30, 48, 20);
  scene.add(sun);

  const riverZ = (x) => Math.sin(x * 0.05) * 4;
  const heightAt = (x, z) => {
    const d = Math.abs(z - riverZ(x));
    let h = Math.sin(x * 0.04) * 1.2;
    h *= 1 - THREE.MathUtils.smoothstep(d, 2, 8) * 0 + (d < 6 ? -0.9 * (1 - d / 6) : 0);
    return h;
  };
  scene.add(terrainMesh(heightAt, 200, 70, (x, y, z) => {
    const d = Math.abs(z - riverZ(x));
    if (d < 5) return new THREE.Color('#5a7a48').lerp(new THREE.Color('#4a6a40'), d / 5);
    return new THREE.Color('#8aaa4a').lerp(new THREE.Color('#c4a84a'), 0.35);
  }));

  // Water strip
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 10),
    new THREE.MeshLambertMaterial({ color: '#7eb8c8', transparent: true, opacity: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.55, 0);
  scene.add(water);

  // Reeds (instanced)
  const reedGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.8, 4);
  const reeds = new THREE.InstancedMesh(reedGeo, flat('#4a6a38'), 900);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < 900; i++) {
    const x = (Math.random() - 0.5) * 40;
    const z = riverZ(x) + (Math.random() - 0.5) * 6;
    dummy.position.set(x, heightAt(x, z) + 0.85, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.7 + Math.random() * 0.8);
    dummy.updateMatrix();
    reeds.setMatrixAt(n++, dummy.matrix);
  }
  reeds.count = n;
  scene.add(reeds);
  scatterGrass(scene, heightAt, 800, 50, '#9ab04a');

  const sorkan = person({ deel: '#5a4630', hat: '#3a2818', fur: '#d8c8a8', tall: 1.05 });
  const sh = horse('#6a5040');
  sh.position.set(6, heightAt(6, 4), 4);
  sh.rotation.y = -0.6;
  sorkan.position.set(6, heightAt(6, 4) + 1.12, 4);
  sorkan.rotation.y = -0.6;
  scene.add(sh, sorkan);
  const sGlow = glowRing('#e8c37a');
  sorkan.add(sGlow);

  const hideSpot = new THREE.Group();
  hideSpot.position.set(-2, heightAt(-2, -1), -1);
  scene.add(hideSpot);

  const temujin = createTemujin();
  scene.add(temujin);
  const npcs = [{ obj: sorkan, name: 'Сорхан-Ширатай', node: 'taichiud_river', glow: sGlow }];

  return {
    temujin,
    colliders: [{ x: 6, z: 4, r: 1.1 }],
    heightAt,
    npcs,
    startPos: new THREE.Vector3(-3, 0, -2),
    chapterLabel: 'Ia · Онон · Зэгс',
    chapterId: 'taichiud',
    stealth: null,
    update(dt, t, near, _pos, moving) {
      temujin.userData.setMoving?.(moving);
      temujin.userData.update?.(dt, t);
      scene.fog.density = 0.012 + Math.sin(t * 0.4) * 0.0012;
      for (const n of npcs) {
        if (!n.glow) continue;
        const on = near?.has(n.obj);
        n.glow.material.opacity += ((on ? 0.85 : 0) - n.glow.material.opacity) * Math.min(1, 8 * dt);
      }
    },
  };
}

/** 4 — Inside Sorkan-Shira ger at night (wool cart beat). */
export function buildTaichiudGer(scene) {
  // Interior-ish: dark outside dome + lit ger volume
  scene.background = new THREE.Color('#050810');
  scene.add(skyDome({ top: '#050810', mid: '#0a1020', horizon: '#121828', bottom: '#08060a' }));
  scene.fog = new THREE.FogExp2('#0a0c12', 0.04);
  scene.add(new THREE.HemisphereLight('#332818', '#050408', 0.25));
  moonDisc(scene, [40, 50, -20]);

  const heightAt = () => 0;
  // Floor
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshLambertMaterial({ color: '#5a4030', flatShading: true })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ger interior walls (inverted cylinder feel via outer shell)
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9.1, 4.2, 24, 1, true),
    new THREE.MeshLambertMaterial({ color: '#d8cfc0', flatShading: true, side: THREE.BackSide })
  );
  wall.position.y = 2.1;
  scene.add(wall);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9.4, 3.2, 24, 1, true),
    new THREE.MeshLambertMaterial({ color: '#c8bfb0', flatShading: true, side: THREE.BackSide })
  );
  roof.position.y = 5.4;
  scene.add(roof);

  const fire = campfire(scene, 0, 0, heightAt, true);
  if (fire.light) {
    fire.light.intensity = 2.4;
    fire.light.distance = 16;
  }

  // Wool cart / pile to hide in
  const cart = new THREE.Group();
  const wood = flat('#6a4a28');
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.5), wood);
  box.position.y = 0.7;
  const wool = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.35), flat('#e8e0d0'));
  wool.position.y = 1.45;
  cart.add(box, wool);
  cart.position.set(-3.5, 0, 2.5);
  scene.add(cart);
  const cartGlow = glowRing('#e8c37a');
  cart.add(cartGlow);

  const sorkan = person({ deel: '#5a4630', hat: '#3a2818', tall: 1.05 });
  sorkan.position.set(2.2, 0, -1.5);
  sorkan.rotation.y = -0.9;
  scene.add(sorkan);
  const sGlow = glowRing('#e8c37a');
  sorkan.add(sGlow);

  // Chimbai / Chilaun
  const chimbai = person({ deel: '#6a2a28', hat: '#2a1810', tall: 0.95 });
  chimbai.position.set(1.5, 0, 2.8);
  scene.add(chimbai);
  const chilaun = person({ deel: '#4a3a28', hat: '#2a1810', tall: 0.92 });
  chilaun.position.set(2.8, 0, 2.2);
  scene.add(chilaun);

  // Khadaan
  const khadaan = person({ deel: '#7a4a38', hat: '#4a3020', fur: '#d0c0a0', tall: 0.98 });
  khadaan.position.set(-1.2, 0, -3.2);
  scene.add(khadaan);
  const kGlow = glowRing('#e8c37a');
  khadaan.add(kGlow);

  // Food bowl prop
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.15, 10), flat('#8a6a40'));
  bowl.position.set(-0.8, 0.2, -2.6);
  scene.add(bowl);

  const temujin = createTemujin();
  scene.add(temujin);

  const npcs = [
    { obj: sorkan, name: 'Сорхан-Ширатай', node: 'taichiud_ger', glow: sGlow },
    { obj: cart, name: 'Ноосон тэрэгт нуугдах', node: 'taichiud_wool', glow: cartGlow },
    { obj: khadaan, name: 'Хадаантай', node: 'taichiud_khadaan', glow: kGlow },
  ];

  return {
    temujin,
    colliders: [
      { x: -3.5, z: 2.5, r: 1.4 },
      { x: 2.2, z: -1.5, r: 0.7 },
      { x: 0, z: 0, r: 0.6 },
    ],
    heightAt,
    npcs,
    startPos: new THREE.Vector3(0, 0, 4),
    chapterLabel: 'Ia · Сорхан-Ширагийн гэр',
    chapterId: 'taichiud',
    stealth: null,
    update(dt, t, near, _pos, moving) {
      temujin.userData.setMoving?.(moving);
      temujin.userData.update?.(dt, t);
      if (fire.light) fire.light.intensity = 2.1 + Math.sin(t * 8) * 0.35;
      for (const n of npcs) {
        if (!n.glow) continue;
        const on = near?.has(n.obj);
        n.glow.material.opacity += ((on ? 0.85 : 0) - n.glow.material.opacity) * Math.min(1, 8 * dt);
      }
    },
  };
}
