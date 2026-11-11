// Third-person chase — Sumiro critically-damped spring + Walden spherical orbit.
// Techniques only; Mongolian framing (no ink-wash).
import * as THREE from 'three';

/** Critically damped spring (Sumiro camera_rig). */
function springStep(state, target, omega, dt) {
  if (!Number.isFinite(target)) return state.x;
  if (!Number.isFinite(state.x) || !Number.isFinite(state.v)) {
    state.x = target;
    state.v = 0;
  }
  const exp = Math.exp(-omega * dt);
  const dx = state.x - target;
  const tmp = (state.v + omega * dx) * dt;
  state.v = (state.v - omega * tmp) * exp;
  state.x = target + (dx + tmp) * exp;
  return state.x;
}

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {{
 *   distance?: number, height?: number,
 *   minPitch?: number, maxPitch?: number,
 *   lookSens?: number,
 *   springOmega?: number,
 *   posOmega?: number,
 * }} [opts]
 */
export function createCameraRig(camera, opts = {}) {
  // Sumiro defaults: distance ~5, height ~2
  const distance = opts.distance ?? 5.0;
  const height = opts.height ?? 1.55; // look-at lift layered separately
  const minPitch = opts.minPitch ?? -0.42;
  const maxPitch = opts.maxPitch ?? 0.55;
  const lookSens = opts.lookSens ?? 1;
  const springOmega = opts.springOmega ?? 10;
  const posOmega = opts.posOmega ?? 11;

  const view = { yaw: 0.35, pitch: 0.18, distance, height, lookLift: 0 };
  const yawS = { x: view.yaw, v: 0 };
  const pitchS = { x: view.pitch, v: 0 };
  const distS = { x: view.distance, v: 0 };
  const xS = { x: 0, v: 0 };
  const yS = { x: 1.2, v: 0 };
  const zS = { x: 10, v: 0 };

  const lookAt = new THREE.Vector3();
  const offset = new THREE.Vector3();

  function lookDelta(dx, dy) {
    view.yaw -= dx * 0.0025 * lookSens; // Walden mouse scale
    view.pitch = THREE.MathUtils.clamp(
      view.pitch + dy * 0.002 * lookSens,
      minPitch,
      maxPitch
    );
  }

  function snapTo(targetPos, yaw, pitch) {
    view.yaw = yaw;
    view.pitch = THREE.MathUtils.clamp(pitch, minPitch, maxPitch);
    yawS.x = view.yaw; yawS.v = 0;
    pitchS.x = view.pitch; pitchS.v = 0;
    distS.x = view.distance; distS.v = 0;
    xS.x = targetPos.x; xS.v = 0;
    yS.x = targetPos.y + 1.25; yS.v = 0;
    zS.x = targetPos.z; zS.v = 0;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} focus feet / body focus
   * @param {{ faceYaw?: number, dialoguePull?: number }} [extra]
   */
  function update(dt, focus, extra = {}) {
    dt = Math.min(dt, 0.05);

    if (extra.faceYaw != null && extra.dialoguePull) {
      let dy = wrapPi(extra.faceYaw - view.yaw);
      view.yaw += dy * Math.min(1, extra.dialoguePull * dt);
      // settle pitch toward a soft over-shoulder during talk
      view.pitch += (0.12 - view.pitch) * Math.min(1, 2.5 * dt);
    }

    const yawTarget = yawS.x + wrapPi(view.yaw - yawS.x);
    springStep(yawS, yawTarget, springOmega, dt);
    springStep(pitchS, view.pitch, springOmega, dt);
    springStep(distS, view.distance, springOmega * 0.8, dt);
    // Focus follow — XZ snappy, Y softer (Walden FOLLOW_XZ / FOLLOW_Y idea via omega)
    springStep(xS, focus.x, posOmega, dt);
    springStep(zS, focus.z, posOmega, dt);
    springStep(yS, focus.y + 1.28, posOmega * 0.55, dt);
    yS.x = THREE.MathUtils.clamp(yS.x, focus.y + 0.2, focus.y + 2.2);

    const yaw = yawS.x;
    const pitch = pitchS.x;
    const dist = distS.x;
    const cp = Math.cos(pitch);
    // Spherical orbit behind focus (Walden-style) — camera sits behind + slightly above
    offset.set(Math.sin(yaw) * cp, Math.sin(pitch) + height * 0.15, Math.cos(yaw) * cp);
    camera.position.set(
      xS.x + offset.x * dist,
      yS.x + offset.y * dist * 0.55 + height,
      zS.x + offset.z * dist
    );
    // Never sink under terrain soft floor
    camera.position.y = Math.max(camera.position.y, focus.y + 0.9);

    lookAt.set(xS.x, yS.x + 0.08 + (view.lookLift || 0), zS.x);
    camera.lookAt(lookAt);

    return { yaw, pitch };
  }

  return {
    view,
    lookDelta,
    snapTo,
    update,
    get yaw() { return view.yaw; },
    set yaw(v) { view.yaw = v; },
    get pitch() { return view.pitch; },
    set pitch(v) { view.pitch = THREE.MathUtils.clamp(v, minPitch, maxPitch); },
  };
}
