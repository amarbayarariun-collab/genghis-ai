/** Жамухагаас шөнө салгалт (§118). Ride to three households and bring them off his camp. */
import * as THREE from 'three';
import { makeGer, person } from '../world-kit.js';

export function buildJamukhaWorld(scene) {
  const skyGeo = new THREE.SphereGeometry(140, 16, 10);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#243456') },
      horizon: { value: new THREE.Color('#e0a070') },
      bottom: { value: new THREE.Color('#3a3424') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.45)) : mix(horizon, bottom, pow(-h, 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
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

  const temujin = person({ deel: '#9a1e24' });
  temujin.position.set(0, heightAt(0, 12), 12);
  scene.add(temujin);

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

  function update(dt, _t, _near, playerPos) {
    const mounted = temujin.visible === false;
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
    colliders: [{ x: -4.2, z: 8, r: 0.7 }],
    heightAt,
    update,
    startPos: new THREE.Vector3(0, 0, 12),
    chapterId: 'jamukha',
    chapterLabel: 'Жамухатай зөрчил',
    taskLine: () => line,
    taskStatus: () => ({
      brought,
      done,
      line,
      spots,
      rally: [rally.x, rally.z],
    }),
    blurb: () => (done
      ? 'Жамуха: Шөнө салж оджээ.'
      : 'Жамуха: Хамт бууя гэж байна. Мордоод айлаа ав.'),
    npcs: [{ obj: jamukha, name: 'Жамухатай', node: 'jamukha_line' }],
    aerialView: {
      eye: new THREE.Vector3(6, 14, 22),
      look: new THREE.Vector3(2, 1, 8),
      fov: 46,
    },
  };
}
