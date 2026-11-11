/** Найман адуу (§90). Ride after the stolen horses and bring three of them back. */
import * as THREE from 'three';
import { createTemujin } from '../characters/temujin.js';
import { horse, person } from '../world-kit.js';

export function buildHorsesWorld(scene) {
  const skyGeo = new THREE.SphereGeometry(280, 20, 12);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#6a94b8') },
      horizon: { value: new THREE.Color('#f3ddb0') },
      bottom: { value: new THREE.Color('#7d9a4e') },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top, horizon, bottom;
      void main(){
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.6));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
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
  const hitch = new THREE.Group();
  hitch.position.set(0, heightAt(0, 4), 4);
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), wood);
  postL.position.set(0, 0.7, -1.2);
  const postR = postL.clone();
  postR.position.z = 1.2;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 2.6), wood);
  rail.position.y = 1.15;
  hitch.add(postL, postR, rail);
  scene.add(hitch);

  const boorchi = person({ deel: '#5a4a32', hat: '#3a2a1c', fur: '#cbb896' });
  boorchi.position.set(-1.6, heightAt(-1.6, 4), 4);
  boorchi.rotation.y = 0.4;
  scene.add(boorchi);

  const temujin = createTemujin();
  temujin.position.set(0, heightAt(0, 12), 12);
  scene.add(temujin);

  const spots = [[16, -2], [20, 1], [18, 4]];
  const herd = spots.map(([x, z], i) => {
    const h = horse(i === 1 ? '#c4a06a' : '#5c3a28');
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
    temujin.userData.update?.(dt, t);
    const mounted = temujin.visible === false;
    let home = 0;
    herd.forEach((h) => {
      const hx = h.position.x;
      const hz = h.position.z;
      if (Math.hypot(hx - hitchAt.x, hz - hitchAt.z) < 2.6) {
        home += 1;
        h.userData.step?.(dt, 0);
        return;
      }
      const nearRider = mounted && playerPos && Math.hypot(playerPos.x - hx, playerPos.z - hz) < 8;
      if (nearRider) claimed.add(h);
      if (!claimed.has(h)) {
        h.userData.step?.(dt, 0);
        return;
      }
      const step = new THREE.Vector3(hitchAt.x - hx, 0, hitchAt.z - hz);
      if (step.lengthSq() > 1e-4) {
        step.normalize().multiplyScalar(3.6 * Math.min(dt || 0, 0.05));
        h.position.x += step.x;
        h.position.z += step.z;
        h.position.y = heightAt(h.position.x, h.position.z);
        // The horse faces +X. Point that axis toward the hitch.
        h.rotation.y = Math.atan2(-step.z, step.x);
      }
      h.userData.step?.(dt, 3.6);
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
    colliders: [{ x: -1.6, z: 4, r: 0.7 }],
    heightAt,
    update,
    startPos: new THREE.Vector3(0, 0, 12),
    chapterId: 'horses',
    chapterLabel: 'Найман адуу',
    taskLine: () => line,
    herdStatus: () => ({ brought, done, line }),
    blurb: () => (done
      ? 'Боорчи: Одоо буцаж болно.'
      : 'Боорчи: Морь чинь алга. Хамт нэхье.'),
    npcs: [{ obj: boorchi, name: 'Боорчитой', node: 'horses_line' }],
    aerialView: {
      eye: new THREE.Vector3(8, 16, 24),
      look: new THREE.Vector3(6, 1, 2),
      fov: 46,
    },
  };
}
