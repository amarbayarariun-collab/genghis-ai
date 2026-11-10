// A small flock over the gers. Wing beat is a roll on a flat silhouette.
// The reference flock is ink-buffered and tied to a Japan camera rail; this one is not.
import * as THREE from 'three';

export function createCrows(scene, camera) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.62, 0.02, 0, -0.05, 0.1, 0, -0.02, -0.08, 0,
    0.62, 0.02, 0, 0.02, -0.08, 0, 0.05, 0.1, 0,
    -0.08, 0.02, 0, 0.08, 0.02, 0, 0, -0.16, 0,
  ]), 3));
  const mat = new THREE.MeshBasicMaterial({
    color: 0x1c140f,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, 5);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.name = 'steppe-crows';
  const dummy = new THREE.Object3D();
  const birds = [
    [-2.4, 3.05, 1.6],
    [-0.7, 3.2, 0.8],
    [1.2, 3.1, 1.2],
    [2.6, 3.28, 1.8],
    [0.2, 3.35, 0.4],
  ].map((p, i) => ({ x: p[0], y: p[1], z: p[2], flap: i * 1.2 }));
  scene.add(mesh);
  return {
    update(dt, t) {
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        const x = b.x + Math.sin(t * 0.35 + b.flap) * 0.8;
        const z = b.z + Math.cos(t * 0.28 + b.flap) * 0.35;
        dummy.position.set(x, b.y + Math.sin(t * 0.8 + b.flap) * 0.15, z);
        dummy.lookAt(camera.position);
        dummy.rotateZ(Math.sin(t * 6 + b.flap) * 0.35);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.marks = birds.map((b) => [b.x, b.y, b.z]);
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
