// Fading ground marks where the foot lands. Only while the FX toggle is on.
// The reference version stamped ink on a dodge. This one is steppe dust.
import * as THREE from 'three';

function stainTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const rad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  rad.addColorStop(0, 'rgba(90, 58, 28, 0.65)');
  rad.addColorStop(1, 'rgba(90, 58, 28, 0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFootStains(scene, heightAt) {
  const tex = stainTexture();
  const geo = new THREE.PlaneGeometry(0.42, 0.28);
  const slots = [];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    slots.push({ mesh, mat, life: 0 });
  }
  let cursor = 0;
  return {
    stamp(pos, yaw = 0) {
      const s = slots[cursor];
      cursor = (cursor + 1) % slots.length;
      const y = (heightAt?.(pos.x, pos.z) ?? pos.y) + 0.03;
      s.mesh.position.set(pos.x, y, pos.z);
      s.mesh.rotation.z = yaw;
      s.mesh.visible = true;
      s.life = 1;
      s.mat.opacity = 0.35;
    },
    update(dt) {
      for (const s of slots) {
        if (s.life <= 0) continue;
        s.life = Math.max(0, s.life - dt * 0.45);
        s.mat.opacity = s.life * 0.35;
        if (s.life === 0) s.mesh.visible = false;
      }
    },
    dispose() {
      for (const s of slots) {
        scene.remove(s.mesh);
        s.mat.dispose();
      }
      geo.dispose();
      tex.dispose();
    },
  };
}
