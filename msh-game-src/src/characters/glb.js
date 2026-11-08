import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Shared GLB swap: normalize size, replace placeholder, blend idle/walk clips by speed.
export function loadGlb(group, placeholder, url, height, { onLoad, afterAdd } = {}) {
  new GLTFLoader().load(url, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(height / (box.getSize(new THREE.Vector3()).y || 1));
    const b2 = new THREE.Box3().setFromObject(model);
    const c = b2.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -b2.min.y, -c.z);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (onLoad) onLoad(model, gltf);
    group.remove(placeholder);
    group.add(model);
    if (afterAdd) afterAdd(model);
    const mixer = new THREE.AnimationMixer(model);
    const find = (re) => gltf.animations.find((a) => re.test(a.name));
    // Prefer an exact "walk" clip over "run" (CharacterArmature|Run sorts
    // before |Walk in some rigs and would otherwise win the regex match).
    const idle = find(/\bidle\b/i) || gltf.animations[0];
    const walk = find(/\bwalk\b/i) || find(/\brun\b/i);
    const aIdle = idle && mixer.clipAction(idle).play();
    const aWalk = walk && walk !== idle && mixer.clipAction(walk).play();
    group.userData.update = (t, dt, speed = 0) => {
      const w = THREE.MathUtils.clamp(speed / 3.5, 0, 1);
      if (aWalk) { aWalk.weight = w; if (aIdle) aIdle.weight = 1 - w; }
      mixer.update(dt);
    };
  }, undefined, (err) => console.warn('[character] GLB failed, keeping placeholder:', url, err));
}
