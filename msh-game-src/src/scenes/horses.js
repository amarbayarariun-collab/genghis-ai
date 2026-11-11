/** Найман адуу (§90). Ride after three of the stolen horses and bring them to the hitch. */
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';
import { createHorse } from '../characters/horse.js';
import { skyDome, person } from '../world-kit.js';

export function buildHorsesWorld(scene) {
  scene.add(skyDome({ top: '#6a94b8', horizon: '#f3ddb0', bottom: '#7d9a4e' }, 280));
  scene.fog = new THREE.Fog('#d5c7a4', 48, 170);
  scene.add(new THREE.HemisphereLight('#fff2d8', '#4a5a32', 0.85));
  const sun = new THREE.DirectionalLight('#fff6e4', 1.7);
  sun.position.set(30, 48, 16);
  scene.add(sun);

  const heightAt = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.05) * 0.8;
  const geo = new THREE.PlaneGeometry(180, 180, 36, 36);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  scene.add(new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ color: '#7f9a48', flatShading: true })));

  const wood = new THREE.MeshLambertMaterial({ color: '#6a4428', flatShading: true });
  const postH = 1.15;
  const sink = 0.16;
  const postAt = (x, z) => {
    const ground = heightAt(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, postH, 6), wood);
    post.position.set(x, ground - sink + postH / 2, z);
    scene.add(post);
    return ground - sink + postH;
  };
  const topL = postAt(-1.15, 4);
  const topR = postAt(1.15, 4);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.1, 0.12), wood);
  rail.position.set(0, Math.min(topL, topR) - 0.02, 4);
  scene.add(rail);

  const boorchi = person({ deel: '#5a4a32', hat: '#3a2a1c', fur: '#cbb896' });
  boorchi.position.set(-2.6, heightAt(-2.6, 4), 4);
  boorchi.rotation.y = 0.4;
  scene.add(boorchi);

  const temujin = createTemujin();
  temujin.position.set(0, heightAt(0, 12), 12);
  scene.add(temujin);

  const mount = createHorse({ coat: '#b08a52', saddle: true });
  mount.position.set(1.6, heightAt(1.6, 10.2), 10.2);
  mount.rotation.y = Math.atan2(14, -6);
  mount.userData.ridden = false;
  scene.add(mount);

  const spots = [[16, -2], [20, 1], [18, 4]];
  const herd = spots.map(([x, z], i) => {
    const h = createHorse({ coat: i === 1 ? '#c4a06a' : '#5c3a28', saddle: false });
    h.position.set(x, heightAt(x, z), z);
    h.rotation.y = Math.PI;
    scene.add(h);
    return h;
  });
  const hitchAt = new THREE.Vector3(0, 0, 4);
  const claimed = new Set();
  let brought = 0;
  let done = false;
  let line = 'Найман адууг нэх · 0/3';

  function update(dt, t, _near, playerPos) {
    const mounted = !!mount.userData.ridden;
    if (!mounted) mount.userData.update?.(dt, t, 0, { graze: true });
    let home = 0;
    herd.forEach((h) => {
      const hx = h.position.x;
      const hz = h.position.z;
      if (Math.hypot(hx - hitchAt.x, hz - hitchAt.z) < 2.6) {
        home += 1;
        h.userData.update?.(dt, t, 0, { graze: true });
        return;
      }
      const nearRider = mounted && playerPos && Math.hypot(playerPos.x - hx, playerPos.z - hz) < 8;
      if (nearRider) claimed.add(h);
      if (!claimed.has(h)) {
        h.userData.update?.(dt, t, 0, { graze: true });
        return;
      }
      const step = new THREE.Vector3(hitchAt.x - hx, 0, hitchAt.z - hz);
      if (step.lengthSq() > 1e-4) {
        step.normalize().multiplyScalar(3.6 * Math.min(dt || 0, 0.05));
        h.position.x += step.x;
        h.position.z += step.z;
        h.position.y = heightAt(h.position.x, h.position.z);
        h.rotation.y = Math.atan2(step.x, step.z);
      }
      h.userData.update?.(dt, t, 3.6);
    });
    brought = home;
    if (!done && home === herd.length) {
      done = true;
      line = 'Найман адуу буцлаа. Боорчи хамт ирэв.';
    } else if (!done) {
      line = `Найман адууг нэх · ${home}/3`;
    }
  }

  return {
    temujin,
    boorchi,
    mount,
    colliders: [{ x: -2.6, z: 4, r: 0.7 }],
    heightAt,
    update,
    startPos: new THREE.Vector3(0, 0, 12),
    startYaw: Math.atan2(14, -6),
    steppe: true,
    chapterId: 'horses',
    chapterLabel: 'II бүлэг · Найман адуу',
    objective: () => line,
    taskLine: () => line,
    herdStatus: () => ({ brought, done, line }),
    blurb: () => (done
      ? 'Боорчи: Одоо буцаж болно.'
      : 'Боорчи: Морь чинь алга. Хамт нэхье.'),
    intro: 'horses_intro',
    npcs: [{ obj: boorchi, name: 'Боорчитой', node: 'horses_line' }],
    aerialView: {
      eye: new THREE.Vector3(8, 16, 24),
      look: new THREE.Vector3(6, 1, 2),
      fov: 46,
    },
  };
}
