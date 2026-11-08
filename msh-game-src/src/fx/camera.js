// Third-person camera feel: frame-rate independent damping, simple occlusion pull-in
// against world colliders, and FOV widening with speed (sense of gallop).
import * as THREE from 'three';
const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();
export function createCameraRig(camera, { baseFov = camera.fov, occluders = [] } = {}) {
  let fov = baseFov;
  return {
    occluders,
    // desired: wanted camera pos, target: look point, speed: player m/s
    update(dt, desired, target, speed = 0) {
      // pull the camera in front of anything between it and the player
      tmp.subVectors(desired, target); const dist = tmp.length(); tmp.normalize();
      ray.set(target, tmp); ray.far = dist;
      const hit = occluders.length ? ray.intersectObjects(occluders, true)[0] : null;
      const want = hit ? target.clone().addScaledVector(tmp, Math.max(0.8, hit.distance - 0.3)) : desired;
      const k = 1 - Math.exp(-dt * (hit ? 18 : 7));   // snap in fast, ease out slowly
      camera.position.lerp(want, k);
      camera.lookAt(target);
      const goal = baseFov + THREE.MathUtils.clamp((speed - 4) * 1.1, 0, 12);
      fov += (goal - fov) * (1 - Math.exp(-dt * 3));
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
