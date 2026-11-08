// Loads every Blender-built prop in src/assets/models/*.glb.
// They are inlined into the bundle (?inline -> base64 data URI) because the hosted
// artifact can't serve .glb files, and parsed directly (no fetch of data: URLs,
// which the artifact's security policy blocks — see MISTAKES.md #13/#18).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const files = import.meta.glob('./models/*.glb', { query: '?inline', import: 'default', eager: true });

function dataUriToBuffer(uri) {
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// -> { ger: THREE.Group, cart: THREE.Group, ... } (missing files are simply absent)
export async function loadModels() {
  const loader = new GLTFLoader();
  const out = {};
  await Promise.all(Object.entries(files).map(async ([path, uri]) => {
    const name = path.split('/').pop().replace('.glb', '');
    try {
      const gltf = await loader.parseAsync(dataUriToBuffer(uri), '');
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        // Blender exports PBR; our scene is lit for Lambert-ish flat colour — keep it matte
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m && 'metalness' in m && m.metalness < 0.5) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.8); } });
      });
      out[name] = gltf.scene;
    } catch (e) {
      console.warn('[models] failed to parse', name, e);
    }
  }));
  return out;
}

// clone a loaded prop and drop it on the terrain
export function place(scene, src, x, z, heightAt, { rot = 0, scale = 1, sink = 0 } = {}) {
  const o = src.clone(true);
  o.position.set(x, heightAt(x, z) - sink, z);
  o.rotation.y = rot;
  o.scale.setScalar(scale);
  scene.add(o);
  return o;
}

// first mesh geometry of a prop (e.g. grass_clump for instancing), with its colours
export function firstGeometry(src) {
  let geo = null, mat = null;
  src.traverse((o) => { if (!geo && o.isMesh) { geo = o.geometry; mat = o.material; } });
  return { geo, mat };
}
export { THREE };
