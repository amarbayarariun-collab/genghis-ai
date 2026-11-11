// Монголын Нууц Товчоо · Тэмүжин v1 — Sumiro-style chapters + Taichiud + GLB Temüjin.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWorld } from './world.js';
import {
  STORY, SOURCES, END_LINES, CHAPTERS, CREDITS,
  NEXT_TEASER, TAICHIUD_TEASER, ACT2_TEASER, ACT3_TEASER, JAMUKHA_TEASER, MVP_DONE,
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
import { createTheme } from './systems/theme.js';
import { createSfx } from './systems/audio.js';
import { createCoach } from './systems/coach.js';
import { createFieldTasks } from './systems/field-tasks.js';
import { createLocomotionFSM } from './systems/harvest/anim-state-machine.js';
import { createAdaptiveQuality } from './systems/harvest/lod-instancing.js';
import { qualityPreset, pickTierFromAvgMs, applyRendererQuality, QUALITY_TIERS } from './systems/quality.js';
import { loadSave, writeSave, unlockNext } from './save.js';
import { createInkGrade } from './systems/sumiro/ink-grade.js';
import { createMistField } from './systems/sumiro/mist-field.js';
import { createFootStains } from './systems/sumiro/foot-stains.js';
import { createEncounter } from './systems/sumiro/encounter.js';
import { createCrows } from './systems/sumiro/crows.js';
import { horse, person, seatRider } from './world-kit.js';
import { ridingTemujin } from './characters/temujin.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // cheaper; CSS warmGrade softens edges
  // iPad Safari runs much slower with high-performance, and sometimes refuses the context.
  powerPreference: 'default',
  stencil: false,
  depth: true,
  failIfMajorPerformanceCaveat: false,
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
let fpsEma = 0;
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
  const fpsText = fpsEma > 0 ? `${Math.round(fpsEma)} fps` : '-- fps';
  el.textContent = `${fpsText} · ${quality.label} · draw ${info.render.calls} · tri ${info.render.triangles} · pr ${renderer.getPixelRatio().toFixed(2)}`;
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
    targetMs: id === 'low' ? 33 : id === 'high' ? 16.7 : 22,
    min: id === 'low' ? 0.5 : 0.75,
    max: quality.pixelRatioCap,
    every: id === 'low' ? 0.7 : 2,
    steps: id === 'low' ? [0.5, 0.75, 1] : id === 'med' ? [0.75, 1, 1.25] : [1, 1.25],
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

function paint(time = 0) {
  if (fxOn && inkGrade) inkGrade.render(scene, camera, time);
  else renderer.render(scene, camera);
}

function clearHeavyFx() {
  inkGrade?.dispose?.();
  inkGrade = null;
  mistField?.dispose?.();
  mistField = null;
  crowFlock?.dispose?.();
  crowFlock = null;
  footStains?.dispose?.();
  footStains = null;
}

function syncHeavyFx() {
  if (!fxOn || !world) {
    clearHeavyFx();
    return;
  }
  if (!inkGrade) {
    try { inkGrade = createInkGrade(renderer); }
    catch (e) { console.warn('[ink grade]', e); inkGrade = null; }
  }
  if (!mistField && sceneId !== 'taichiud_ger') {
    try { mistField = createMistField(scene); }
    catch (e) { console.warn('[mist field]', e); mistField = null; }
  }
  if (!crowFlock && (sceneId === 'camp' || sceneId === 'burkhan')) {
    try { crowFlock = createCrows(scene, camera); }
    catch (e) { console.warn('[crows]', e); crowFlock = null; }
  }
  if (!footStains) {
    try { footStains = createFootStains(scene, (x, z) => world.heightAt?.(x, z) ?? 0); }
    catch (e) { console.warn('[stains]', e); footStains = null; }
  }
}

function setFx(on) {
  fxOn = !!on;
  const btn = $('fxToggle');
  if (btn) btn.setAttribute('aria-pressed', fxOn ? 'true' : 'false');
  syncHeavyFx();
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
const theme = createTheme();
const sfx = createSfx();
const coach = createCoach($('coach'));
let resumeAcc = 0;
let hoofAcc = 0;
let sfxTimer = 0;
audio.attachUnlock?.();
const simpleCine = createSimpleCine(camera, { duration: 2.8 });
const pathCine = createPathCine(camera, ONON_INTRO);
let activeCine = null; // { update, active, skip? }
const keys = {};
let world = null;
let sceneId = 'camp';
let primedCamp = false;
let campBootStarted = false;
let chapterId = 'camp';
let NPCS = [];
let harvestMist = null;
let motes = null;
let birds = null;
let dust = null;
let fxOn = false;
let inkGrade = null;
let mistField = null;
let crowFlock = null;
let footStains = null;
let encounter = null;
let fLatch = false;
let toastText = '';
let horsesChimed = false;
const sceneMod = {};
let promptText = '';
let fTouch = false;
let qTouch = false;
let fieldTasks = null;
const touchWish = { x: 0, y: 0 };
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
let shotLock = false;
let mounted = false;
let playerHorse = null;
let flag = null;
let chapterEndTimer = 0;
let talkTarget = null;
let spottedCooldown = 0;

const PLAYER_RADIUS = 0.3;
CHAPTERS.push({ id: 'jamukha', scene: 'jamukha', title: 'IV · Жамухатай зөрчил', blurb: 'Шөнийн салгалт · гурван айл', source: '§118' });
const CHAPTER_ORDER = CHAPTERS.map((c) => c.id);

function resolveCollisions(p) {
  const list = world?.colliders || [];
  for (let pass = 0; pass < 2; pass++) {
    for (const c of list) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + PLAYER_RADIUS;
      if (d < min && d > 1e-4) {
        p.x += (dx / d) * (min - d);
        p.z += (dz / d) * (min - d);
      } else if (d < 1e-5) p.x += min;
    }
  }
}

function buildScene(id) {
  const qOpts = { quality };
  if (id === 'burkhan') return sceneMod.burkhan(scene);
  if (id === 'act2') return sceneMod.act2(scene);
  if (id === 'horses') return sceneMod.horses(scene);
  if (id === 'jamukha') return sceneMod.jamukha(scene);
  if (id === 'act3') return sceneMod.act3(scene);
  if (id === 'taichiud_capture') return sceneMod.taichiud.buildTaichiudCapture(scene);
  if (id === 'taichiud_escape') return sceneMod.taichiud.buildTaichiudEscape(scene);
  if (id === 'taichiud_river') return sceneMod.taichiud.buildTaichiudRiver(scene);
  if (id === 'taichiud_ger') return sceneMod.taichiud.buildTaichiudGer(scene);
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
  if (id === 'taichiud_escape' || id === 'taichiud_capture' || id === 'taichiud_river' || id === 'act3' || id === 'jamukha') return 'night';
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
  if (id === 'camp') return blend(0.2, -2, 6, 28, 3.6, 8.8, 0.18, 0.3, 1.32, 1.7);
  if (id === 'burkhan') return blend(0, -10, 7, 26, 7.4, 12.4, 0.1, 0.2, 1.85, 2.25);
  if (id === 'taichiud_capture') return blend(0, 2, 5, 18, 4.6, 7.4, 0.08, 0.16, 1.4, 1.55);
  if (id === 'taichiud_escape') return blend(-1, 2, 4, 16, 4.1, 6.4, 0.06, 0.12, 1.28, 1.42);
  if (id === 'taichiud_river') return blend(0, 0, 4, 18, 5.4, 9.0, 0.08, 0.16, 1.45, 1.7);
  if (id === 'taichiud_ger') return { distance: 4.1, pitch: 0.07, height: 1.22 };
  if (id === 'act2') return blend(0, 0, 8, 28, 5.6, 9.6, 0.12, 0.22, 1.6, 1.9);
  if (id === 'horses' || id === 'jamukha') return blend(0, 4, 6, 24, 5.2, 9.2, 0.12, 0.22, 1.5, 1.85);
  if (id === 'act3') return blend(0, 0, 5, 18, 4.3, 6.6, 0.08, 0.14, 1.35, 1.5);
  return { distance: 5, pitch: 0.22, height: 1.55 };
}

function applyGrade(id) {
  const grade = $('warmGrade');
  if (!grade) return;
  grade.classList.remove('grade-camp', 'grade-burkhan', 'grade-taichiud', 'grade-act2', 'grade-act3');
  const name = id === 'burkhan' ? 'grade-burkhan'
    : id.startsWith('taichiud') ? 'grade-taichiud'
    : id === 'act2' || id === 'horses' ? 'grade-act2'
    : id === 'act3' || id === 'jamukha' ? 'grade-act3'
    : 'grade-camp';
  grade.classList.add(name);
}

function afterCine(id, dialogueNode) {
  if (dialogueNode) startDialogue(dialogueNode);
  else if (id === 'burkhan') startDialogue('burkhan_start');
  else if (id === 'act2' || id === 'horses' || id === 'jamukha') state = 'explore';
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
  encounter?.dispose?.();
  encounter = null;
  clearHeavyFx();
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

function clearMount() {
  mounted = false;
  if (playerHorse) {
    scene.remove(playerHorse);
    playerHorse.traverse?.((c) => {
      c.geometry?.dispose?.();
      const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
      mats.forEach((m) => m.dispose?.());
    });
    playerHorse = null;
  }
  if (world?.temujin) world.temujin.visible = true;
  const pace = $('pace');
  if (pace) {
    pace.textContent = '';
    pace.classList.add('hidden');
  }
}

function playCampArrival() {
  const sp = world.startPos || new THREE.Vector3(0, 0, 10);
  state = 'cine';
  $('hud')?.classList.remove('hidden');
  $('dialogue')?.classList.add('hidden');
  const standZ = 5.2;
  const standY = world.heightAt(sp.x, standZ);
  player.pos.set(sp.x, standY, standZ);
  player.yaw = 0.04;
  if (world.temujin) world.temujin.position.set(sp.x, standY, standZ);
  const play = settlePlayCamera(player.pos, player.yaw);
  const aerial = world.aerialView;
  pathCine.setPath({
    positions: [
      [aerial.eye.x, aerial.eye.y, aerial.eye.z],
      [(aerial.eye.x + play.eye.x) * 0.5, aerial.eye.y * 0.42 + 5, (aerial.eye.z + play.eye.z) * 0.5],
      [play.eye.x, play.eye.y, play.eye.z],
    ],
    targets: [
      [aerial.look.x, aerial.look.y, aerial.look.z],
      [sp.x, standY + 1.5, standZ - 6],
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
      player.pos.set(sp.x, standY, standZ);
      player.yaw = 0.04;
      settlePlayCamera(player.pos, player.yaw);
      activeCine = null;
      state = 'explore';
    },
  });
  activeCine = pathCine;
}

function loadScene(id, opts = {}) {
  const arriveMod = (key, mod) => { sceneMod[key] = mod; loadScene(id, opts); };
  if (id === 'burkhan' && !sceneMod.burkhan) {
    import('./scenes/burkhan.js').then((m) => arriveMod('burkhan', m.buildBurkhanWorld), console.error);
    return;
  }
  if (id === 'act2' && !sceneMod.act2) {
    import('./scenes/act2.js').then((m) => arriveMod('act2', m.buildAct2World), console.error);
    return;
  }
  if (id === 'horses' && !sceneMod.horses) {
    import('./scenes/horses.js').then((m) => arriveMod('horses', m.buildHorsesWorld), console.error);
    return;
  }
  if (id === 'jamukha' && !sceneMod.jamukha) {
    import('./scenes/jamukha.js').then((m) => arriveMod('jamukha', m.buildJamukhaWorld), console.error);
    return;
  }
  if (id === 'act3' && !sceneMod.act3) {
    import('./scenes/act3.js').then((m) => arriveMod('act3', m.buildAct3World), console.error);
    return;
  }
  if (id.startsWith('taichiud') && !sceneMod.taichiud) {
    import('./scenes/taichiud.js').then((m) => arriveMod('taichiud', m), console.error);
    return;
  }
  const { cinematic = true, dialogueNode = null, arrive = false, resume = null } = opts;
  primedCamp = false;
  campBootStarted = true;
  clearTimeout(chapterEndTimer);
  fieldTasks?.dispose();
  fieldTasks = null;
  horsesChimed = false;
  clearMount();
  toastText = '';
  const toast = $('toast');
  if (toast) {
    toast.textContent = '';
    toast.classList.add('hidden');
  }
  $('end')?.classList.add('hidden');
  disposeHarvestFx();
  clearScene();
  activeCine = null;
  aerialLocked = false;
  sceneId = id;
  world = buildScene(id);
  if (id === 'camp') fieldTasks = createFieldTasks(scene, world.heightAt);
  chapterId = world.chapterId || CHAPTERS.find((c) => c.scene === id)?.id || id;
  NPCS = npcsFromWorld(world, id);
  $('chapter').textContent = world.chapterLabel || 'Бүлэг';
  const stealthOn = !!(world.stealth && world.stealth.torches);
  $('stealthHint').classList.toggle('hidden', !stealthOn);

  const sp = world.startPos || new THREE.Vector3(0, 0, 10);
  player.pos.set(sp.x, sp.y, sp.z);
  // Face camp / sun (north-ish) for f03 rider framing
  player.yaw = id === 'camp' ? 0.05 : 0.15;
  if (resume && resume.scene === id) {
    player.pos.set(resume.x, sp.y, resume.z);
    player.yaw = resume.yaw || player.yaw;
  }
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
        count: id === 'camp' ? (quality.birds ? 4 : 2) : (quality.birdCount || 3),
        center: id === 'camp' ? [1, 3, 8] : [0, 8, -20],
        radius: id === 'camp' ? 16 : 28,
        height: id === 'camp' ? (quality.birds ? 9 : 16) : 34,
        span: id === 'camp' ? (quality.birds ? 2.2 : 1.35) : 2,
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
  if (id === 'camp') {
    try { encounter = createEncounter(scene, world); }
    catch (e) { console.warn('[encounter]', e); encounter = null; }
  }
  if (fxOn) syncHeavyFx();

  const groundY = world.heightAt(sp.x, sp.z);
  const look = sceneLook(id, sp.x, sp.z);
  cam.view.pitch = look.pitch;
  cam.view.distance = look.distance;
  cam.view.height = look.height;
  camera.far = quality.camFar || 420;
  camera.updateProjectionMatrix();
  cam.snapTo(new THREE.Vector3(sp.x, groundY, sp.z), player.yaw, look.pitch);

  if (arrive && id === 'camp' && world.aerialView) {
    playCampArrival();
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

  // The title preloads camp behind the painting. That must not replace a saved chapter.
  if (opts.remember !== false) writeSave({ lastChapter: chapterId });
}

// Let the title paint before the camp file starts. The first fast start reuses it.
state = 'title';
$('end')?.classList.add('hidden');
$('hud').classList.add('hidden');
function bootCampAfterPaint() {
  if (campBootStarted) return;
  campBootStarted = true;
  loadScene('camp', { cinematic: false, remember: false });
  primedCamp = true;
  state = 'title';
  $('end')?.classList.add('hidden');
  $('hud').classList.add('hidden');
}
requestAnimationFrame(() => requestAnimationFrame(() => {
  bootCampAfterPaint();
  theme.warm?.();
}));

addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
    e.preventDefault();
  }
  keys[e.code] = true;
  if (e.code === 'KeyF' && !e.repeat) fTouch = true;
  if (e.code === 'KeyQ' && !e.repeat) qTouch = true;
  if (e.code === 'F3') {
    showPerf = !showPerf;
    $('fpsToggle')?.setAttribute('aria-pressed', showPerf ? 'true' : 'false');
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
    finishCoach(coach.note('talk'));
    const n = nearest();
    if (n) talk(n);
  }
  if (e.code === 'KeyF' && !e.repeat && state === 'explore') setMounted(!mounted);
  if (e.code === 'KeyM' && !e.repeat && state === 'explore') setMounted(!mounted);
});
$('fxToggle')?.addEventListener('click', () => setFx(!fxOn));
$('fpsToggle')?.addEventListener('click', (ev) => {
  ev.stopPropagation();
  showPerf = !showPerf;
  $('fpsToggle').setAttribute('aria-pressed', showPerf ? 'true' : 'false');
  updatePerfHud(true);
});
$('touchTalk')?.addEventListener('click', (ev) => {
  ev.stopPropagation();
  if (state !== 'explore') return;
  finishCoach(coach.note('talk'));
  const n = nearest();
  if (n) talk(n);
});
$('touchBrace')?.addEventListener('click', (ev) => {
  ev.stopPropagation();
  fTouch = true;
});
$('bowBtn')?.addEventListener('click', (ev) => {
  ev.stopPropagation();
  qTouch = true;
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
  if (e.pointerType === 'touch') return;
  if (!dragging || state !== 'explore') return;
  cam.lookDelta(e.clientX - lx, e.clientY - ly);
  player.yaw = cam.yaw;
  lx = e.clientX; ly = e.clientY;
});

const touchPoints = new Map();
canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    const role = t.clientX < innerWidth * 0.46 ? 'move' : 'look';
    touchPoints.set(t.identifier, { role, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY });
  }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (state !== 'explore') return;
  for (const t of e.changedTouches) {
    const k = touchPoints.get(t.identifier);
    if (!k) continue;
    if (k.role === 'look') {
      cam.lookDelta((t.clientX - k.x) * 1.4, (t.clientY - k.y) * 1.4);
      player.yaw = cam.yaw;
    }
    k.x = t.clientX;
    k.y = t.clientY;
    if (k.role === 'move') {
      touchWish.x = Math.max(-1, Math.min(1, (k.x - k.x0) / 72));
      touchWish.y = Math.max(-1, Math.min(1, -(k.y - k.y0) / 72));
    }
  }
}, { passive: true });
const endTouch = (e) => {
  for (const t of e.changedTouches) {
    const k = touchPoints.get(t.identifier);
    if (k?.role === 'move') touchWish.x = touchWish.y = 0;
    touchPoints.delete(t.identifier);
  }
};
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

const stick = $('stick');
const stickKnob = $('stickKnob');
if (stick && stickKnob) {
  const moveStick = (clientX, clientY) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = r.width * 0.36;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, max);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchWish.x = dx / max;
    touchWish.y = -dy / max;
  };
  const resetStick = () => {
    stickKnob.style.transform = '';
    touchWish.x = 0;
    touchWish.y = 0;
  };
  stick.addEventListener('pointerdown', (e) => {
    if (!document.body.classList.contains('in-play')) return;
    stick.setPointerCapture?.(e.pointerId);
    moveStick(e.clientX, e.clientY);
    e.stopPropagation();
  });
  stick.addEventListener('pointermove', (e) => {
    if (!stick.hasPointerCapture?.(e.pointerId)) return;
    moveStick(e.clientX, e.clientY);
  });
  stick.addEventListener('pointerup', resetStick);
  stick.addEventListener('pointercancel', resetStick);
}

function setMounted(on) {
  if (!world?.temujin) return;
  if (state !== 'explore' && state !== 'dialogue') return;
  if (!!on === mounted) return;
  if (!on) {
    clearMount();
    return;
  }
  const h = horse('#6b4228');
  const y = world.heightAt?.(player.pos.x, player.pos.z) ?? 0;
  h.position.set(player.pos.x, y, player.pos.z);
  h.rotation.y = world.temujin.rotation.y;
  const rider = ridingTemujin(world.temujin) || person({ deel: '#9a1e24', fur: '#e8d4b0', hat: '#5c3b24' });
  seatRider(h, rider);
  // seatRider clears rotation. The sculpt's face is +Z; the horse faces +X.
  if (rider.userData.sculpt) rider.rotation.y = Math.PI / 2;
  scene.add(h);
  playerHorse = h;
  mounted = true;
  world.temujin.visible = false;
  finishCoach(coach.note('mount'));
  persistResume();
}

const ray = new THREE.Raycaster();
canvas.addEventListener('click', (e) => {
  if (state !== 'explore') return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const n of NPCS) {
    if (n.obj && ray.intersectObject(n.obj, true).length && dist(n.obj) < 8) return talk(n);
  }
});

const _worldPt = new THREE.Vector3();
const dist = (o) => {
  if (!o) return Infinity;
  o.getWorldPosition(_worldPt);
  return Math.hypot(player.pos.x - _worldPt.x, player.pos.z - _worldPt.z);
};
function nearest(r = 3.5) {
  let best = null;
  let bestD = r;
  for (const n of NPCS) {
    if (!n.obj) continue;
    const d = dist(n.obj);
    if (d < bestD) {
      best = n;
      bestD = d;
    }
  }
  return best;
}
function nearSet(r = 4.2) {
  return new Set(NPCS.filter((n) => n.obj && dist(n.obj) < r).map((n) => n.obj));
}
function talk(n) {
  talkTarget = n.obj;
  if (sceneId === 'horses' || sceneId === 'jamukha') {
    const text = world?.blurb?.() || '';
    toastText = text;
    const toast = $('toast');
    if (toast) {
      toast.textContent = text;
      toast.classList.remove('hidden');
    }
    return;
  }
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

function finishCoach(done) {
  if (!done) return;
  save = writeSave({ tutorialDone: true });
}

function flashSfx(name) {
  if (!name || theme.muted) return;
  const el = $('sfxMark');
  if (!el) return;
  el.textContent = name;
  el.classList.remove('hidden');
  clearTimeout(sfxTimer);
  sfxTimer = setTimeout(() => el.classList.add('hidden'), 6000);
}

function persistResume() {
  if (!sceneId || state === 'title') return;
  save = writeSave({
    lastChapter: chapterId,
    resume: {
      scene: sceneId,
      x: Math.round(player.pos.x * 10) / 10,
      z: Math.round(player.pos.z * 10) / 10,
      yaw: Math.round(player.yaw * 100) / 100,
      mounted,
    },
  });
}

function continueFromTitle() {
  const end = $('end');
  if (end) {
    end.classList.add('hidden');
    end.innerHTML = '';
  }
  save = loadSave();
  try { audio.unlock(); sfx.unlock(); theme.start(); } catch (err) { console.warn('[audio]', err); }
  $('title')?.classList.add('hidden');
  $('hud')?.classList.remove('hidden');
  document.body.classList.add('in-play');
  const resume = save.resume;
  const ch = CHAPTERS.find((c) => c.id === save.lastChapter) || CHAPTERS[0];
  const sceneName = resume?.scene || ch.scene;
  loadScene(sceneName, { cinematic: false, dialogueNode: null, arrive: false, resume });
  if (resume?.mounted) setMounted(true);
  state = 'explore';
  if ($('end') && !$('end').classList.contains('hidden')) {
    $('end').classList.add('hidden');
    $('end').innerHTML = '';
  }
}

function showTitle() {
  state = 'title';
  $('hud').classList.add('hidden');
  $('dialogue').classList.add('hidden');
  $('chapters').classList.add('hidden');
  $('chapters').classList.remove('settling', 'settled');
  const end = $('end');
  if (end) {
    end.classList.add('hidden');
    end.innerHTML = '';
  }
  const title = $('title');
  title.classList.remove('hidden', 'settling', 'settled', 'fade-out');
  refreshContinue();
}

function refreshContinue() {
  const btn = $('continueBtn');
  btn.classList.remove('hidden');
  if (save.lastChapter) {
    btn.textContent = `Үргэлжлүүлэх · ${CHAPTERS.find((c) => c.id === save.lastChapter)?.title || ''}`;
  } else {
    btn.textContent = 'Үргэлжлүүлэх';
  }
}
refreshContinue();

function renderChapterSelect() {
  const list = $('chapterList');
  list.innerHTML = '';
  save = loadSave();
  for (const ch of CHAPTERS) {
    const unlocked = save.unlocked.includes(ch.id) || ch.id === 'camp' || ch.id === 'horses' || ch.id === 'jamukha';
    const b = document.createElement('button');
    b.type = 'button';
    const here = save.lastChapter === ch.id;
    b.className = 'chapter-card' + (unlocked ? '' : ' locked') + (here ? ' here' : '');
    b.disabled = !unlocked;
    b.innerHTML = `<span class="ch-title">${ch.title}</span><span class="ch-blurb">${ch.blurb}</span><span class="ch-src">${ch.source}</span>`;
    b.onclick = () => {
      $('chapters').classList.add('hidden');
      $('title').classList.add('hidden');
      try { audio.unlock(); sfx.unlock(); theme.start(); } catch (err) { console.warn('[audio]', err); }
      loadScene(ch.scene, { cinematic: true });
    };
    list.append(b);
  }
}

function beginCamp({ cinematic, dialogueNode, arrive = false }) {
  // Audio must not be able to cancel the tap. iPad Safari throws from resume().
  try { audio.unlock(); sfx.unlock(); theme.start(); }
  catch (err) { console.warn('[audio]', err); }
  writeSave({ unlocked: ['camp'], lastChapter: 'camp', flags: {}, quality: qualityId, resume: null });
  save = loadSave();
  const title = $('title');
  title.classList.add('fade-out');
  const reuse = arrive && !cinematic && !dialogueNode && primedCamp && sceneId === 'camp' && !!world?.aerialView;
  if (reuse) primedCamp = false;
  setTimeout(() => {
    title.classList.add('hidden');
    title.classList.remove('fade-out');
    $('hud').classList.remove('hidden');
    $('chapter').textContent = dialogueNode ? '0 бүлэг · Удиртгал' : 'I бүлэг · Өнчин өдрүүд';
    const live = arrive && !cinematic && !dialogueNode && sceneId === 'camp' && world?.aerialView;
    if (reuse || live) {
      primedCamp = false;
      playCampArrival();
      return;
    }
    loadScene('camp', { cinematic, dialogueNode, arrive });
  }, 200);
}
function bindTap(el, fn) {
  if (!el) return;
  let last = 0;
  const run = () => {
    const now = performance.now();
    if (now - last < 450) return;
    last = now;
    fn();
  };
  // pointerdown so a phone tap starts the game even when pointerup never arrives.
  el.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.stopPropagation();
    run();
  });
  el.addEventListener('pointerup', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.stopPropagation();
    run();
  });
  el.addEventListener('click', (ev) => {
    ev.stopPropagation();
    run();
  });
}
// iPad Chrome can deliver the touch to the canvas even when a button is painted on top.
addEventListener('touchend', (ev) => {
  if (document.body.classList.contains('in-play')) return;
  const t = ev.changedTouches?.[0];
  if (!t) return;
  const el = document.elementFromPoint(t.clientX, t.clientY);
  const btn = el?.closest?.('button');
  if (!btn || btn.disabled || btn.contains(ev.target)) return;
  btn.dispatchEvent(new Event('pointerup', { bubbles: true }));
}, { passive: true });
bindTap($('mountBtn'), () => setMounted(!mounted));
const muteBtn = $('muteBtn');
if (muteBtn) {
  const paintMute = (muted) => {
    muteBtn.textContent = 'Дуу';
    muteBtn.classList.toggle('is-off', muted);
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', muted ? 'Дуу хаагдсан' : 'Дуу');
  };
  paintMute(theme.muted);
  bindTap(muteBtn, () => paintMute(theme.toggleMute()));
}
bindTap($('fastPlayBtn'), () => {
  setQuality('low', { manual: true, reloadScene: false });
  beginCamp({ cinematic: false, dialogueNode: null, arrive: true });
});
bindTap($('startBtn'), () => beginCamp({ cinematic: true, dialogueNode: 'intro0' }));
bindTap($('continueBtn'), () => continueFromTitle());
bindTap($('chaptersBtn'), () => {
  $('title').classList.add('hidden');
  const panel = $('chapters');
  panel.classList.remove('hidden', 'settled');
  panel.classList.add('settling');
  renderChapterSelect();
  requestAnimationFrame(() => panel.classList.add('settled'));
  state = 'chapters';
});
bindTap($('chaptersBack'), () => showTitle());
bindTap($('creditsBtn'), () => {
  $('title').classList.add('hidden');
  endCard({
    eyebrow: 'Зохиогчид',
    title: 'Монголын Нууц Товчоо · Тэмүжин',
    body: CREDITS.replace(/\n/g, '<br>'),
    button: 'Нүүр рүү',
    onNext: () => showTitle(),
    memory: '',
  });
});
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
  theme.duck(false);
  const el = document.activeElement;
  if (el && el !== document.body && el !== canvas) el.blur();
  canvas.focus({ preventScroll: true });
  updateObjective();
}

function startDialogue(id) {
  state = 'dialogue';
  promptText = '';
  $('prompt').classList.add('hidden');
  $('dialogue').classList.remove('hidden');
  audio.duck?.(0.4, 0.5);
  theme.duck(true);
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
  theme.duck(true);
  $('warmGrade')?.classList.add('arriving');
  clearTimeout(chapterEndTimer);
  chapterEndTimer = setTimeout(() => {
    $('warmGrade')?.classList.remove('arriving');
    endCard(card);
  }, 420);
}

function endCard({ eyebrow, title, body, button, onNext, memory }) {
  const home = $('title');
  // Never paint the end panel over the title screen, and never because of an old save.
  if (state === 'title' && home && !home.classList.contains('hidden')) return;
  state = 'end';
  $('dialogue').classList.add('hidden');
  $('hud').classList.add('hidden');
  home?.classList.add('hidden');
  const o = $('end');
  if (!o) return;
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
    body: 'Дараа: Найман адуу — хулгайлагдсан адууг Боорчитой нэх (§90).',
    button: 'Найман адуу →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('horses', { cinematic: true }); flag = null; },
  });
}
function endHorsesSlice() {
  save = unlockNext('horses', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Найман адуу',
    body: ACT3_TEASER,
    button: 'III бүлэг →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('act3', { cinematic: true }); flag = null; },
  });
}
function endAct3Slice() {
  save = unlockNext('act3', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Бүлэг дууслаа',
    title: 'Мэргид · Чингис',
    body: JAMUKHA_TEASER,
    button: 'IV бүлэг →',
    onNext: () => { $('title').classList.add('hidden'); loadScene('jamukha', { cinematic: true }); flag = null; },
  });
}
function endJamukhaSlice() {
  save = unlockNext('jamukha', CHAPTER_ORDER);
  presentChapter({
    eyebrow: 'Тоглоом дууслаа',
    title: 'Жамухатай зөрчил',
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
  const frameDt = clock.getDelta();
  const dt = Math.min(frameDt, 0.05);
  const t = clock.elapsedTime;
  document.body.classList.toggle('in-play', state === 'explore' || state === 'cine');

  // The 50 ms cap is only for simulation. The meter counts real frames.
  fpsFrames++;
  fpsWindowT += frameDt;
  if (fpsWindowT >= 0.5 && fpsFrames > 0) {
    fpsEma = fpsFrames / fpsWindowT;
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
      paint(t);
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
    if (fxOn) {
      mistField?.update?.(t);
      crowFlock?.update?.(dt, t, player.pos);
    }
    paint(t);
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
    const stickMag = Math.hypot(touchWish.x, touchWish.y);
    const sprint = !!(keys.ShiftLeft || keys.ShiftRight) || stickMag > 0.85;
    const result = mover.step(
      dt,
      {
        forward: !!(keys.KeyW || keys.ArrowUp) || touchWish.y > 0.28,
        back: !!(keys.KeyS || keys.ArrowDown) || touchWish.y < -0.28,
        left: !!keys.KeyA || touchWish.x < -0.28,
        right: !!keys.KeyD || touchWish.x > 0.28,
        sprint,
        mounted,
      },
      resolveCollisions,
      { min: -lim, max: lim }
    );
    moving = result.moving;
    moveSpeed = result.speed || 0;
    player.bob += dt * (moving ? 8.5 : 1.6);
    checkStealth(dt);
    if (!save.tutorialDone) {
      coach.start();
      if (moving) finishCoach(coach.note('move'));
      if (mounted && sprint && moveSpeed > 6) finishCoach(coach.note('gallop'));
      finishCoach(coach.update(dt));
    } else coach.hide();
    resumeAcc += dt;
    if (resumeAcc > 2) {
      resumeAcc = 0;
      persistResume();
    }

    const fDown = !!(keys.KeyF || fTouch);
    const fEdge = fDown && !fLatch;
    fLatch = fDown;
    fTouch = false;
    const qEdge = !!(keys.KeyQ || qTouch);
    keys.KeyQ = false;
    qTouch = false;
    if (qEdge) {
      finishCoach(coach.note('shoot'));
      if (!theme.muted) flashSfx(sfx.bow());
    }
    if (fieldTasks && sceneId === 'camp') {
      const ft = fieldTasks.update(dt, player.pos, { mounted, yaw: player.yaw, shoot: qEdge });
      const taskEl = $('fieldTasks');
      if (taskEl && state === 'explore') {
        taskEl.textContent = ft.line;
        taskEl.classList.remove('hidden');
      }
      if (ft.just) {
        toastText = ft.just;
        const toast = $('toast');
        if (toast) {
          toast.textContent = ft.just;
          toast.classList.remove('hidden');
        }
        if (!theme.muted) {
          if (ft.just.includes('Они')) flashSfx(sfx.hit());
          flashSfx(sfx.chime());
        }
      }
    } else if ((sceneId === 'horses' || sceneId === 'jamukha') && world?.taskLine) {
      const taskEl = $('fieldTasks');
      const line = world.taskLine();
      if (taskEl && state === 'explore') {
        taskEl.textContent = line;
        taskEl.classList.remove('hidden');
      }
      const status = world.herdStatus?.() || world.taskStatus?.();
      if (status?.done && !horsesChimed) {
        horsesChimed = true;
        toastText = line;
        const toast = $('toast');
        if (toast) {
          toast.textContent = line;
          toast.classList.remove('hidden');
        }
        if (!theme.muted) flashSfx(sfx.chime());
        if (sceneId === 'horses') endHorsesSlice();
        else if (sceneId === 'jamukha') endJamukhaSlice();
      }
    } else {
      $('fieldTasks')?.classList.add('hidden');
    }
    const watchDx = player.pos.x - 9.2;
    const watchDz = player.pos.z - 16.4;
    const enc = (encounter && (fEdge || watchDx * watchDx + watchDz * watchDz < 196))
      ? encounter.update(dt, player.pos, fEdge)
      : null;
    if (enc?.resolved) audio.cue?.('drumFar', -6, false);
    if (encounter && (enc?.toast || '') !== toastText) {
      toastText = enc?.toast || '';
      const toast = $('toast');
      if (toast) {
        toast.textContent = toastText;
        toast.classList.toggle('hidden', !toastText);
      }
    }

    const n = nearest();
    const nextPrompt = n ? `[E] ${n.name}` : (enc?.prompt || '');
    if (nextPrompt !== promptText) {
      promptText = nextPrompt;
      const prompt = $('prompt');
      prompt.textContent = nextPrompt;
      prompt.classList.toggle('hidden', !nextPrompt);
    }
  } else {
    moving = false;
    moveSpeed = 0;
  }

  const groundY = heightAt(player.pos.x, player.pos.z);
  player.pos.y = groundY;
  if (!mounted) temujin.position.set(player.pos.x, groundY, player.pos.z);
  {
    const face = cam.yaw + Math.PI;
    let dy = face - temujin.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    temujin.rotation.y += dy * Math.min(1, dt * 8);
  }
  if (mounted && playerHorse && !shotLock) {
    playerHorse.position.set(player.pos.x, groundY, player.pos.z);
    playerHorse.rotation.y = temujin.rotation.y;
    const gait = playerHorse.userData.step?.(dt, moveSpeed);
    const gap = gait === 'gallop' ? 0.12 : gait === 'canter' ? 0.18 : gait === 'trot' ? 0.28 : gait === 'walk' ? 0.46 : 0;
    if (gap && moving && !theme.muted) {
      hoofAcc += dt;
      if (hoofAcc >= gap) {
        hoofAcc = 0;
        flashSfx(sfx.hoof(gait));
      }
    } else hoofAcc = 0;
  }
  const pace = $('pace');
  if (pace) {
    const sprint = !!(keys.ShiftLeft || keys.ShiftRight) || Math.hypot(touchWish.x, touchWish.y) > 0.85;
    const gaitName = {
      idle: 'Зогсоо', walk: 'Алхаа', trot: 'Жороо', canter: 'Шогшоо', gallop: 'Давхилт',
    }[playerHorse?.userData?.gait];
    const label = mounted ? (gaitName || 'Жороо') : (sprint ? 'Гүйлт' : '');
    pace.textContent = label;
    pace.classList.toggle('hidden', !label || state !== 'explore');
  }
  if (world.hoelun) world.hoelun.userData.talking = state === 'dialogue' && talkTarget === world.hoelun;
  temujin.userData.setMoving?.(moving && state === 'explore');
  temujin.userData.setSpeed?.(moveSpeed);

  if (state === 'explore') {
    stride.update(player.pos, moving, (p, dir) => {
      dust?.step(p, dir);
      if (fxOn) footStains?.stamp(p, player.yaw);
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
  if (shotLock) {
    paint(t);
    requestAnimationFrame(tick);
    return;
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
      blockers: world.colliders,
    });
  }

  harvestMist?.update?.(dt, camera, renderer);
  motes?.update?.(dt, camera);
  birds?.update?.(dt, t, player.pos);
  dust?.update?.(dt, camera, renderer);
  if (fxOn) {
    mistField?.update?.(t);
    crowFlock?.update?.(dt, t, player.pos);
    footStains?.update?.(dt);
    if (crowFlock && t > 0 && Math.floor(t) % 9 === 0 && Math.floor(t - dt) % 9 !== 0) {
      audio.cue?.('eagleCry', -10, true);
    }
  }
  updateWorld?.(dt, t, state === 'explore' ? nearSet() : null, player.pos, moving && state === 'explore');
  paint(t);
  requestAnimationFrame(tick);
}
tick();

window.__mshLoadScene = (id) => loadScene(id, { cinematic: false });
window.__mshShow = show;
window.__mshStartDialogue = startDialogue;
window.__mshSetQuality = (id) => setQuality(id, { manual: true, reloadScene: true });
window.__mshFx = (on) => { setFx(!!on); return fxOn; };
window.__mshClipGate = () => ({
  temujin: world?.temujin?.userData?.clipGate || null,
  hoelun: world?.hoelun?.userData?.clipGate || null,
});
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
window.__mshPixelRatio = (v) => {
  renderer.setPixelRatio(v);
  resize();
  return renderer.getPixelRatio();
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
window.__mshTryEnd = () => {
  endCard({ eyebrow: 'Нотолгоо', title: 'Төгсгөл', body: '', button: 'Хаах', onNext: () => showTitle() });
  return {
    state,
    titleHidden: $('title').classList.contains('hidden'),
    endHidden: $('end')?.classList.contains('hidden'),
    fastPlay: !!$('fastPlayBtn'),
    heading: $('titleHeading')?.innerText || '',
  };
};
window.__mshMount = (on = true, sprint = false) => {
  if (state === 'title' || state === 'cine') {
    state = 'explore';
    document.body.classList.add('in-play');
    $('title')?.classList.add('hidden');
    $('hud')?.classList.remove('hidden');
  }
  keys.ShiftLeft = !!sprint;
  setMounted(!!on);
  const paceEl = $('pace');
  if (paceEl && mounted) {
    paceEl.textContent = sprint ? 'Давхилт' : 'Жороо';
    paceEl.classList.remove('hidden');
  }
  if (playerHorse) {
    playerHorse.rotation.y = 0;
    const p = playerHorse.position;
    window.__mshFrame(
      [p.x + 0.15, p.y + 1.45, p.z + 3.15],
      [p.x + 0.35, p.y + 1.4, p.z],
      42,
      true
    );
  }
  return { mounted, pace: $('pace')?.textContent || '', sprint: !!keys.ShiftLeft };
};
window.__mshPlay = () => { shotLock = false; state = 'explore'; return true; };
window.__mshCoach = () => ({ text: coach.text, step: coach.step, active: coach.active });
window.__mshSfx = () => sfx.last;
window.__mshPos = () => ({ x: Math.round(player.pos.x * 10) / 10, z: Math.round(player.pos.z * 10) / 10, state });
window.__mshSave = () => loadSave();
window.__mshContinue = () => { continueFromTitle(); return { state, endHidden: $('end')?.classList.contains('hidden'), titleHidden: $('title')?.classList.contains('hidden'), x: player.pos.x, z: player.pos.z }; };
window.__mshField = () => fieldTasks?.status() || null;
window.__mshHerd = () => world?.herdStatus?.() || null;
window.__mshAim = () => {
  if (!fieldTasks) return null;
  const spot = fieldTasks.status().spots.shoot;
  const yaw = fieldTasks.aimYaw(new THREE.Vector3(player.pos.x, player.pos.y, player.pos.z));
  player.yaw = yaw;
  cam.view.yaw = yaw;
  qTouch = true;
  return { yaw, spot };
};
window.__mshTheme = () => ({
  muted: theme.muted,
  missing: theme.missing,
  playing: theme.playing,
  volume: Math.round(theme.volume * 100) / 100,
  loop: theme.loop,
});
window.__mshGait = (speed = 13) => {
  if (state === 'title' || state === 'cine') {
    state = 'explore';
    document.body.classList.add('in-play');
    $('title')?.classList.add('hidden');
    $('hud')?.classList.remove('hidden');
  }
  if (!mounted) setMounted(true);
  if (!playerHorse?.userData?.step) return null;
  playerHorse.rotation.y = 0;
  playerHorse.userData.phase = 0;
  const gait = playerHorse.userData.step(0.08, speed);
  const names = { walk: 'Алхаа', trot: 'Жороо', canter: 'Шогшоо', gallop: 'Давхилт', idle: 'Зогсоо' };
  const paceEl = $('pace');
  if (paceEl) {
    paceEl.textContent = names[gait] || '';
    paceEl.classList.remove('hidden');
  }
  const p = playerHorse.position;
  window.__mshFrame(
    [p.x + 0.1, p.y + 1.2, p.z + 5.4],
    [p.x + 0.1, p.y + 0.85, p.z],
    36,
    false
  );
  return { gait, pace: paceEl?.textContent || '', missing: theme.missing };
};
window.__mshStick = () => {
  state = 'explore';
  document.body.classList.add('in-play', 'touch-ui');
  $('title')?.classList.add('hidden');
  $('hud')?.classList.remove('hidden');
  const s = $('stick');
  const shown = s ? getComputedStyle(s).display !== 'none' : false;
  return { shown, mount: !!$('mountBtn') };
};
window.__mshFrame = (eye, look, fov = 36, hideHud = true) => {
  shotLock = true;
  activeCine = null;
  state = 'explore';
  document.body.classList.add('in-play');
  $('title')?.classList.add('hidden');
  if (hideHud) $('hud')?.classList.add('hidden');
  else $('hud')?.classList.remove('hidden');
  $('dialogue')?.classList.add('hidden');
  $('end')?.classList.add('hidden');
  camera.fov = fov;
  camera.position.set(eye[0], eye[1], eye[2]);
  camera.lookAt(look[0], look[1], look[2]);
  camera.updateProjectionMatrix();
  return true;
};
window.__mshFrameHorse = () => {
  let saddle = null;
  scene.traverse((o) => { if (!saddle && o.name === 'saddle-anchor') saddle = o; });
  if (!saddle) return null;
  const p = new THREE.Vector3();
  const head = new THREE.Vector3();
  saddle.getWorldPosition(p);
  const horseHead = saddle.parent?.userData?.head;
  horseHead?.getWorldPosition(head);
  const riderHead = new THREE.Vector3();
  saddle.getObjectByName('head')?.getWorldPosition(riderHead);
  window.__mshFrame(
    [p.x + 5.2, p.y + 1.7, p.z + 0.15],
    [p.x, p.y + 0.7, p.z - 0.5],
    34
  );
  return {
    saddle: [p.x, p.y, p.z],
    horseHead: horseHead ? [head.x, head.y, head.z] : null,
    riderHead: [riderHead.x, riderHead.y, riderHead.z],
  };
};
