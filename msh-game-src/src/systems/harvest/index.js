/**
 * index.js — barrel for the @xikhar harvest. Copy the folder to demo-slice/src/systems/xikhar/ (or cherry-pick
 * files) and import from here. Every module is an ES module that only depends on `three`.
 * See ../xikhar-harvest.md for the per-module wiring and licenses.
 */
export { createDustSteps, createStrideTrigger, createFootTrigger } from './fx-dust-steps.js';
export { createSteppeMotes } from './fx-steppe-motes.js';
export { createMist } from './fx-mist.js';
export { createBirds } from './fx-birds.js';
export { createAnimator, createLocomotionFSM } from './anim-state-machine.js';
export { createCinematic, ONON_INTRO, MOUNTAIN_RISE } from './cinematic-camera.js';
export { createSteppeAudio, SCAPES } from './ambient-audio.js';
export { createChapterManager, CHAPTERS, FIRST_CHAPTER, chapterById, abilitiesBefore, loadSave, writeSave, enterChapter, freshSave, chapterCardHTML, DEFAULT_OPTIONS } from './chapter-loader.js';
export { scatterInstanced, addWindSway, createLodRings, createImpostorCards, createAdaptiveQuality } from './lod-instancing.js';
export { createInput } from './input.js';
export { createRegistry, createSystems } from './registry.js';
export { steppeShade, paintedDepth } from './steppe-shade.js';
