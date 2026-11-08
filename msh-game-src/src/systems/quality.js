/**
 * Adaptive + manual quality tiers for Act I / whole demo.
 * Tiers: low | med | high — chosen by first ~2s frame time or Esc menu.
 */
export const QUALITY_TIERS = ['low', 'med', 'high'];

const PRESETS = {
  low: {
    id: 'low',
    label: 'Бага',
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMap: 0,
    shadowSoft: false,
    grass: 280,
    motes: 0,
    mist: false,
    birds: false,
    dust: false,
    steppeShade: false,
    clouds: 2,
    hills: 3,
    herd: 6,
    smoke: false,
    dustBits: false,
    fogDensityScale: 1.08,
    toneMapping: 'aces',
    exposure: 1.08,
    camFar: 260,
  },
  med: {
    id: 'med',
    label: 'Дунд',
    pixelRatioCap: 1.25,
    shadows: true,
    shadowMap: 512,
    shadowSoft: false,
    grass: 1000,
    motes: 28,
    mist: true,
    birds: true,
    birdCount: 3,
    dust: true,
    steppeShade: true,
    clouds: 6,
    hills: 6,
    herd: 12,
    smoke: true,
    dustBits: true,
    fogDensityScale: 1,
    toneMapping: 'aces',
    exposure: 1.1,
    camFar: 360,
  },
  high: {
    id: 'high',
    label: 'Өндөр',
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMap: 1024,
    shadowSoft: false, // PCF not soft — cheaper
    grass: 2000,
    motes: 80,
    mist: true,
    birds: true,
    birdCount: 5,
    dust: true,
    steppeShade: true,
    clouds: 11,
    hills: 10,
    herd: 16,
    smoke: true,
    dustBits: true,
    fogDensityScale: 1,
    toneMapping: 'aces',
    exposure: 1.12,
    camFar: 420,
  },
};

export function qualityPreset(id = 'med') {
  return PRESETS[id] || PRESETS.med;
}

/** Pick tier from average frame ms over the probe window. */
export function pickTierFromAvgMs(avgMs) {
  if (avgMs > 28) return 'low';   // <~35fps → low
  if (avgMs < 18) return 'high';  // >~55fps → high
  return 'med';
}

export function applyRendererQuality(renderer, THREE, preset) {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  const pr = Math.min(dpr, preset.pixelRatioCap);
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = !!preset.shadows;
  renderer.shadowMap.type = preset.shadowSoft
    ? THREE.PCFSoftShadowMap
    : THREE.PCFShadowMap;
  if (preset.toneMapping === 'aces') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
  }
  renderer.toneMappingExposure = preset.exposure;
  return pr;
}
