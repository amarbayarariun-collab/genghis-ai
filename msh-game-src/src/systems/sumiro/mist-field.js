// Extra ground mist. A few soft cards, not the reference chapter bank.
// Created only while the FX toggle is on.
import * as THREE from 'three';

function cardTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const blobs = [
    [80, 120, 90],
    [160, 90, 70],
    [130, 170, 80],
    [40, 50, 50],
  ];
  for (const [x, y, r] of blobs) {
    const rad = g.createRadialGradient(x, y, 4, x, y, r);
    rad.addColorStop(0, 'rgba(236, 214, 176, 0.55)');
    rad.addColorStop(1, 'rgba(236, 214, 176, 0)');
    g.fillStyle = rad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createMistField(scene) {
  const tex = cardTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.26,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(16, 9);
  const group = new THREE.Group();
  group.name = 'steppe-mist';
  const cards = [];
  const lifts = [0.7, 1.15, 1.55];
  const spots = [[-7.5, 2.2], [0.6, 1.4], [7.2, 2.4]];
  lifts.forEach((y, i) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(spots[i][0], y, spots[i][1]);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    group.add(mesh);
    cards.push({ mesh, y, phase: i * 1.7, speed: 0.12 + i * 0.05 });
  });
  scene.add(group);
  return {
    update(t) {
      for (const c of cards) {
        c.mesh.position.x += Math.sin(t * c.speed + c.phase) * 0.01;
        c.mesh.position.z += Math.cos(t * c.speed * 0.8 + c.phase) * 0.008;
        c.mesh.position.y = c.y + Math.sin(t * 0.35 + c.phase) * 0.05;
      }
    },
    dispose() {
      scene.remove(group);
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
