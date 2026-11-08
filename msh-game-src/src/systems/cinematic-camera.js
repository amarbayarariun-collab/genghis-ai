/**
 * cinematic-camera.js — Нээлтийн кино камер (intro flythrough over the Onon camp)
 *
 * Source / idea: verdant `src/world/cinematic.js` (xikhar/verdant, NO license file → re-implemented, no code
 *   copied): a closed CatmullRom *position* curve plus a separate CatmullRom *gaze* curve (centripetal), a 2 s
 *   quintic-eased entry blended from the live gameplay camera (position, target and FOV), a soft start where travel
 *   accelerates for the first 0.8 s, then constant phase. Added here: open paths, `onDone`, skip on input,
 *   exit blend back to the chase rig, Mongolian camp preset.
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/main.js:
 *   import { createCinematic, ONON_INTRO } from './systems/cinematic-camera.js';
 *   const cine = createCinematic(camera, ONON_INTRO);
 *   $('startBtn').onclick = () => { ...; state = 'cinematic'; cine.start({ onDone: () => { cam.snapTo(player.pos, 0.35, 0.16); startDialogue('intro0'); } }); };
 *   // tick(): if (cine.active) { cine.update(dt); } else { cam.update(dt, player.pos, {...}); }
 *   // optional: addEventListener('keydown', () => cine.skip());
 */
import * as THREE from 'three';

/** Sweeping arrival at the Act I camp: from the river haze in the north, around the gers, settling behind Тэмүжин. */
export const ONON_INTRO = {
  positions: [[-26, 9, -30], [-30, 7, -8], [-18, 5, 12], [2, 3.4, 20], [6, 2.8, 16], [0, 2.6, 15.2]],
  targets: [[0, 2, -10], [0, 1.6, -4], [2, 1.4, -1], [1, 1.2, 2], [0, 1.2, 8], [0, 1.0, 9.5]],
  duration: 14,
  fov: 48,
  closed: false,
  entry: 1.2,
};

/** Burkhan khaldun: a slow rise up the mountain face (set `center` offsets per your scene). */
export const MOUNTAIN_RISE = {
  positions: [[-40, 6, 40], [-20, 18, 20], [0, 30, 0], [10, 34, -12]],
  targets: [[0, 10, 0], [0, 18, -10], [0, 26, -20], [0, 30, -30]],
  duration: 16,
  fov: 44,
  closed: false,
  entry: 1.5,
};

const ease5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * @param {THREE.PerspectiveCamera} camera the live render camera (we drive it directly)
 * @param {{ positions: number[][], targets: number[][], duration?: number, fov?: number, closed?: boolean, entry?: number, loop?: boolean }} path
 */
export function createCinematic(camera, path) {
  let curve, gaze, duration, fov, entry, loop;
  const startPos = new THREE.Vector3(), startTarget = new THREE.Vector3(), target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let active = false, elapsed = 0, startFov = 60, onDone = null, exitT = 0;

  function setPath(p) {
    curve = new THREE.CatmullRomCurve3(p.positions.map((v) => new THREE.Vector3(...v)), !!p.closed, 'centripetal');
    gaze = new THREE.CatmullRomCurve3(p.targets.map((v) => new THREE.Vector3(...v)), !!p.closed, 'centripetal');
    duration = p.duration ?? 20;
    fov = p.fov ?? 48;
    entry = p.entry ?? 2;
    loop = !!p.loop;
  }
  setPath(path);

  function finish() {
    active = false;
    camera.fov = startFov;
    camera.updateProjectionMatrix();
    const cb = onDone; onDone = null;
    cb?.();
  }

  return {
    get active() { return active; },
    get progress() { return active ? Math.min(1, Math.max(0, elapsed - entry) / duration) : 0; },
    setPath,
    /**
     * @param {{ onDone?: () => void, from?: THREE.Vector3, lookingAt?: THREE.Vector3 }} [o]
     *   `from`/`lookingAt` default to the camera's current pose (so it blends out of the chase rig).
     */
    start(o = {}) {
      active = true; elapsed = 0; exitT = 0; onDone = o.onDone ?? null;
      startPos.copy(o.from ?? camera.position);
      if (o.lookingAt) startTarget.copy(o.lookingAt);
      else startTarget.copy(camera.position).add(camera.getWorldDirection(tmp).multiplyScalar(6));
      startFov = camera.fov;
    },
    skip() { if (active) finish(); },
    stop() { active = false; onDone = null; },
    update(dt) {
      if (!active) return;
      elapsed += Math.max(0, dt);
      if (elapsed < entry) {
        const b = ease5(elapsed / entry);
        camera.position.lerpVectors(startPos, curve.getPoint(0), b);
        target.lerpVectors(startTarget, gaze.getPoint(0), b);
        camera.fov = THREE.MathUtils.lerp(startFov, fov, b);
      } else {
        const time = elapsed - entry;
        const travel = time < 0.8 ? (time * time) / 1.6 : time - 0.4; // soft start, then constant
        let phase = travel / duration;
        if (loop) phase %= 1;
        else if (phase >= 1) {
          camera.position.copy(curve.getPoint(1));
          target.copy(gaze.getPoint(1));
          camera.lookAt(target);
          // hold the last frame a beat, then hand back
          exitT += dt;
          if (exitT > 0.4) finish();
          return;
        }
        camera.position.copy(curve.getPoint(phase));
        target.copy(gaze.getPoint(phase));
        camera.fov = fov;
      }
      camera.updateProjectionMatrix();
      camera.lookAt(target);
    },
  };
}
