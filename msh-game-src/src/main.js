import './error-overlay.js';
import './inline-models.js';
// МСХ · Тэмүжин v1 — Sumiro-style chapters + Taichiud + GLB Temüjin.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWorld } from './world.js';
import { buildBurkhan, buildCapture, buildEscape, buildRiver, buildFlight, buildAct2, buildAct3 } from './scenes/chapters.js';
import { buildSorkhanGer } from './scenes/ger-interior.js';
import {
  STORY, SOURCES, END_LINES, CHAPTERS, CREDITS,
  NEXT_TEASER, TAICHIUD_TEASER, ACT2_TEASER, ACT3_TEASER, MVP_DONE,
} from './story.js';
import { createCameraRig } from './systems/camera-rig.js';
import { createMover } from './systems/player-move.js';
import { createCinematic as createSimpleCine } from './systems/cinematic.js';
import { createCinematic as createPathCine, ONON_INTRO } from './systems/harvest/cinematic-camera.js';
import { createMist as createHarvestMist } from './systems/harvest/fx-mist.js';
import { createDustSteps, createStrideTrigger } from './systems/harvest/fx-dust-steps.js';
import { createSteppeMotes } from './systems/harvest/fx-steppe-motes.js';
import { createBirds } from './systems/harvest/fx-birds.js';
import { createSteppeAudio } from './systems/harvest/ambient-audio.js';
import { createLocomotionFSM } from './systems/harvest/anim-state-machine.js';
import { createAdaptiveQuality } from './systems/harvest/lod-instancing.js';
import { qualityPreset, pickTierFromAvgMs, applyRendererQuality, QUALITY_TIERS } from './systems/quality.js';
import { loadSave, writeSave, unlockNext } from './save.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // cheaper; CSS warmGrade softens edges
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = true;

const scene = new THREE.Scene();
let envMap = null;
function ensureEnvMap(on) {
  if (on) {
    if (!envMap) {
      envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    }
    scene.environment = envMap;
    scene.environmentIntensity = 0.45;
  } else {
    scene.environment = null;
    scene.environmentIntensity = 0;
  }
}
const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 900);

// ---- Quality / adaptive ----
let save = loadSave();
let qualityId = save.quality || 'med'; // null in save → start med, auto-probe first 2s
let quality = qualityPreset(qualityId);
let qualityManual = !!save.quality;
let probeAcc = 0;
let probeFrames = 0;
let probeDone = qualityManual;
let adapt = null;
const stepDir = new THREE.Vector3();
const ndc = new THREE.Vector2();
let showPerf = false;
let fpsEma = 60;
let fpsFrames = 0;
let fpsWindowT = 0;

function updatePerfHud(force) {
  const el = $('perfHud');
  if (!el) return;
  if (!showPerf) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  if (!force && fpsFrames < 8) return;
  const info = renderer.info;
  el.textContent = `${fpsEma.toFixed(0)} fps · ${quality.label} · draw ${info.render.calls} · tri ${info.render.triangles} · pr ${renderer.getPixelRatio().toFixed(2)}`;
}

function setQuality(id, { manual = false, reloadScene = true } = {}) {
  if (!QUALITY_TIERS.includes(id)) id = 'med';
  qualityId = id;
  quality = qualityPreset(id);
  if (manual) {
    qualityManual = true;
    save = writeSave({ quality: id });
  }
  applyRendererQuality(renderer, THREE, quality);
  ensureEnvMap(id !== 'low');
  adapt = createAdaptiveQuality(renderer, {
    targetMs: id === 'low' ? 33 : id === 'high' ? 16.7 : 20,
    min: id === 'low' ? 0.75 : 0.85,
    max: quality.pixelRatioCap,
    every: 2,
    steps: id === 'low' ? [0.75, 1] : id === 'med' ? [0.85, 1, 1.25] : [1, 1.25, 1.5],
  });
  document.querySelectorAll('[data-quality]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-quality') === id);
  });
  if (reloadScene && typeof world !== 'undefined' && world && state !== 'title') {
    loadScene(sceneId, { cinematic: false });
  }
  updatePerfHud(true);
}
setQuality(qualityId, { manual: qualityManual, reloadScene: false });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function clearScene() {
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    scene.remove(obj);
    obj.traverse?.((c) => {
      c.geometry?.dispose?.();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      }
    });
  }
}

const player = { pos: new THREE.Vector3(0, 0, 10), yaw: 0.15, bob: 0 };
const cam = createCameraRig(camera, { distance: 5.0, height: 1.55, minPitch: -0.35, maxPitch: 0.55 });
let jumpY = 0;
let jumpV = 0;
let riding = false;
let mountAnim = null; // {t, dx, dz, dy}: offset from the final pose that eases to zero
let walkFaceYaw = null; // last walking direction of Temujin (null = face away from camera)
const mover = createMover(player);
const audio = createSteppeAudio({ volume: 0.75, music: false });
// ---------------------------------------------------------------------------
// Theme music: the attached morin khuur track, looped quietly under everything.
// Starts on the first user click (autoplay policy); mute is remembered.
// ---------------------------------------------------------------------------
const theme = new Audio('./theme.mp3');
theme.loop = true;
theme.preload = 'auto';
const THEME_VOL = 0.26; // namuuhan
let themeDuckK = 1;
let themeMuted = localStorage.getItem('msh-mute') === '1';
theme.volume = 0;
function themeApply() {
  theme.muted = themeMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = themeMuted ? '🔇' : '🔊';
}
function themeFadeTo(target, seconds = 1.2) {
  const from = theme.volume;
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
    theme.volume = from + (target - from) * k;
    if (k < 1 && theme._fade === tick) requestAnimationFrame(tick);
  };
  theme._fade = tick;
  tick();
}
function themeStart() {
  themeApply();
  theme.play().then(() => themeFadeTo(THEME_VOL * themeDuckK, 1.5)).catch(() => {});
}
{
  const u = audio.unlock;
  audio.unlock = (...a) => { themeStart(); return u?.(...a); };
  const d = audio.duck;
  audio.duck = (amount = 1, seconds = 0.6) => {
    themeDuckK = amount >= 1 ? 1 : 0.55;
    if (!theme.paused) themeFadeTo(THEME_VOL * themeDuckK, seconds);
    return d?.(amount, seconds);
  };
}
addEventListener('DOMContentLoaded', () => {
  themeApply();
  const btn = document.getElementById('muteBtn');
  if (btn) btn.onclick = () => {
    themeMuted = !themeMuted;
    localStorage.setItem('msh-mute', themeMuted ? '1' : '0');
    themeApply();
    audio.toggleMute?.();
    if (!themeMuted && theme.paused) themeStart();
  };
});
audio.attachUnlock?.();
const simpleCine = createSimpleCine(camera, { duration: 2.8 });
const pathCine = createPathCine(camera, ONON_INTRO);
let activeCine = null; // { update, active, skip? }
const keys = {};
let world = null;
let sceneId = 'camp';
let chapterId = 'camp';
let NPCS = [];
let harvestMist = null;
let motes = null;
let birds = null;
let dust = null;
const stride = createStrideTrigger({ strideLen: 0.72 });
// Procedural Temüjin → animator:null FSM still fires synthetic footfalls for dust/audio
const loco = createLocomotionFSM({
  animator: null,
  gaits: { idle: 'Idle', walk: 'Walk', jog: 'Run' },
  onStep: (_side, p) => {
    const at = p?.isVector3 ? p : player.pos;
    stepDir.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    if (dust) dust.step(at, stepDir);
    audio.step?.(sceneId === 'burkhan' ? 'rock' : 'grass');
  },
});
let state = 'title'; // title | chapters | cine | explore | dialogue | end | pause
/** When true, freeze camera at aerialView (proof / cinematic hold) — spring rig must not overwrite. */
let aerialLocked = false;
let flag = null;
let talkTarget = null;
let dialogueId = null;
let spottedCooldown = 0;

const PLAYER_RADIUS = 0.3;
const CHAPTER_ORDER = CHAPTERS.map((c) => c.id);

function resolveCollisions(p) {
  // the Onon is too deep to wade: on foot you stop at the bank, on horseback you can ford it
  if (world?.riverX && !riding && !world.fordable) {
    const rx = world.riverX(p.z);
    const half = 7.4;
    const dx = p.x - rx;
    if (Math.abs(dx) < half) {
      p.x = rx + (dx >= 0 ? half : -half);
      if (Date.now() - (resolveCollisions.lastToast || 0) > 2500) {
        resolveCollisions.lastToast = Date.now();
        toast('Онон гүн байна · мориор гатал (F)');
      }
    }
  }
  for (const c of world?.colliders || []) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + PLAYER_RADIUS;
    if (d < min && d > 1e-4) {
      p.x += (dx / d) * (min - d);
      p.z += (dz / d) * (min - d);
    } else if (d < 1e-5) p.x += min;
  }
}

function buildScene(id) {
  const qOpts = { quality };
  if (id === 'burkhan') return buildBurkhan(scene, qOpts);
  if (id === 'act2') return buildAct2(scene, qOpts);
  if (id === 'act3') return buildAct3(scene, qOpts);
  if (id === 'taichiud_capture') return buildCapture(scene, qOpts);
  if (id === 'taichiud_escape') return buildEscape(scene, qOpts);
  if (id === 'taichiud_river') return buildRiver(scene, qOpts);
  if (id === 'taichiud_ger') return buildSorkhanGer(scene, qOpts);
  if (id === 'taichiud_flight') return buildFlight(scene, qOpts);
  return buildWorld(scene, qOpts);
}

function npcsFromWorld(w, id) {
  if (w.npcs) return w.npcs;
  if (id === 'burkhan') {
    return (w.interactables || []).map((i) => ({ obj: i.obj, name: i.name, node: i.node }));
  }
  if (id === 'camp' || !id) {
    return [
      { obj: w.hoelun, name: 'Өэлүн эхтэй', node: 'start' },
      { obj: w.chirha, name: 'Чирха өвгөнтэй', node: 'chirha' },
    ];
  }
  return [];
}

function audioModeFor(id) {
  if (id === 'taichiud_escape' || id === 'taichiud_ger' || id === 'taichiud_flight' || id === 'act3') return id === 'taichiud_ger' ? 'ger' : 'night';
  if (id === 'taichiud_river' || id === 'burkhan') return 'dawn';
  return 'day';
}

function afterCine(id, dialogueNode) {
  if (dialogueNode) startDialogue(dialogueNode);
  else if (world?.intro) startDialogue(world.intro);
  else releasePlay();
}

function disposeHarvestFx() {
  harvestMist?.dispose?.();
  harvestMist = null;
  motes?.dispose?.();
  motes = null;
  birds?.dispose?.();
  birds = null;
  if (dust?.points) scene.remove(dust.points);
  dust = null;
}

function loadScene(id, { cinematic = true, dialogueNode = null } = {}) {
  walkFaceYaw = null;
  jumpY = 0; jumpV = 0;
  if (riding && world?.mount) world.mount.userData.ridden = false;
  riding = false;
  disposeHarvestFx();
  clearScene();
  activeCine = null;
  aerialLocked = false;
  sceneId = id;
  world = buildScene(id);
  chapterId = world.chapterId || CHAPTERS.find((c) => c.scene === id)?.id || id;
  NPCS = npcsFromWorld(world, id);
  world.bind?.(gameCtx);
  $('endOverlay').classList.add('hidden');
  $('chapter').textContent = world.chapterLabel || 'Бүлэг';
  const stealthOn = !!(world.stealth && world.stealth.torches);
  $('stealthHint').classList.add('hidden');

  const sp = world.startPos || new THREE.Vector3(0, 0, 10);
  player.pos.set(sp.x, sp.y, sp.z);
  // Face camp / sun (north-ish) for f03 rider framing
  player.yaw = world.startYaw ?? (id === 'camp' ? 0.05 : 0.15);
  cam.yaw = player.yaw;
  mover.reset();

  // ---- Harvest FX (gated by quality tier) ----
  if (!id.includes('ger') && quality.mist && !world.steppe) {
    try {
      const mistOpts =
        id === 'camp' || id === 'taichiud_river'
          ? { center: [-18, 0.5, -20], size: [120, 50], along: [0.2, 1], layers: qualityId === 'high' ? 2 : 1, color: '#e8d2a8', thin: '#e0c498', intensity: 0.22, alphaMax: 0.28, opticalDepth: 1.0 }
          : id === 'burkhan'
            ? { center: [0, 1.2, -20], size: [120, 60], along: [1, 0.2], layers: 2, color: '#d8d2c4', intensity: 0.55, alphaMax: 0.45 }
            : { center: [0, 0.4, -18], size: [70, 28], along: [1, 0.15], layers: 1, color: '#e0c8a0', intensity: 0.3, alphaMax: 0.4 };
      harvestMist = createHarvestMist(scene, mistOpts);
    } catch (e) {
      console.warn('[harvest mist]', e);
      harvestMist = null;
    }
  }
  if (!id.includes('ger') && quality.motes > 0 && !world.night) {
    try {
      const base = id === 'camp' ? quality.motes : Math.max(12, (quality.motes * 0.6) | 0);
      motes = createSteppeMotes(base);
      scene.add(motes.group);
      motes.setWind?.(0.35, 0.12);
    } catch (e) {
      console.warn('[harvest motes]', e);
      motes = null;
    }
  }
  if (id === 'camp' || (quality.birds && id === 'burkhan')) {
    try {
      birds = createBirds(scene, {
        count: id === 'camp' ? 4 : (quality.birdCount || 3),
        center: id === 'camp' ? [0, 2, 2] : [0, 8, -20],
        radius: id === 'camp' ? 11 : 28,
        height: id === 'camp' ? 11 : 34,
        span: id === 'camp' ? 1.7 : 2,
        color: id === 'camp' ? '#2a241c' : undefined,
        speed: id === 'camp' ? 6 : 7,
        soar: id === 'camp' ? 2.2 : 6,
        perches: id === 'burkhan' ? [[0, 14, -30]] : [],
      });
    } catch (e) {
      console.warn('[harvest birds]', e);
      birds = null;
    }
  }
  if (quality.dust) {
    try {
      dust = createDustSteps(scene);
      scene.add(dust.points);
    } catch (e) {
      console.warn('[harvest dust]', e);
      dust = null;
    }
  }

  audio.setChapter?.(id.startsWith('taichiud') ? 'camp' : id);
  audio.setMode?.(audioModeFor(id));

  const groundY = world.heightAt(sp.x, sp.z);
  const open = id === 'camp' || world.steppe;
  cam.view.pitch = open ? 0.1 : 0.36;
  cam.view.lookLift = open ? 1.3 : 0.7;
  cam.view.distance = open ? 6.2 : 3.0;
  camera.far = open ? 900 : (quality.camFar || 420);
  camera.updateProjectionMatrix();
  cam.snapTo(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw, cam.view.pitch);

  if (cinematic) {
    state = 'cine';
    $('hud').classList.remove('hidden');
    $('dialogue').classList.add('hidden');

    if (id === 'camp' && world.aerialView) {
      // High wide f03 framing → ease down to Temüjin (harvest path cine)
      const aerial = world.aerialView;
      const chaseEye = new THREE.Vector3(
        sp.x + Math.sin(player.yaw) * 6.2,
        groundY + 2.8,
        sp.z + Math.cos(player.yaw) * 6.2
      );
      pathCine.setPath({
        positions: [
          [aerial.eye.x, aerial.eye.y, aerial.eye.z],
          [aerial.eye.x * 0.6, aerial.eye.y * 0.7, aerial.eye.z * 0.75],
          [sp.x + 4, groundY + 8, sp.z + 14],
          [chaseEye.x, chaseEye.y + 1.2, chaseEye.z + 2],
          [chaseEye.x, chaseEye.y, chaseEye.z],
        ],
        targets: [
          [aerial.look.x, aerial.look.y, aerial.look.z],
          [-2, 1.8, -4],
          [sp.x, groundY + 1.4, sp.z - 2],
          [sp.x, groundY + 1.35, sp.z],
          [sp.x, groundY + 1.3, sp.z],
        ],
        duration: 5.5,
        fov: 48,
        closed: false,
        entry: 0.6,
      });
      camera.position.copy(aerial.eye);
      camera.lookAt(aerial.look);
      camera.fov = 48;
      camera.updateProjectionMatrix();
      pathCine.start({
        from: aerial.eye,
        lookingAt: aerial.look,
        onDone: () => {
          camera.fov = 62;
          camera.updateProjectionMatrix();
          cam.snapTo(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw, cam.view.pitch);
          activeCine = null;
          afterCine(id, dialogueNode);
        },
      });
      activeCine = pathCine;
    } else {
      const eyeTo = new THREE.Vector3(
        sp.x + Math.sin(player.yaw) * 5,
        groundY + 2.6,
        sp.z + Math.cos(player.yaw) * 5
      );
      const eyeFrom = eyeTo.clone().add(new THREE.Vector3(6, 5, 10));
      simpleCine.start({
        eyeFrom,
        eyeTo,
        lookAtFrom: new THREE.Vector3(sp.x, groundY + 2, sp.z - 6),
        lookAtTo: new THREE.Vector3(sp.x, groundY + 1.35, sp.z),
        done: () => {
          cam.snapTo(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw, 0.16);
          activeCine = null;
          afterCine(id, dialogueNode);
        },
      });
      activeCine = {
        get active() { return simpleCine.active; },
        update: (dt) => simpleCine.update(dt),
        skip: () => simpleCine.skip?.(),
      };
    }
  } else {
    state = 'explore';
    if (dialogueNode) startDialogue(dialogueNode);
  }

  writeSave({ lastChapter: chapterId });
}

// Initial camp preload behind title
loadScene('camp', { cinematic: false });
state = 'title';
$('hud').classList.add('hidden');

addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
    e.preventDefault();
  }
  keys[e.code] = true;
  if (e.code === 'F3') {
    showPerf = !showPerf;
    updatePerfHud(true);
    e.preventDefault();
  }
  if (e.code === 'Escape') {
    if (state === 'cine' && activeCine?.skip) activeCine.skip();
    else if (state === 'pause') closePause();
    else if (state === 'explore' || state === 'dialogue') openPause();
  }
  const moveKey = e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD'
    || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight';
  if (state === 'cine' && (moveKey || e.code === 'Space' || e.code === 'Enter') && activeCine?.skip) {
    activeCine.skip();
  }
  if (state === 'dialogue' && moveKey && (dialogueId === 'intro0' || dialogueId === 'intro1' || dialogueId === 'intro2')) {
    show('intro_done');
  }
  if (e.code === 'Space' && state === 'explore' && jumpY <= 0.001) {
    jumpV = riding ? 4.6 : 5.2;
    audio.jump?.();
  }
  if (e.code === 'KeyF' && state === 'explore') toggleRide();
  if (e.code === 'KeyE' && state === 'explore') {
    const u = nearUsable();
    if (u) { u.use(); return; }
    if (performPendingErrand()) return;
    const n = nearest();
    if (n) talk(n);
  }
});

function openPause() {
  state = 'pause';
  $('pause')?.classList.remove('hidden');
  $('dialogue').classList.add('hidden');
  document.querySelectorAll('[data-quality]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-quality') === qualityId);
  });
}
function closePause() {
  $('pause')?.classList.add('hidden');
  state = 'explore';
  $('hud').classList.remove('hidden');
}
$('pauseResume')?.addEventListener('click', () => closePause());
$('pauseTitle')?.addEventListener('click', () => {
  $('pause')?.classList.add('hidden');
  showTitle();
});
document.querySelectorAll('[data-quality]').forEach((b) => {
  b.addEventListener('click', () => {
    setQuality(b.getAttribute('data-quality'), { manual: true, reloadScene: true });
  });
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging || state !== 'explore') return;
  cam.lookDelta(e.clientX - lx, e.clientY - ly);
  player.yaw = cam.yaw;
  lx = e.clientX; ly = e.clientY;
});

const ray = new THREE.Raycaster();
canvas.addEventListener('click', (e) => {
  if (state !== 'explore') return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const n of NPCS) {
    if (n.obj && ray.intersectObject(n.obj, true).length && dist(n.obj) < 8) return talk(n);
  }
});

const dist = (o) => Math.hypot(player.pos.x - o.position.x, player.pos.z - o.position.z);
function nearest(r = 3.5) {
  return NPCS.find((n) => n.obj && (!n.when || n.when()) && dist(n.obj) < r) || null;
}
function nearSet(r = 4.2) {
  return new Set(NPCS.filter((n) => n.obj && (!n.when || n.when()) && dist(n.obj) < r).map((n) => n.obj));
}
function talk(n) {
  talkTarget = n.obj;
  if (sceneId === 'camp' && n.obj === world?.hoelun) {
    const f = campFlags();
    if (!f.metHoelun) return startDialogue('start');
    if (!f.chirhaSeen) return startDialogue('camp_wait');
    if (f.pendingErrand && !f.pendingDone) return startDialogue('camp_errand_wait');
    if (!campTaskDone()) return startDialogue('ask');
    return startDialogue('after');
  }
  if (sceneId === 'camp' && n.obj === world?.chirha) {
    save = writeSave({ flags: { ...campFlags(), chirhaSeen: true } });
    updateObjective();
  }
  startDialogue(n.node);
}

let source = 'intro';
function setSource(id) {
  source = id;
  if (!$('source').classList.contains('hidden')) renderSource();
}
function renderSource() {
  const c = SOURCES[source];
  if (!c) return;
  $('source').innerHTML = `${c.text}<span class="ref">— ${c.ref}</span>`;
}

function setTitleVideo(on) {
  const v = document.getElementById('titleVideo');
  if (!v) return;
  v.classList.toggle('hidden', !on);
  if (on) v.play().catch(() => {});
  else v.pause();
}
/** Opening film (the user's rendered flight over the Onon) before chapter I. */
function playIntroFilm(done) {
  const box = document.getElementById('introCine');
  const v = document.getElementById('introVideo');
  if (!box || !v) return done();
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    box.classList.add('hidden');
    v.pause();
    removeEventListener('keydown', onKey);
    box.onclick = null;
    done();
  };
  const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); end(); } };
  addEventListener('keydown', onKey);
  box.onclick = end;
  v.onended = end;
  v.currentTime = 0;
  box.classList.remove('hidden');
  v.play().catch(end);
  setTimeout(end, 17000);
}
function showTitle() {
  state = 'title';
  $('hud').classList.add('hidden');
  $('dialogue').classList.add('hidden');
  $('chapters').classList.add('hidden');
  $('endOverlay').classList.add('hidden');
  $('title').classList.remove('hidden');
  setTitleVideo(true);
  refreshContinue();
}

function refreshContinue() {
  const btn = $('continueBtn');
  if (save.lastChapter) {
    btn.classList.remove('hidden');
    btn.textContent = `Үргэлжлүүлэх · ${CHAPTERS.find((c) => c.id === save.lastChapter)?.title || ''}`;
  } else btn.classList.add('hidden');
}
refreshContinue();
setTitleVideo(true);

function renderChapterSelect() {
  const list = $('chapterList');
  list.innerHTML = '';
  save = loadSave();
  for (const ch of CHAPTERS) {
    const unlocked = save.unlocked.includes(ch.id) || ch.id === 'camp';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chapter-card' + (unlocked ? '' : ' locked');
    b.disabled = !unlocked;
    b.innerHTML = `<span class="ch-title">${ch.title}</span><span class="ch-blurb">${ch.blurb}</span><span class="ch-src">${ch.source}</span>`;
    b.onclick = () => {
      $('chapters').classList.add('hidden');
      $('title').classList.add('hidden');
      audio.unlock();
      loadScene(ch.scene, { cinematic: true });
    };
    list.append(b);
  }
}

$('startBtn').onclick = () => {
  audio.unlock();
  writeSave({ unlocked: ['camp'], lastChapter: 'camp', flags: {} });
  save = loadSave();
  const title = $('title');
  title.classList.add('fade-out');
  setTimeout(() => {
    title.classList.add('hidden');
    title.classList.remove('fade-out');
    setTitleVideo(false);
    playIntroFilm(() => {
      $('hud').classList.remove('hidden');
      $('chapter').textContent = '0 бүлэг · Удиртгал';
      loadScene('camp', { cinematic: true, dialogueNode: 'intro0' });
    });
  }, 400);
};
// Full-art title hotspots drive the same handlers
const hot = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
hot('hotStart', () => $('startBtn').click());
hot('hotChapters', () => $('chaptersBtn').click());
hot('hotCredits', () => $('creditsBtn').click());
hot('hotFps', () => { showPerf = !showPerf; updatePerfHud(true); });
hot('hotCont', () => {
  if (!$('continueBtn').classList.contains('hidden')) $('continueBtn').click();
  else $('chaptersBtn').click();
});
hot('hotQuick', () => {
  // Хурдан тоглох: бага чанар, киногүй, шууд тал руу
  audio.unlock();
  setQuality('low', { manual: true, reloadScene: false });
  if (!save) { writeSave({ unlocked: ['camp'], lastChapter: 'camp', flags: {} }); save = loadSave(); }
  $('title').classList.add('hidden');
  setTitleVideo(false);
  $('hud').classList.remove('hidden');
  const ch = CHAPTERS.find((c) => c.id === save.lastChapter) || CHAPTERS[0];
  loadScene(ch.scene, { cinematic: false });
  if (world.intro) startDialogue(world.intro); else releasePlay();
});
$('continueBtn').onclick = () => {
  audio.unlock();
  $('title').classList.add('hidden');
  setTitleVideo(false);
  const ch = CHAPTERS.find((c) => c.id === save.lastChapter) || CHAPTERS[0];
  loadScene(ch.scene, { cinematic: true });
};
$('chaptersBtn').onclick = () => {
  $('title').classList.add('hidden');
  setTitleVideo(false);
  $('chapters').classList.remove('hidden');
  renderChapterSelect();
  state = 'chapters';
};
$('chaptersBack').onclick = () => showTitle();
$('creditsBtn').onclick = () => {
  endCard({
    eyebrow: 'Зохиогчид',
    title: 'МСХ · Тэмүжин',
    body: CREDITS.replace(/\n/g, '<br>'),
    button: 'Нүүр рүү',
    onNext: () => showTitle(),
    memory: '',
  });
};
$('sourceBtn').onclick = () => {
  renderSource();
  $('source').classList.toggle('hidden');
};

function campFlags() {
  return loadSave().flags || {};
}

function campTaskDone() {
  const f = campFlags();
  return !!(f.chirhaSeen && f.metHoelun && (f.food || f.family || f.oath));
}

function updateObjective() {
  const el = $('objective');
  if (!el) return;
  if (state === 'title' || state === 'end') {
    el.classList.add('hidden');
    return;
  }
  if (sceneId !== 'camp') {
    const o = world?.objective?.();
    el.classList.toggle('hidden', !o);
    if (o) el.textContent = o;
    return;
  }
  const f = campFlags();
  let text = 'Өэлүн эх дээр очиж E дар';
  if (f.metHoelun && !f.chirhaSeen) text = 'Чирха өвгөнийг олж E дар';
  else if (f.pendingErrand === 'food' && !f.pendingDone) text = 'Ононы эрэгт очиж E дар';
  else if (f.pendingErrand === 'family' && !f.pendingDone) text = 'Мойлны бутанд очиж E дар';
  else if (f.chirhaSeen && !campTaskDone()) text = 'Өэлүн эх дээр буцаж очоод E дар';
  else if (campTaskDone()) text = 'Өэлүн эх дээр буцаж бүлгээ дуусга';
  el.textContent = text;
  el.classList.remove('hidden');
}

function releasePlay() {
  state = 'explore';
  talkTarget = null;
  const el = document.activeElement;
  if (el && el !== document.body && el !== canvas) el.blur();
  canvas.focus({ preventScroll: true });
  updateObjective();
}

function nearBerry(r = 2.35) {
  return (world?.berryPoints || []).some((p) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < r);
}

function performPendingErrand() {
  const f = campFlags();
  if (sceneId !== 'camp' || !f.pendingErrand || f.pendingDone) return false;
  const food = f.pendingErrand === 'food' && world?.fishSpot && dist(world.fishSpot) < 2.7;
  const family = f.pendingErrand === 'family' && nearBerry();
  if (!food && !family) return false;
  flag = f.pendingErrand;
  save = writeSave({ flags: { ...f, pendingDone: true, [f.pendingErrand]: true } });
  state = 'dialogue';
  dialogueId = 'errand_got';
  $('dialogue').classList.remove('hidden');
  $('prompt').classList.add('hidden');
  $('speaker').textContent = 'Тэмүжин';
  $('text').textContent = f.pendingText || (food
    ? 'Хэдэн жараахай, нэг эрэмдэг загас. Одоо Өэлүн эх дээр буц.'
    : 'Мойл дүүрэн хормой. Одоо Өэлүн эх дээр буц.');
  const box = $('choices');
  box.innerHTML = '';
  box.append(btn('За', () => show('close')));
  updateObjective();
  return true;
}

function beginCampChoice(choice) {
  if (choice.source) setSource(choice.source);
  if (choice.flag === 'oath') {
    flag = 'oath';
    save = writeSave({ flags: { ...campFlags(), oath: true, pendingErrand: null, pendingDone: true, pendingText: choice.consequence } });
    $('speaker').textContent = 'Тэмүжин';
    $('text').textContent = choice.consequence;
    const box = $('choices');
    box.innerHTML = '';
    box.append(btn('Үргэлжлүүлэх →', () => show('after')));
    updateObjective();
    return;
  }
  save = writeSave({
    flags: { ...campFlags(), pendingErrand: choice.flag, pendingDone: false, pendingText: choice.consequence },
  });
  $('speaker').textContent = 'Өэлүн эх';
  $('text').textContent = choice.flag === 'food'
    ? 'Ононы эргийн хөх туган дээр очиж загасаа барь. Дараа нь над дээр буц.'
    : 'Мойлны бутанд очиж түүж ир. Дараа нь над дээр буц.';
  const box = $('choices');
  box.innerHTML = '';
  box.append(btn('За, явья', () => show('close')));
  updateObjective();
}

function startDialogue(id) {
  dialogueId = id;
  state = 'dialogue';
  $('prompt').classList.add('hidden');
  $('dialogue').classList.remove('hidden');
  audio.duck?.(0.4, 0.5);
  birds?.startle?.();
  show(id);
}

function show(id) {
  const override = world?.onNode?.(id, dialogueId);
  if (override) id = override;
  dialogueId = id;
  if (typeof id === 'string' && id.startsWith('goto:')) {
    $('dialogue').classList.add('hidden');
    loadScene(id.slice(5), { cinematic: true });
    return;
  }
  if (id === 'intro_done' || id === 'camp_go') {
    $('dialogue').classList.add('hidden');
    if (id === 'camp_go') {
      const flags = { ...campFlags(), metHoelun: true };
      save = writeSave({ flags });
    }
    $('chapter').textContent = world.chapterLabel || 'I бүлэг · Өнчин өдрүүд';
    audio.duck?.(1, 0.8);
    releasePlay();
    return;
  }
  if (id === 'taichiud_to_escape') {
    $('dialogue').classList.add('hidden');
    loadScene('taichiud_escape', { cinematic: true });
    return;
  }
  if (id === 'taichiud_to_river') {
    $('dialogue').classList.add('hidden');
    loadScene('taichiud_river', { cinematic: true });
    return;
  }
  if (id === 'taichiud_to_ger') {
    $('dialogue').classList.add('hidden');
    loadScene('taichiud_ger', { cinematic: true });
    return;
  }
  if (id === 'end') {
    if (sceneId === 'camp' && !campTaskDone()) {
      $('dialogue').classList.remove('hidden');
      if (state === 'explore') state = 'dialogue';
      const f = campFlags();
      return show(f.pendingErrand && !f.pendingDone ? 'camp_errand_wait' : f.chirhaSeen ? 'ask' : 'camp_wait');
    }
    return endCampSlice();
  }
  if (id === 'burkhan_end') return endBurkhanSlice();
  if (id === 'taichiud_end') return endTaichiudSlice();
  if (id === 'act2_end') return endAct2Slice();
  if (id === 'act3_end') return endAct3Slice();
  if (id === 'close') {
    $('dialogue').classList.add('hidden');
    audio.duck?.(1, 0.8);
    releasePlay();
    return;
  }
  const node = STORY[id];
  if (!node) return;
  if (node.source) setSource(node.source);
  $('speaker').textContent = node.speaker;
  $('text').textContent = id === 'camp_errand_wait' && campFlags().pendingErrand === 'food'
    ? 'Загас хараахан алга. Ононы эргийн хөх туган дээр очиж барь.'
    : id === 'camp_errand_wait' && campFlags().pendingErrand === 'family'
      ? 'Мойл хараахан алга. Бутанд очиж түүгээд ир.'
      : node.text;
  const box = $('choices');
  box.innerHTML = '';
  if (id === 'ask' && sceneId === 'camp' && node.choices) {
    node.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}. ${c.label}`;
      b.onclick = () => beginCampChoice(c);
      box.append(b);
    });
    return;
  }
  if (node.choices) {
    const nextAfter = node.choiceNext || 'after';
    node.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}. ${c.label}`;
      b.onclick = () => {
        flag = c.flag;
        writeSave({ flags: { ...(loadSave().flags || {}), [c.flag]: true } });
        if (c.source) setSource(c.source);
        $('speaker').textContent = 'Тэмүжин';
        $('text').textContent = c.consequence;
        box.innerHTML = '';
        box.append(btn('Үргэлжлүүлэх →', () => show(nextAfter)));
      };
      box.append(b);
    });
  } else {
    box.append(btn('Цааш →', () => show(node.next)));
  }
}

function btn(label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = fn;
  return b;
}

function endCard({ eyebrow, title, body, button, onNext, memory }) {
  state = 'end';
  $('dialogue').classList.add('hidden');
  $('hud').classList.add('hidden');
  const o = $('endOverlay');
  $('title').classList.add('hidden');
  setTitleVideo(false);
  const mem = memory !== undefined ? memory : (END_LINES[flag] || '');
  o.innerHTML = `
    <div class="title-card end-card">
      <div class="title-art" aria-hidden="true"></div>
      <div class="title-copy">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="sub">${mem}</p>
        <p class="body">${body}</p>
        <button id="nextBtn" type="button">${button}</button>
      </div>
    </div>`;
  o.classList.remove('hidden');
  $('nextBtn').onclick = onNext;
}

function endCampSlice() {
  save = unlockNext('camp', CHAPTER_ORDER);
  endCard({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Өнчин өдрүүд',
    body: NEXT_TEASER,
    button: 'Бурхан халдун →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('burkhan', { cinematic: true }); flag = null; },
  });
}
function endBurkhanSlice() {
  save = unlockNext('burkhan', CHAPTER_ORDER);
  endCard({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Бурхан халдун',
    body: TAICHIUD_TEASER,
    button: 'Тайчууд олзлолт →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('taichiud_capture', { cinematic: true }); flag = null; },
  });
}
function endTaichiudSlice() {
  save = unlockNext('taichiud', CHAPTER_ORDER);
  endCard({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Тайчууд · чөлөөлөлт',
    body: ACT2_TEASER,
    button: 'II бүлэг →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('act2', { cinematic: true }); flag = null; },
  });
}
function endAct2Slice() {
  save = unlockNext('act2', CHAPTER_ORDER);
  endCard({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Боорчи · Бөртэ',
    body: ACT3_TEASER,
    button: 'III бүлэг →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('act3', { cinematic: true }); flag = null; },
  });
}
function endAct3Slice() {
  save = unlockNext('act3', CHAPTER_ORDER);
  endCard({
    eyebrow: 'Тоглоом дууслаа',
    title: 'Чингис',
    body: MVP_DONE,
    button: 'Бүлгүүд · дахин',
    onNext: () => { showTitle(); $('chapters').classList.remove('hidden'); $('title').classList.add('hidden'); renderChapterSelect(); },
  });
}

const clock = new THREE.Clock();
let moving = false;
let moveSpeed = 0;

function checkStealth(dt) {
  const st = world?.stealth;
  if (!st?.torches || state !== 'explore') return;
  spottedCooldown = Math.max(0, spottedCooldown - dt);
  if (spottedCooldown > 0) return;
  for (const tr of st.torches) {
    const d = Math.hypot(player.pos.x - tr.x, player.pos.z - tr.z);
    if (d < (tr.radius || 6.5) && moveSpeed > 0.4) {
      spottedCooldown = 4;
      startDialogue(world.spottedNode || 'taichiud_spotted');
      world.onSpotted?.();
      return;
    }
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // FPS + adaptive probe (single rAF loop only)
  fpsFrames++;
  fpsWindowT += dt;
  if (dt > 0) fpsEma = fpsEma * 0.9 + (1 / dt) * 0.1;
  if (fpsWindowT >= 0.5) {
    updatePerfHud(true);
    fpsWindowT = 0;
    fpsFrames = 0;
  }
  if (!probeDone && state !== 'title' && world) {
    probeAcc += dt;
    probeFrames++;
    if (probeAcc >= 2) {
      const avgMs = (probeAcc / Math.max(1, probeFrames)) * 1000;
      probeDone = true;
      if (!qualityManual) {
        const picked = pickTierFromAvgMs(avgMs);
        if (picked !== qualityId) {
          const start = world?.startPos;
          const moved = !!(start && Math.hypot(player.pos.x - start.x, player.pos.z - start.z) > 1.2);
          const busy = state === 'cine' || state === 'dialogue' || moved;
          setQuality(picked, { manual: false, reloadScene: !busy });
        }
      }
    }
  } else if (probeDone && adapt && state !== 'title' && state !== 'pause') {
    adapt.frame(dt);
  }

  if (state === 'title' || state === 'chapters' || state === 'pause' || state === 'end') {
    // Still render world under overlays when paused/explore-backed
    if (world && (state === 'pause' || state === 'end')) {
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'cine') {
    activeCine?.update?.(dt);
    harvestMist?.update?.(dt, camera, renderer);
    motes?.update?.(dt, camera);
    birds?.update?.(dt, t, player.pos);
    dust?.update?.(dt, camera, renderer);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
    return;
  }

  if (!world) {
    requestAnimationFrame(tick);
    return;
  }
  const { temujin, heightAt, update: updateWorld } = world;

  if (state === 'explore') {
    if (keys.ArrowLeft) cam.yaw += dt * 1.8;
    if (keys.ArrowRight) cam.yaw -= dt * 1.8;
    player.yaw = cam.yaw;
    const prevX = player.pos.x;
    const prevZ = player.pos.z;
    const lim = world.limit ?? (sceneId.includes('ger') ? 8 : 50);
    const result = mover.step(
      dt,
      {
        forward: !!(keys.KeyW || keys.ArrowUp),
        back: !!(keys.KeyS || keys.ArrowDown),
        left: !!keys.KeyA,
        right: !!keys.KeyD,
        speedMul: (riding ? 2.4 : 1) * (world.speedMul?.() ?? 1),
      },
      resolveCollisions,
      { min: -lim, max: lim }
    );
    moving = result.moving;
    moveSpeed = result.speed || 0;
    {
      // face the way we actually walk (strafe/back included); the model faces +Z
      const vx = player.pos.x - prevX;
      const vz = player.pos.z - prevZ;
      if (moving && vx * vx + vz * vz > 1e-8) walkFaceYaw = Math.atan2(vx, vz);
    }
    player.bob += dt * (moving ? 8.5 : 1.6);
    checkStealth(dt);

    const f = sceneId === 'camp' ? campFlags() : {};
    const errandLine = f.pendingErrand === 'food' && !f.pendingDone && world?.fishSpot && dist(world.fishSpot) < 2.7
      ? '[E] Загас барих'
      : f.pendingErrand === 'family' && !f.pendingDone && nearBerry()
        ? '[E] Мойл түүх'
        : !riding && nearMount()
          ? '[F] Морь унах'
          : null;
    const usable = nearUsable();
    const n = nearest();
    const prompt = (usable ? `[E] ${usable.label}` : null) || errandLine || (n ? `[E] ${n.name}` : null);
    $('prompt').classList.toggle('hidden', !prompt);
    if (prompt) $('prompt').textContent = prompt;
    updateObjective();
  } else {
    moving = false;
    moveSpeed = 0;
  }

  const groundY = heightAt(player.pos.x, player.pos.z);
  player.pos.y = groundY;
  // jump: simple ballistic arc above the terrain
  if (jumpY > 0 || jumpV > 0) {
    jumpV -= 14 * dt;
    jumpY += jumpV * dt;
    if (jumpY <= 0) { jumpY = 0; jumpV = 0; }
  }
  const seat = riding && world?.mount ? world.mount.userData.seatY - 0.86 - 0.05 : 0;
  temujin.position.set(player.pos.x, groundY + jumpY + seat, player.pos.z);
  if (riding && world?.mount) {
    // sit in the saddle, not on the withers: a little back along the horse's heading
    const hy = world.mount.rotation.y;
    temujin.position.x -= Math.sin(hy) * 0.34;
    temujin.position.z -= Math.cos(hy) * 0.34;
  }
  if (mountAnim) {
    // swing up into / down from the saddle instead of snapping
    mountAnim.t += dt / 0.5;
    const k = Math.min(1, mountAnim.t);
    const e = k * k * (3 - 2 * k);
    temujin.position.x += mountAnim.dx * (1 - e);
    temujin.position.z += mountAnim.dz * (1 - e);
    temujin.position.y += mountAnim.dy * (1 - e) + Math.sin(Math.PI * k) * 0.42;
    if (k >= 1) mountAnim = null;
  }
  temujin.userData.setRiding?.(riding);
  if (riding && world?.mount) {
    const m = world.mount;
    m.position.set(player.pos.x, groundY + jumpY, player.pos.z);
    m.rotation.y = temujin.rotation.y;
    m.userData.update(dt, performance.now() / 1000, moveSpeed);
  }
  {
    const face = walkFaceYaw ?? cam.yaw + Math.PI;
    let dy = face - temujin.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    temujin.rotation.y += dy * Math.min(1, dt * 8);
  }
  if (world.hoelun) world.hoelun.userData.talking = state === 'dialogue' && talkTarget === world.hoelun;
  temujin.userData.setMoving?.(moving && state === 'explore' && !riding && jumpY <= 0);
  temujin.userData.setSpeed?.(moveSpeed);

  if (state === 'explore') {
    stride.update(player.pos, moving, (p, dir) => {
      dust?.step(p, dir);
      audio.step?.(sceneId === 'burkhan' ? 'rock' : 'grass');
    });
    loco.update?.(dt, { speed: moveSpeed, yaw: temujin.rotation.y, talking: false });
  }

  const faceYaw =
    state === 'dialogue' && talkTarget
      ? Math.atan2(-(talkTarget.position.x - player.pos.x), -(talkTarget.position.z - player.pos.z))
      : undefined;
  if (faceYaw != null) {
    player.yaw = faceYaw;
    cam.yaw = faceYaw;
  }
  if (aerialLocked && world?.aerialView) {
    camera.position.copy(world.aerialView.eye);
    camera.lookAt(world.aerialView.look);
    camera.fov = world.aerialView.fov ?? 45;
    camera.updateProjectionMatrix();
  } else if (state === 'explore' || state === 'dialogue') {
    cam.update(dt, player.pos, { faceYaw, dialoguePull: faceYaw != null ? 3.2 : 0 });
  }

  harvestMist?.update?.(dt, camera, renderer);
  motes?.update?.(dt, camera);
  birds?.update?.(dt, t, player.pos);
  dust?.update?.(dt, camera, renderer);
  updateWorld?.(dt, t, state === 'explore' ? nearSet() : null, temujin.position, moving && state === 'explore');
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.__mshLoadScene = (id) => { loadScene(id, { cinematic: false }); if (world.intro) startDialogue(world.intro); else releasePlay(); };
window.__mshShow = show;
window.__mshStartDialogue = startDialogue;
window.__mshSetQuality = (id) => setQuality(id, { manual: true, reloadScene: true });
window.__mshPerf = () => {
  renderer.render(scene, camera);
  return {
    fps: fpsEma,
    tier: qualityId,
    label: quality.label,
    pixelRatio: renderer.getPixelRatio(),
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    programs: renderer.info.programs?.length ?? null,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
};
window.__mshPlayer = () => ({
  x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, scene: sceneId, state,
});
window.__mshMotion = () => ({
  hoelunYaw: world?.hoelun?.rotation?.y ?? null,
  temujinYaw: world?.temujin?.rotation?.y ?? null,
  temujinPitch: world?.temujin?.children?.[0]?.rotation?.x ?? world?.temujin?.rotation?.x ?? null,
  temujinRoll: world?.temujin?.children?.[0]?.rotation?.z ?? null,
  temujinBob: world?.temujin?.children?.[0]?.position?.y ?? null,
  objective: document.getElementById('objective')?.textContent || '',
  objectiveHidden: document.getElementById('objective')?.classList.contains('hidden') ?? true,
  flags: loadSave().flags || {},
  birds: (birds?.birds || []).map((b) => ({
    mode: b.mode,
    x: b.root.position.x,
    y: b.root.position.y,
    z: b.root.position.z,
    wing: b.wings?.[1]?.inner?.rotation?.z ?? null,
  })),
});
window.__mshTeleport = (x, z, yaw) => {
  const y = world?.heightAt?.(x, z) ?? 0;
  player.pos.set(x, y, z);
  if (typeof yaw === 'number') {
    player.yaw = yaw;
    cam.view.yaw = yaw;
  }
  cam.snapTo(player.pos, player.yaw, cam.view.pitch);
  return window.__mshPlayer();
};
window.__mshShowPerf = (v) => { showPerf = v !== false; updatePerfHud(true); };
window.__mshUnlockAll = () => {
  writeSave({ unlocked: CHAPTER_ORDER.slice(), lastChapter: 'camp' });
  save = loadSave();
};
/** Proof helper: lock camera to f03 aerial (gers mid-left, herd right, river BL, sun ahead). */
window.__mshAerial = (opts = {}) => {
  if (!world?.aerialView) return false;
  aerialLocked = true;
  activeCine = null;
  state = 'explore';
  // Rider small bottom-center on the path
  const sp = world.startPos || new THREE.Vector3(0, 0, 16);
  player.pos.set(sp.x, sp.y, sp.z);
  player.yaw = 0.02;
  const av = world.aerialView;
  camera.fov = av.fov ?? 45;
  camera.updateProjectionMatrix();
  camera.position.copy(av.eye);
  camera.lookAt(av.look);
  if (opts.hideHud) {
    $('hud').classList.add('hidden');
    document.getElementById('warmGrade')?.classList.add('proof');
  } else {
    $('hud').classList.remove('hidden');
  }
  $('dialogue').classList.add('hidden');
  $('title')?.classList.add('hidden');
  $('chapters')?.classList.add('hidden');
  return {
    eye: av.eye.toArray(),
    look: av.look.toArray(),
    fov: camera.fov,
    locked: true,
  };
};
window.__mshUnlockAerial = () => { aerialLocked = false; };
/** Test helper: quest target positions in the current camp. */
window.__mshTargets = () => ({
  hoelun: world?.hoelun ? { x: world.hoelun.position.x, z: world.hoelun.position.z } : null,
  chirha: world?.chirha ? { x: world.chirha.position.x, z: world.chirha.position.z } : null,
  fish: world?.fishSpot ? { x: world.fishSpot.position.x, z: world.fishSpot.position.z } : null,
  berries: (world?.berryPoints || []).map((p) => ({ x: p.x, z: p.z })),
});
window.__mshCamYaw = (y) => { cam.view.yaw = y; return y; };

function nearMount(r = 2.6) {
  const m = world?.mount;
  return !!m && Math.hypot(player.pos.x - m.position.x, player.pos.z - m.position.z) < r;
}
function toggleRide() {
  const m = world?.mount;
  if (!m) return;
  if (riding) {
    riding = false;
    m.userData.ridden = false;
    // step off to the left of the horse
    const yaw = world.temujin.rotation.y;
    m.position.set(player.pos.x, m.position.y, player.pos.z);
    player.pos.x += Math.cos(yaw) * 1.1;
    player.pos.z -= Math.sin(yaw) * 1.1;
    mountAnim = { t: 0, dx: -Math.cos(yaw) * 1.1, dz: Math.sin(yaw) * 1.1, dy: m.userData.seatY - 0.91 };
    cam.view.distance = 6.2;
    toast('Мориноос буулаа (F)');
    return;
  }
  if (!nearMount()) return;
  riding = true;
  m.userData.ridden = true;
  mountAnim = { t: 0, dx: player.pos.x - m.position.x, dz: player.pos.z - m.position.z, dy: -(m.userData.seatY - 0.91) };
  player.pos.x = m.position.x;
  player.pos.z = m.position.z;
  world.temujin.rotation.y = m.rotation.y;
  walkFaceYaw = m.rotation.y;
  cam.view.distance = 8.0;
  audio.neigh?.();
  toast('Морь унлаа · F буух');
}
window.__mshRide = () => { if (world?.mount) { player.pos.x = world.mount.position.x + 0.5; player.pos.z = world.mount.position.z; } toggleRide(); return riding; };
window.__mshJump = () => { if (jumpY <= 0.001) jumpV = riding ? 4.6 : 5.2; return true; };
window.__mshJumpY = () => jumpY;
function nearUsable() {
  for (const u of world?.usables || []) {
    if (u.when && !u.when()) continue;
    if (Math.hypot(player.pos.x - u.x, player.pos.z - u.z) < u.r) return u;
  }
  return null;
}
const gameCtx = {
  player,
  state: () => state,
  riding: () => riding,
  toast: (m, ms) => toast(m, ms),
  startDialogue: (id) => startDialogue(id),
  loadScene: (id) => loadScene(id, { cinematic: true }),
  teleport: (x, z) => { player.pos.x = x; player.pos.z = z; mover.reset(); },
  dismount: () => { if (riding) toggleRide(); },
  mount: () => { if (!riding && world?.mount) { player.pos.x = world.mount.position.x; player.pos.z = world.mount.position.z; toggleRide(); } },
  keys,
};
window.__mshWorld = () => world;
window.__mshTheme = () => theme;
window.__mshEndCard = () => endCard({ eyebrow: 'Туршилт', title: 'Тоглоом дууслаа · Чингис', body: 'тест', button: 'Нүүр рүү', onNext: () => showTitle() });
function toast(msg, ms = 1600) {
  let el = document.getElementById('msh-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'msh-toast';
    el.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);padding:8px 16px;border-radius:8px;background:rgba(30,22,14,.82);color:#f3e4c4;font:600 15px system-ui,sans-serif;pointer-events:none;transition:opacity .4s;z-index:50';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, ms);
}
