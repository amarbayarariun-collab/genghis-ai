// Registry for the Blender-built props (src/assets/models/*.glb), loaded once at
// startup by main.js via loadModels(). Scenes ask for clones through getProp();
// when a model is missing (or failed to parse) they fall back to procedural meshes.
let models = {};

export function setProps(loaded) {
  models = loaded || {};
}

export function hasProp(name) {
  return !!models[name];
}

/** Deep clone of a loaded prop (feet at y=0), or null when unavailable. */
export function getProp(name) {
  const src = models[name];
  return src ? src.clone(true) : null;
}

export function propNames() {
  return Object.keys(models);
}
