let counter = 0;

/** Client-only id helper — call from effects or event handlers, not during prerender. */
export function createId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
