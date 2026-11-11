/** Жамухагаас шөнө салгалт (§118). Ride to three households and bring them off his camp. */
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';
import { createHorse } from '../characters/horse.js';
import { skyDome, makeGer, person } from '../world-kit.js';

export function buildJamukhaWorld(scene) {
  scene.add(skyDome({ top: '#243456', horizon: '#e0a070', bottom: '#3a3424' }, 140));
  scene.fog = new THREE.Fog('#4a3428', 48, 150);
  scene.add(new THREE.HemisphereLight('#d5e2f4', '#4a5a30', 0.95));
  const moon = new THREE.DirectionalLight('#fff2dc', 1.35);
  moon.position.set(-24, 40, 12);
  scene.add(moon);

  const heightAt = (x, z) => Math.sin(x * 0.045) * Math.cos(z * 0.04) * 0.6;
  const geo = new THREE.PlaneGeometry(140, 140, 20, 20);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#6d8440', flatShading: true })));

  const jamukha = person({ deel: '#2a241c', skin: '#c48a5e' });
  jamukha.position.set(-4.2, heightAt(-4.2, 8), 8);
  jamukha.rotation.y = 0.6;
  scene.add(jamukha);

  const temujin = createTemujin();
  temujin.position.set(0, heightAt(0, 12), 12);
  scene.add(temujin);

  const mount = createHorse({ coat: '#4a3428', saddle: true });
  mount.position.set(1.6, heightAt(1.6, 10.2), 10.2);
  mount.rotation.y = 0.4;
  mount.userData.ridden = false;
  scene.add(mount);

  const rally = new THREE.Vector3(0, 0, 26);
  const spots = [[16, -2], [-14, 6], [9, 16]];
  const felt = makeGer(0.38);
  const households = spots.map(([x, z]) => {
    const ger = felt.clone(true);
    ger.position.set(x, heightAt(x, z), z);
    scene.add(ger);
    const fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.42, 6),
      new THREE.MeshBasicMaterial({ color: '#ff7030' })
    );
    fire.position.set(x + 1.1, heightAt(x, z) + 0.2, z + 0.4);
    scene.add(fire);
    return { ger, fire, home: false };
  });

  const wood = new THREE.MeshLambertMaterial({ color: '#6a4428', flatShading: true });
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.05, 5);
  for (const x of [-1.1, 1.1]) {
    const post = new THREE.Mesh(postGeo, wood);
    const z = rally.z;
    post.position.set(x, heightAt(x, z) + 0.42, z);
    scene.add(post);
  }

  let brought = 0;
  let done = false;
  let line = 'Мордоод айлд ойрт · 0/3';

  function update(dt, t, _near, playerPos) {
    const mounted = !!mount.userData.ridden;
    if (!mounted) mount.userData.update?.(dt, t, 0, { graze: true });
    const stepDt = Math.min(dt || 0, 0.05);
    let home = 0;
    for (const h of households) {
      const dx = h.ger.position.x - rally.x;
      const dz = h.ger.position.z - rally.z;
      if (Math.hypot(dx, dz) < 3.2) {
        h.home = true;
        home += 1;
        continue;
      }
      const nearRider = mounted && playerPos
        && Math.hypot(playerPos.x - h.ger.position.x, playerPos.z - h.ger.position.z) < 7;
      if (nearRider) h.home = true;
      if (!h.home) continue;
      const step = new THREE.Vector3(rally.x - h.ger.position.x, 0, rally.z - h.ger.position.z);
      if (step.lengthSq() < 1e-4) continue;
      step.normalize().multiplyScalar(3.4 * stepDt);
      h.ger.position.x += step.x;
      h.ger.position.z += step.z;
      h.ger.position.y = heightAt(h.ger.position.x, h.ger.position.z);
      h.fire.position.x = h.ger.position.x + 1.1;
      h.fire.position.z = h.ger.position.z + 0.4;
      h.fire.position.y = h.ger.position.y + 0.2;
    }
    brought = home;
    if (!done && home === households.length) {
      done = true;
      line = 'Гурван айл дагав. Жамухагаас холдов.';
    } else if (!done) {
      line = mounted ? `Гурван айлыг ав · ${home}/3` : `Мордоод айлд ойрт · ${home}/3`;
    }
  }

  return {
    temujin,
    jamukha,
    mount,
    night: true,
    steppe: true,
    colliders: [{ x: -4.2, z: 8, r: 0.7 }],
    heightAt,
    update,
    startPos: new THREE.Vector3(0, 0, 12),
    startYaw: 0.4,
    chapterId: 'jamukha',
    chapterLabel: 'IV бүлэг · Жамухатай зөрчил',
    objective: () => line,
    taskLine: () => line,
    taskStatus: () => ({ brought, done, line }),
    blurb: () => (done
      ? 'Жамуха: Шөнө салж оджээ.'
      : 'Жамуха: Хамт бууя гэж байна. Мордоод айлаа ав.'),
    intro: 'jamukha_intro',
    npcs: [{ obj: jamukha, name: 'Жамухатай', node: 'jamukha_line' }],
    aerialView: {
      eye: new THREE.Vector3(6, 14, 22),
      look: new THREE.Vector3(2, 1, 8),
      fov: 46,
    },
  };
}
