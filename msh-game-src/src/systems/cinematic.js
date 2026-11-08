// Sumiro-like chapter intro: ease camera along a short path, then hand off to chase rig.
import * as THREE from 'three';

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {{ duration?: number }} [opts]
 */
export function createCinematic(camera, opts = {}) {
  const duration = opts.duration ?? 3.2;
  let active = false;
  let t = 0;
  let from = new THREE.Vector3();
  let to = new THREE.Vector3();
  let lookFrom = new THREE.Vector3();
  let lookTo = new THREE.Vector3();
  let onDone = null;

  function start({ eyeFrom, eyeTo, lookAtFrom, lookAtTo, seconds, done }) {
    from.copy(eyeFrom);
    to.copy(eyeTo);
    lookFrom.copy(lookAtFrom);
    lookTo.copy(lookAtTo);
    t = 0;
    active = true;
    onDone = done || null;
    if (seconds) /* local override unused — keep duration */ void seconds;
    camera.position.copy(from);
    camera.lookAt(lookFrom);
  }

  function update(dt) {
    if (!active) return false;
    t += dt;
    const u = Math.min(1, t / duration);
    const e = u * u * (3 - 2 * u); // smoothstep
    camera.position.lerpVectors(from, to, e);
    const look = new THREE.Vector3().lerpVectors(lookFrom, lookTo, e);
    camera.lookAt(look);
    if (u >= 1) {
      active = false;
      onDone?.();
      onDone = null;
    }
    return true;
  }

  return {
    start,
    update,
    get active() { return active; },
  };
}

/** Soft ground mist planes (Sumiro atmosphere without ink materials). */
export function createMist(scene, { color = '#d8c8b0', y = 0.6, count = 5 } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const layers = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(80 + i * 20, 40 + i * 10), mat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set((i - 2) * 8, y + i * 0.15, (i % 2) * 6);
    m.material.opacity = 0.08 + i * 0.02;
    group.add(m);
    layers.push(m);
  }
  scene.add(group);
  return {
    group,
    update(t) {
      for (let i = 0; i < layers.length; i++) {
        layers[i].position.x = Math.sin(t * 0.08 + i) * 6;
        layers[i].material.opacity = 0.07 + Math.sin(t * 0.3 + i) * 0.03;
      }
    },
  };
}
