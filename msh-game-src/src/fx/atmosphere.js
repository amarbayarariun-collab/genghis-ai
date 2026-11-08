// Atmosphere: drifting sunlit dust motes around the player and soft additive
// god-ray shafts slanting from the low sun. Original implementation.
import * as THREE from 'three';
function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function shaftTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(255,220,160,0)'); h.addColorStop(0.5, 'rgba(255,220,160,1)'); h.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0.9)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}
export function createAtmosphere(scene, sunDir = new THREE.Vector3(-0.3, 0.25, 1)) {
  const N = 260, R = 18;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 2 * R; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * R;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({
    map: softTex(), size: 0.12, transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending, color: '#ffe0a8',
  }));
  motes.frustumCulled = false; scene.add(motes);

  const shafts = new THREE.Group(); const sm = new THREE.MeshBasicMaterial({
    map: shaftTex(), transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6 + Math.random() * 6, 70), sm);
    m.position.set((i - 3) * 9 + Math.random() * 4, 22, -30 - Math.random() * 20);
    m.rotation.z = 0.35 + Math.random() * 0.1; m.userData.ph = Math.random() * 6;
    shafts.add(m);
  }
  scene.add(shafts);
  const center = new THREE.Vector3();
  return {
    update(dt, t, player, camera) {
      if (player) center.copy(player);
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        let x = a[i * 3] + dt * (0.6 + Math.sin(t * 0.3 + seed[i]) * 0.3), y = a[i * 3 + 1] + Math.sin(t + seed[i]) * dt * 0.15, z = a[i * 3 + 2] + Math.cos(t * 0.4 + seed[i]) * dt * 0.2;
        if (x > R) x -= 2 * R; if (x < -R) x += 2 * R; if (z > R) z -= 2 * R; if (z < -R) z += 2 * R;
        if (y > 6) y = 0; if (y < 0) y = 6;
        a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
      motes.position.set(center.x, center.y - 1, center.z);
      shafts.position.set(center.x, 0, center.z);
      if (camera) shafts.children.forEach((m) => { m.lookAt(camera.position.x, m.getWorldPosition(new THREE.Vector3()).y, camera.position.z); m.rotateZ(0.35); m.material.opacity = 0.06 + Math.sin(t * 0.2 + m.userData.ph) * 0.015; });
    },
  };
}
