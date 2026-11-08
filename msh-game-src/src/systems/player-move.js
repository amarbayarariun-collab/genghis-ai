// Locomotion feel adapted from Sumiro player speeds / grip / accel.
// Walk-only narrative slice (no parkour/combat).
import * as THREE from 'three';

const SPEEDS = {
  walk: 1.6,
  jog: 3.5, // Sumiro jog — we use this as default explore pace
  run: 4.6, // capped below Sumiro run for camp readability
};

const TUNE = {
  accel: 11,
  deceler: 22,
  grip: 18, // Sumiro ~26; slightly softer for steppe
  turnBlend: 14,
};

/**
 * @param {{
 *   pos: THREE.Vector3,
 *   yaw: number,
 * }} player
 */
export function createMover(player) {
  const vel = new THREE.Vector3();
  const wish = new THREE.Vector3();
  let moving = false;

  /**
   * @param {number} dt
   * @param {{ forward: boolean, back: boolean, left: boolean, right: boolean }} input
   * @param {(p: THREE.Vector3) => void} resolveCollisions
   * @param {{ min?: number, max?: number }} [bounds]
   */
  function step(dt, input, resolveCollisions, bounds = {}) {
    dt = Math.min(dt, 0.05);
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);

    wish.set(0, 0, 0);
    if (input.forward) wish.add(fwd);
    if (input.back) wish.addScaledVector(fwd, -0.75);
    if (input.right) wish.addScaledVector(right, 0.9);
    if (input.left) wish.addScaledVector(right, -0.9);

    const wishing = wish.lengthSq() > 1e-6;
    if (wishing) wish.normalize();

    const targetSpeed = wishing
      ? (input.back ? SPEEDS.walk : SPEEDS.jog)
      : 0;

    // Accelerate toward wish direction (Sumiro-like grip blend onto velocity)
    if (wishing) {
      const accel = TUNE.accel;
      const desired = wish.clone().multiplyScalar(targetSpeed);
      const grip = 1 - Math.exp(-TUNE.grip * dt);
      vel.x += (desired.x - vel.x) * grip;
      vel.z += (desired.z - vel.z) * grip;
      // also nudge magnitude with accel clamp
      const sp = Math.hypot(vel.x, vel.z);
      if (sp < targetSpeed) {
        const add = Math.min(accel * dt, targetSpeed - sp);
        if (sp > 1e-4) {
          vel.x += (vel.x / sp) * add;
          vel.z += (vel.z / sp) * add;
        } else {
          vel.copy(wish).multiplyScalar(add);
        }
      }
    } else {
      // Decelerate
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > 1e-4) {
        const ns = Math.max(0, sp - TUNE.deceler * dt);
        vel.multiplyScalar(ns / sp);
      } else {
        vel.set(0, 0, 0);
      }
    }

    // Cap
    const cap = SPEEDS.run;
    const sp2 = Math.hypot(vel.x, vel.z);
    if (sp2 > cap) vel.multiplyScalar(cap / sp2);

    const before = player.pos.clone();
    player.pos.x += vel.x * dt;
    player.pos.z += vel.z * dt;

    const lim = bounds.max ?? 50;
    const mn = bounds.min ?? -lim;
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, mn, lim);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, mn, lim);

    resolveCollisions(player.pos);

    // Kill velocity into blockers a bit
    const moved = player.pos.clone().sub(before);
    if (moved.lengthSq() < (vel.lengthSq() * dt * dt) * 0.25 && wishing) {
      vel.multiplyScalar(0.35);
    }

    moving = Math.hypot(vel.x, vel.z) > 0.15;
    return { moving, speed: Math.hypot(vel.x, vel.z) };
  }

  function reset() {
    vel.set(0, 0, 0);
    moving = false;
  }

  return { step, reset, vel, get moving() { return moving; } };
}
