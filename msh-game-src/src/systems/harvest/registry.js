/**
 * registry.js — Систем бүртгэл (tiny pub/sub key-value registry + ordered system runner)
 *
 * Source / idea: Sumiro's module contract (`{ name, order, budgetMs, chapter?, init(ctx), update(dt, ctx),
 *   beforeRender(ctx), dispose(ctx) }` + `ctx.registry.set/get/on('player.feet' | 'audio.cue' | 'fx_crows.burst')`) and
 *   cybercity `engine/Engine.js` (`systems = [{ name, async init(ctx), update(dt, t, ctx), postUpdate? }]`, shared
 *   `ctx` with `events: new EventTarget()`). Both repos have NO license → the pattern is re-implemented, no code.
 *   Why: it lets the fx modules in this folder talk without importing each other (dust ← player.feet, audio ← step).
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/main.js:
 *   import { createRegistry, createSystems } from './systems/registry.js';
 *   const registry = createRegistry();
 *   const systems = createSystems({ THREE, scene, camera, renderer, registry });
 *   systems.add({ name: 'dust', order: 30, init(ctx) {...}, update(dt, ctx) {...} });
 *   await systems.init();   // tick(): systems.update(dt, t); systems.beforeRender(); renderer.render(...)
 *   // anywhere: registry.set('player.feet', player.pos); registry.on('player.step', (e) => dust.step(e.pos, e.dir));
 */
export function createRegistry() {
  const values = new Map();
  const subs = new Map();
  const api = {
    get: (k) => values.get(k),
    has: (k) => values.has(k),
    /** Set + notify. Returns the value. */
    set(k, v) {
      values.set(k, v);
      const s = subs.get(k);
      if (s) for (const fn of [...s]) fn(v, k);
      return v;
    },
    delete(k) { values.delete(k); const s = subs.get(k); if (s) for (const fn of [...s]) fn(undefined, k); },
    /** Notify without storing (events). */
    emit(k, v) { const s = subs.get(k); if (s) for (const fn of [...s]) fn(v, k); },
    /** Subscribe; returns `off`. If a value exists it is delivered immediately unless `{ replay: false }`. */
    on(k, fn, { replay = true } = {}) {
      if (!subs.has(k)) subs.set(k, new Set());
      subs.get(k).add(fn);
      if (replay && values.has(k)) fn(values.get(k), k);
      return () => subs.get(k)?.delete(fn);
    },
    once(k, fn) { const off = api.on(k, (v) => { off(); fn(v); }, { replay: false }); return off; },
    keys: () => [...values.keys()],
  };
  return api;
}

/**
 * Ordered systems with a per-system ms budget warning (Sumiro `budgetMs`) and chapter gating.
 * @param {object} ctx shared context passed to every hook
 */
export function createSystems(ctx) {
  const list = [];
  const stats = new Map();
  let chapter = null;
  const active = (s) => !s.chapter || s.chapter === chapter;
  return {
    ctx, stats,
    add(sys) { list.push(sys); list.sort((a, b) => (a.order ?? 100) - (b.order ?? 100)); return sys; },
    remove(name) { const i = list.findIndex((s) => s.name === name); if (i >= 0) { list[i].dispose?.(ctx); list.splice(i, 1); } },
    get: (name) => list.find((s) => s.name === name),
    setChapter(id) { chapter = id; ctx.chapter = id; for (const s of list) s.onChapter?.(id, ctx); },
    async init() { for (const s of list) await s.init?.(ctx); },
    update(dt, t) {
      ctx.dt = dt; ctx.t = t;
      for (const s of list) {
        if (!s.update || !active(s)) continue;
        const t0 = performance.now();
        s.update(dt, ctx, t);
        const ms = performance.now() - t0;
        const st = stats.get(s.name) ?? { ms: 0, over: 0 };
        st.ms = st.ms * 0.9 + ms * 0.1;
        if (s.budgetMs && ms > s.budgetMs * 4) st.over++;
        stats.set(s.name, st);
      }
    },
    beforeRender() { for (const s of list) if (active(s)) s.beforeRender?.(ctx); },
    dispose() { for (const s of list) s.dispose?.(ctx); list.length = 0; },
    /** Table of smoothed ms per system, slowest first (debug overlay). */
    report() { return [...stats.entries()].sort((a, b) => b[1].ms - a[1].ms).map(([name, s]) => `${name.padEnd(14)} ${s.ms.toFixed(2)} ms${s.over ? ` (over×${s.over})` : ''}`).join('\n'); },
  };
}
