// МСХ · Тэмүжин v1 — Sumiro-style chapters + Taichiud + GLB Temüjin.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWorld } from './world.js';
import { buildBurkhanWorld } from './scenes/burkhan.js';
import { buildAct2World } from './scenes/act2.js';
import { buildAct3World } from './scenes/act3.js';
import {
  buildTaichiudCapture,
  buildTaichiudEscape,
  buildTaichiudRiver,
  buildTaichiudGer,
} from './scenes/taichiud.js';
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
const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 420);

// ---- Quality / adaptive ----
let save = loadSave();
// Other players boot on the fast path: low tier, no shadows, from the first frame.
// A saved higher tier must not turn shadows on before the scene is playable.
let qualityId = 'low';
let quality = qualityPreset('low');
let qualityManual = false;
let probeAcc = 0;
let probeFrames = 0;
let probeDone = true;
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
const mover = createMover(player);
const audio = createSteppeAudio({ volume: 0.75 });
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
let spottedCooldown = 0;

const PLAYER_RADIUS = 0.3;
const CHAPTER_ORDER = CHAPTERS.map((c) => c.id);

function resolveCollisions(p) {
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
  if (id === 'burkhan') return buildBurkhanWorld(scene);
  if (id === 'act2') return buildAct2World(scene);
  if (id === 'act3') return buildAct3World(scene);
  if (id === 'taichiud_capture') return buildTaichiudCapture(scene);
  if (id === 'taichiud_escape') return buildTaichiudEscape(scene);
  if (id === 'taichiud_river') return buildTaichiudRiver(scene);
  if (id === 'taichiud_ger') return buildTaichiudGer(scene);
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
  if (id === 'taichiud_ger') return 'ger';
  if (id === 'taichiud_escape' || id === 'taichiud_capture' || id === 'taichiud_river' || id === 'act3') return 'night';
  if (id === 'burkhan') return 'ridge';
  return 'day';
}

function sceneLook(id, x, z) {
  const blend = (ax, az, near, far, nearD, farD, nearP, farP, nearH, farH) => {
    const t = THREE.MathUtils.smoothstep(Math.hypot(x - ax, z - az), near, far);
    return {
      distance: nearD + t * (farD - nearD),
      pitch: nearP + t * (farP - nearP),
      height: nearH + t * (farH - nearH),
    };
  };
  if (id === 'camp') return blend(0.2, -2, 8, 30, 5.2, 8.8, 0.16, 0.3, 1.55, 1.55);
  if (id === 'burkhan') return blend(0, -10, 7, 26, 7.4, 12.4, 0.1, 0.2, 1.85, 2.25);
  if (id === 'taichiud_capture') return blend(0, 2, 5, 18, 4.6, 7.4, 0.08, 0.16, 1.4, 1.55);
  if (id === 'taichiud_escape') return blend(-1, 2, 4, 16, 4.1, 6.4, 0.06, 0.12, 1.28, 1.42);
  if (id === 'taichiud_river') return blend(0, 0, 4, 18, 5.4, 9.0, 0.08, 0.16, 1.45, 1.7);
  if (id === 'taichiud_ger') return { distance: 4.1, pitch: 0.07, height: 1.22 };
  if (id === 'act2') return blend(0, 0, 8, 28, 5.6, 9.6, 0.12, 0.22, 1.6, 1.9);
  if (id === 'act3') return blend(0, 0, 5, 18, 4.3, 6.6, 0.08, 0.14, 1.35, 1.5);
  return { distance: 5, pitch: 0.22, height: 1.55 };
}

function applyGrade(id) {
  const grade = $('warmGrade');
  if (!grade) return;
  grade.classList.remove('grade-camp', 'grade-burkhan', 'grade-taichiud', 'grade-act2', 'grade-act3');
  const name = id === 'burkhan' ? 'grade-burkhan'
    : id.startsWith('taichiud') ? 'grade-taichiud'
    : id === 'act2' ? 'grade-act2'
    : id === 'act3' ? 'grade-act3'
    : 'grade-camp';
  grade.classList.add(name);
}

function afterCine(id, dialogueNode) {
  if (dialogueNode) startDialogue(dialogueNode);
  else if (id === 'burkhan') startDialogue('burkhan_start');
  else if (id === 'act2') state = 'explore';
  else if (id === 'act3') startDialogue('mergen_start');
  else if (id === 'taichiud_capture') startDialogue('taichiud_capture');
  else if (id === 'taichiud_escape') state = 'explore';
  else if (id === 'taichiud_river') startDialogue('taichiud_river');
  else if (id === 'taichiud_ger') startDialogue('taichiud_ger');
  else state = 'explore';
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

function settlePlayCamera(pos, yaw) {
  const look = sceneLook(sceneId, pos.x, pos.z);
  cam.view.pitch = look.pitch;
  cam.view.distance = look.distance;
  cam.view.height = look.height;
  cam.snapTo(pos, yaw, look.pitch);
  cam.update(1 / 30, pos, { frame: look });
  return {
    eye: camera.position.clone(),
    lookAt: new THREE.Vector3(pos.x, pos.y + 1.35, pos.z),
  };
}

function loadScene(id, { cinematic = true, dialogueNode = null, arrive = false } = {}) {
  disposeHarvestFx();
  clearScene();
  activeCine = null;
  aerialLocked = false;
  sceneId = id;
  world = buildScene(id);
  chapterId = world.chapterId || CHAPTERS.find((c) => c.scene === id)?.id || id;
  NPCS = npcsFromWorld(world, id);
  $('chapter').textContent = world.chapterLabel || 'Бүлэг';
  const stealthOn = !!(world.stealth && world.stealth.torches);
  $('stealthHint').classList.toggle('hidden', !stealthOn);

  const sp = world.startPos || new THREE.Vector3(0, 0, 10);
  player.pos.set(sp.x, sp.y, sp.z);
  // Face camp / sun (north-ish) for f03 rider framing
  player.yaw = id === 'camp' ? 0.05 : 0.15;
  mover.reset();

  // ---- Harvest FX (gated by quality tier) ----
  if (!id.includes('ger') && quality.mist) {
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
  if (!id.includes('ger') && quality.motes > 0) {
    try {
      const base = id === 'camp' ? quality.motes : Math.max(12, (quality.motes * 0.6) | 0);
      motes = createSteppeMotes(base);
      scene.add(motes.group);
      motes.setWind?.(id === 'burkhan' ? 1.2 : 0.35, id === 'burkhan' ? 0.46 : 0.12);
    } catch (e) {
      console.warn('[harvest motes]', e);
      motes = null;
    }
  }
  if (id === 'camp' || (quality.birds && id === 'burkhan')) {
    try {
      birds = createBirds(scene, {
        count: id === 'camp' ? 4 : (quality.birdCount || 3),
        center: id === 'camp' ? [1, 3, 8] : [0, 8, -20],
        radius: id === 'camp' ? 14 : 28,
        height: id === 'camp' ? 6 : 34,
        span: id === 'camp' ? 3.4 : 2,
        color: id === 'camp' ? '#1a120c' : undefined,
        speed: id === 'camp' ? 6 : 7,
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

  audio.setChapter?.(id === 'taichiud_capture' || id === 'taichiud_escape' || id === 'taichiud_river' || id === 'taichiud_ger' ? 'camp' : id);
  audio.setMode?.(audioModeFor(id));
  audio.setWind?.(id === 'burkhan' ? 1.45 : 1);
  applyGrade(id);

  const groundY = world.heightAt(sp.x, sp.z);
  const look = sceneLook(id, sp.x, sp.z);
  cam.view.pitch = look.pitch;
  cam.view.distance = look.distance;
  cam.view.height = look.height;
  camera.far = quality.camFar || 420;
  camera.updateProjectionMatrix();
  cam.snapTo(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw, look.pitch);

  if (arrive && id === 'camp' && world.aerialView) {
    state = 'cine';
    $('hud').classList.remove('hidden');
    $('dialogue').classList.add('hidden');
    const play = settlePlayCamera(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw);
    const aerial = world.aerialView;
    pathCine.setPath({
      positions: [
        [aerial.eye.x, aerial.eye.y, aerial.eye.z],
        [(aerial.eye.x + play.eye.x) * 0.5, aerial.eye.y * 0.42 + 5, (aerial.eye.z + play.eye.z) * 0.5],
        [play.eye.x, play.eye.y, play.eye.z],
      ],
      targets: [
        [aerial.look.x, aerial.look.y, aerial.look.z],
        [sp.x, groundY + 1.6, sp.z - 14],
        [play.lookAt.x, play.lookAt.y, play.lookAt.z],
      ],
      duration: 2.4,
      fov: 50,
      closed: false,
      entry: 0.35,
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
        settlePlayCamera(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw);
        activeCine = null;
        state = 'explore';
      },
    });
    activeCine = pathCine;
  } else if (cinematic) {
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
          cam.snapTo(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw, 0.22);
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
  if (state === 'cine' && (e.code === 'Space' || e.code === 'Enter') && activeCine?.skip) {
    activeCine.skip();
  }
  if (e.code === 'KeyE' && state === 'explore') {
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
  return NPCS.find((n) => n.obj && dist(n.obj) < r) || null;
}
function nearSet(r = 4.2) {
  return new Set(NPCS.filter((n) => n.obj && dist(n.obj) < r).map((n) => n.obj));
}
function talk(n) {
  talkTarget = n.obj;
  if (sceneId === 'camp' && n.obj === world?.hoelun) {
    const f = campFlags();
    if (!f.metHoelun) return startDialogue('start');
    if (!f.chirhaSeen) return startDialogue('camp_wait');
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

function showTitle() {
  state = 'title';
  $('hud').classList.add('hidden');
  $('dialogue').classList.add('hidden');
  $('chapters').classList.add('hidden');
  $('chapters').classList.remove('settling', 'settled');
  const title = $('title');
  title.classList.remove('hidden', 'settling', 'settled', 'fade-out');
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

function renderChapterSelect() {
  const list = $('chapterList');
  list.innerHTML = '';
  save = loadSave();
  for (const ch of CHAPTERS) {
    const unlocked = save.unlocked.includes(ch.id) || ch.id === 'camp';
    const b = document.createElement('button');
    b.type = 'button';
    const here = save.lastChapter === ch.id;
    b.className = 'chapter-card' + (unlocked ? '' : ' locked') + (here ? ' here' : '');
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

function beginCamp({ cinematic, dialogueNode, arrive = false }) {
  audio.unlock();
  writeSave({ unlocked: ['camp'], lastChapter: 'camp', flags: {}, quality: qualityId });
  save = loadSave();
  const title = $('title');
  title.classList.add('fade-out');
  setTimeout(() => {
    title.classList.add('hidden');
    title.classList.remove('fade-out');
    $('hud').classList.remove('hidden');
    $('chapter').textContent = dialogueNode ? '0 бүлэг · Удиртгал' : 'I бүлэг · Өнчин өдрүүд';
    loadScene('camp', { cinematic, dialogueNode, arrive });
  }, 200);
}
$('fastPlayBtn').onclick = () => {
  setQuality('low', { manual: true, reloadScene: false });
  beginCamp({ cinematic: false, dialogueNode: null, arrive: true });
};
$('startBtn').onclick = () => beginCamp({ cinematic: true, dialogueNode: 'intro0' });
$('continueBtn').onclick = () => {
  audio.unlock();
  $('title').classList.add('hidden');
  const ch = CHAPTERS.find((c) => c.id === save.lastChapter) || CHAPTERS[0];
  loadScene(ch.scene, { cinematic: true });
};
$('chaptersBtn').onclick = () => {
  $('title').classList.add('hidden');
  const panel = $('chapters');
  panel.classList.remove('hidden', 'settled');
  panel.classList.add('settling');
  renderChapterSelect();
  requestAnimationFrame(() => panel.classList.add('settled'));
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
  if (sceneId !== 'camp' || state === 'title' || state === 'end') {
    el.classList.add('hidden');
    return;
  }
  const f = campFlags();
  let text = 'Өэлүн эх дээр очиж E дар';
  if (f.metHoelun && !f.chirhaSeen) text = 'Чирха өвгөнийг олж E дар';
  else if (f.chirhaSeen && !campTaskDone()) text = 'Өэлүн эх дээр буцаж очоод E дар';
  else if (campTaskDone()) text = 'Бүлэг дууслаа';
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

function startDialogue(id) {
  state = 'dialogue';
  $('prompt').classList.add('hidden');
  $('dialogue').classList.remove('hidden');
  audio.duck?.(0.4, 0.5);
  birds?.startle?.();
  show(id);
}

function show(id) {
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
      return show(campFlags().chirhaSeen ? 'ask' : 'camp_wait');
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
  $('text').textContent = node.text;
  const box = $('choices');
  box.innerHTML = '';
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

function presentChapter(card) {
  audio.duck?.(0.35, 0.5);
  $('warmGrade')?.classList.add('arriving');
  setTimeout(() => {
    $('warmGrade')?.classList.remove('arriving');
    endCard(card);
  }, 420);
}

function endCard({ eyebrow, title, body, button, onNext, memory }) {
  state = 'end';
  $('dialogue').classList.add('hidden');
  $('hud').classList.add('hidden');
  const o = $('title');
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
  o.classList.remove('hidden', 'settled');
  o.classList.add('settling');
  requestAnimationFrame(() => o.classList.add('settled'));
  $('nextBtn').onclick = onNext;
}

function endCampSlice() {
  save = unlockNext('camp', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Өнчин өдрүүд',
    body: NEXT_TEASER,
    button: 'Бурхан халдун →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('burkhan', { cinematic: true }); flag = null; },
  });
}
function endBurkhanSlice() {
  save = unlockNext('burkhan', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Бурхан халдун',
    body: TAICHIUD_TEASER,
    button: 'Тайчууд олзлолт →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('taichiud_capture', { cinematic: true }); flag = null; },
  });
}
function endTaichiudSlice() {
  save = unlockNext('taichiud', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Тайчууд · чөлөөлөлт',
    body: ACT2_TEASER,
    button: 'II бүлэг →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('act2', { cinematic: true }); flag = null; },
  });
}
function endAct2Slice() {
  save = unlockNext('act2', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Боорчи · Бөртэ',
    body: ACT3_TEASER,
    button: 'III бүлэг →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('act3', { cinematic: true }); flag = null; },
  });
}
function endAct3Slice() {
  save = unlockNext('act3', CHAPTER_ORDER);
  presentChapter({
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
      startDialogue('taichiud_spotted');
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
    if (world?.update) {
      const gy = world.heightAt?.(player.pos.x, player.pos.z);
      if (world.temujin && gy != null) {
        player.pos.y = gy;
        world.temujin.position.set(player.pos.x, gy, player.pos.z);
      }
      world.update(dt, t, null, player.pos, false);
    }
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
    const lim = sceneId === 'burkhan' ? 45 : sceneId.includes('ger') ? 8 : 50;
    const result = mover.step(
      dt,
      {
        forward: !!(keys.KeyW || keys.ArrowUp),
        back: !!(keys.KeyS || keys.ArrowDown),
        left: !!keys.KeyA,
        right: !!keys.KeyD,
      },
      resolveCollisions,
      { min: -lim, max: lim }
    );
    moving = result.moving;
    moveSpeed = result.speed || 0;
    player.bob += dt * (moving ? 8.5 : 1.6);
    checkStealth(dt);

    const n = nearest();
    $('prompt').classList.toggle('hidden', !n);
    if (n) $('prompt').textContent = `[E] ${n.name}`;
  } else {
    moving = false;
    moveSpeed = 0;
  }

  const groundY = heightAt(player.pos.x, player.pos.z);
  player.pos.y = groundY;
  temujin.position.set(player.pos.x, groundY, player.pos.z);
  {
    const face = cam.yaw + Math.PI;
    let dy = face - temujin.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    temujin.rotation.y += dy * Math.min(1, dt * 8);
  }
  if (world.hoelun) world.hoelun.userData.talking = state === 'dialogue' && talkTarget === world.hoelun;
  temujin.userData.setMoving?.(moving && state === 'explore');
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
    const look = state === 'explore' ? sceneLook(sceneId, player.pos.x, player.pos.z) : null;
    cam.update(dt, player.pos, {
      faceYaw,
      dialoguePull: faceYaw != null ? 3.2 : 0,
      frame: look,
    });
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

window.__mshLoadScene = (id) => loadScene(id, { cinematic: false });
window.__mshShow = show;
window.__mshStartDialogue = startDialogue;
window.__mshSetQuality = (id) => setQuality(id, { manual: true, reloadScene: true });
window.__mshPerf = () => {
  renderer.render(scene, camera);
  return {
    fps: fpsEma,
    tier: qualityId,
    shadows: renderer.shadowMap.enabled,
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
  distance: cam.view.distance, pitch: cam.view.pitch,
  camY: camera.position.y, camZ: camera.position.z,
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
