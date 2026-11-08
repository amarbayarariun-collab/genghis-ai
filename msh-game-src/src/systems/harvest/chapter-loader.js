/**
 * chapter-loader.js — Бүлгийн ачаалагч (chapter table + level manager + versioned save)
 *
 * Source / idea: Sumiro bundle `chapters-*.js`, `level-*.js`, `game-*.js` (xikhar.github.io, NO license →
 *   pattern re-implemented, no code, no Japanese chapter data). Kept:
 *   - a flat CHAPTERS table: id, numeral, title, next, `gives` (ability unlocked on finishing), `flags` regex that is
 *     wiped when the chapter is (re)entered, `line` (card subtitle), `closing` (end caption);
 *   - `abilitiesBefore(id)` = union of `gives` of all earlier chapters, so a save can jump anywhere;
 *   - a level manager with `switchTo(id)`: leave old (dispose or `retain` in a cache), build new, settle, time it;
 *   - lazy chapter modules (`() => import(...)`) so Vite splits one bundle per chapter;
 *   - a versioned localStorage save `{ v, chapter, unlocked[], abilities, flags, seen, playS, options }` with a
 *     validator, an id-migration map for renamed chapters, and sane `DEFAULT_OPTIONS`.
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/main.js (replaces loadScene + clearScene):
 *   import { createChapterManager, CHAPTERS } from './systems/chapter-loader.js';
 *   const chapters = createChapterManager(scene, {
 *     camp:    () => import('./world.js').then((m) => m.buildWorld),
 *     burkhan: () => import('./scenes/burkhan.js').then((m) => m.buildBurkhanWorld),
 *     act2:    () => import('./scenes/act2.js').then((m) => m.buildAct2World),
 *     act3:    () => import('./scenes/act3.js').then((m) => m.buildAct3World),
 *   }, { onEnter(world, ch) { $('chapter').textContent = ch.numeral + ' · ' + ch.title; player.pos.copy(world.startPos); } });
 *   await chapters.switchTo(chapters.save.chapter);          // resumes where Amgaa left off
 *   // end of a chapter: chapters.complete(); then chapters.switchTo(chapters.current.def.next)
 */

/** Mongolian chapter table for the MSH slice (edit titles freely; ids match main.js scene ids). */
export const CHAPTERS = [
  { id: 'camp', numeral: 'I бүлэг', title: 'Өнчин өдрүүд', next: 'burkhan', gives: 'bow', flags: /^camp_/, line: 'Онон мөрний эрэг. Эцэггүй хоцорсон айл.', closing: 'Өэлүн эх хүүхдүүдээ тэжээж байв. Уулын зүг зам гарлаа.' },
  { id: 'burkhan', numeral: 'I бүлэг · 2', title: 'Бурхан халдун', next: 'act2', gives: 'horse', flags: /^burkhan_/, line: 'Уулын дээд. Мөнх тэнгэрт мөргөв.', closing: 'Есөн удаа мөргөж, есөн удаа ам гарав.' },
  { id: 'act2', numeral: 'II бүлэг', title: 'Боорчи · Бөртэ', next: 'act3', gives: 'anda', flags: /^act2_/, line: 'Найман шарга морь. Анд нөхөр.', closing: 'Бөртэ үжин хуримаа хийв. Булган дах бэлэглэв.' },
  { id: 'act3', numeral: 'III бүлэг', title: 'Чингис', next: null, flags: /^act3_/, line: 'Их хуралдай. Есөн хөлт цагаан туг.', closing: 'Далай их улсын эзэн — Чингис хаан.' },
];

export const FIRST_CHAPTER = CHAPTERS[0].id;
export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) ?? null;

/** Union of `gives` of all chapters before `id` (so a late save still has the horse). */
export function abilitiesBefore(id) {
  const out = {};
  for (const c of CHAPTERS) { if (c.id === id) break; if (c.gives) out[c.gives] = true; }
  return out;
}

export const DEFAULT_OPTIONS = { master: 1, music: 1, ambience: 1, effects: 1, sensitivity: 1, invertY: false, subtitles: true };
const SAVE_KEY = 'msh.save.v1';
const RENAMED = { onon: 'camp', khaldun: 'burkhan' }; // old id → new id (fill as chapters get renamed)

export function freshSave(options = DEFAULT_OPTIONS) {
  return { v: 1, chapter: FIRST_CHAPTER, unlocked: [FIRST_CHAPTER], abilities: {}, flags: {}, seen: {}, playS: 0, options: { ...DEFAULT_OPTIONS, ...options } };
}
function valid(s) {
  return s && s.v === 1 && typeof s.chapter === 'string' && Array.isArray(s.unlocked) && s.abilities && s.flags;
}
function migrate(s) {
  const fix = (id) => RENAMED[id] ?? id;
  const unlocked = [...new Set(s.unlocked.map(fix))].filter(chapterById);
  if (!unlocked.includes(FIRST_CHAPTER)) unlocked.unshift(FIRST_CHAPTER);
  const chapter = chapterById(fix(s.chapter)) ? fix(s.chapter) : unlocked[unlocked.length - 1];
  if (!unlocked.includes(chapter)) unlocked.push(chapter);
  return { ...s, chapter, unlocked };
}
export function loadSave(key = SAVE_KEY) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    const s = raw ? JSON.parse(raw) : null;
    return valid(s) ? { ...freshSave(s.options), ...migrate(s), options: { ...DEFAULT_OPTIONS, ...s.options } } : freshSave();
  } catch { return freshSave(); }
}
export function writeSave(s, key = SAVE_KEY) {
  try { localStorage.setItem(key, JSON.stringify(s)); return true; } catch { return false; }
}

/** Enter a chapter in the save: wipe its flags, recompute abilities. */
export function enterChapter(save, id) {
  const ch = chapterById(id);
  save.chapter = id;
  if (!ch) return save;
  save.abilities = abilitiesBefore(id);
  if (ch.flags) for (const k of Object.keys(save.flags)) if (ch.flags.test(k)) delete save.flags[k];
  if (!save.unlocked.includes(id)) save.unlocked.push(id);
  return save;
}

function disposeObject(o) {
  o.traverse?.((c) => {
    c.geometry?.dispose?.();
    const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
    for (const m of mats) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose?.(); }
  });
}

/**
 * Level manager. Builders may add straight to `scene` (as demo-slice does): the manager diffs `scene.children`
 * before/after the build and owns whatever appeared. A builder may also return `{ group }` for explicit ownership.
 * @param {import('three').Scene} scene
 * @param {Record<string, () => Promise<(scene: any) => any> | ((scene: any) => any)>} builders id → loader of build fn
 * @param {{ onEnter?: (world: any, ch: object) => void, onLeave?: (world: any, ch: object) => void, retain?: string[], save?: object, autosave?: boolean }} [opts]
 */
export function createChapterManager(scene, builders, opts = {}) {
  const save = opts.save ?? loadSave();
  const retain = new Set(opts.retain ?? []);
  const cache = new Map();
  const mgr = {
    save,
    current: null, // { id, def, world, objects }
    loadMs: 0,
    async switchTo(id) {
      if (mgr.current?.id === id) return mgr.current.world;
      const def = chapterById(id);
      if (!def || !builders[id]) throw new Error(`[chapters] no chapter "${id}"`);
      const t0 = performance.now();
      if (mgr.current) mgr.leave();
      let entry = cache.get(id);
      if (!entry) {
        let build = builders[id]();
        if (build && typeof build.then === 'function') build = await build;
        const before = new Set(scene.children);
        const world = build(scene);
        const objects = world?.group ? [world.group] : scene.children.filter((c) => !before.has(c));
        if (world?.group && !world.group.parent) scene.add(world.group);
        entry = { id, def, world, objects };
      } else for (const o of entry.objects) scene.add(o);
      mgr.current = entry;
      enterChapter(save, id);
      if (opts.autosave !== false) writeSave(save);
      opts.onEnter?.(entry.world, def);
      mgr.loadMs = performance.now() - t0;
      return entry.world;
    },
    leave() {
      const cur = mgr.current; if (!cur) return;
      opts.onLeave?.(cur.world, cur.def);
      cur.world?.dispose?.();
      for (const o of cur.objects) scene.remove(o);
      if (retain.has(cur.id)) cache.set(cur.id, cur);
      else for (const o of cur.objects) disposeObject(o);
      mgr.current = null;
    },
    /** Mark the current chapter finished: grant its ability, unlock the next, save. Returns next id or null. */
    complete() {
      const def = mgr.current?.def; if (!def) return null;
      if (def.gives) save.abilities[def.gives] = true;
      if (def.next && !save.unlocked.includes(def.next)) save.unlocked.push(def.next);
      save.seen[def.id] = true;
      writeSave(save);
      return def.next;
    },
    setFlag(k, v = true) { save.flags[k] = v; writeSave(save); },
    flag: (k) => save.flags[k],
    has: (ability) => !!save.abilities[ability],
    tick(dt) { save.playS += dt; },
    reset() { Object.assign(save, freshSave(save.options)); writeSave(save); },
  };
  return mgr;
}

/** Markup for a Sumiro-style chapter card (numeral / title / line), reusing demo-slice `.title-card` CSS. */
export function chapterCardHTML(ch, { tally = '' } = {}) {
  return `<div class="title-card end-card"><div class="title-art" aria-hidden="true"></div><div class="title-copy">` +
    `<p class="eyebrow">${ch.numeral}</p><h1>${ch.title}</h1><p class="sub">${ch.line ?? ''}</p>` +
    `${tally ? `<p class="body">${tally}</p>` : ''}</div></div>`;
}
