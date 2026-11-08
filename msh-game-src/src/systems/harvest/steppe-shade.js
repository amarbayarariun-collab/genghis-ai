/**
 * steppe-shade.js — Алтан цагийн будгийн сүүдэр (painterly warm-light / cool-shadow grade on built-in materials)
 *
 * Source / idea: verdant `src/world/painterly.js` (xikhar/verdant, NO license → technique re-implemented, no
 *   code): an `onBeforeCompile` patch that, after lighting, mixes the outgoing colour toward an art-directed
 *   *shadow ink* colour by (1 − shadowMask) × (1 − N·L), and tints the lit side warm — so the whole scene reads like
 *   one painting instead of grey PBR shadows. Verdant used cool green/blue ink for a forest; we use steppe values:
 *   violet-blue shadow (#4a3f6b) and golden-hour light (#ffd9a0). Also sisyphus `paintedPlane` (NO license → idea):
 *   per-depth saturation/contrast/fog mix for background layers → `paintedDepth()`.
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/world.js:
 *   import { steppeShade, paintedDepth } from './systems/steppe-shade.js';
 *   const flatMat = (color, o = {}) => steppeShade(new THREE.MeshLambertMaterial({ color, flatShading: true, ...o }));
 *   steppeShade(groundMat, { ground: true });            // ground gets a flatter, bluer shadow pool
 *   paintedDepth(farHillsMat, { saturation: 0.6, contrast: 0.8, fog: 0.35, fogColor: '#e8b57a' });
 */
import * as THREE from 'three';

const f = (v) => v.toFixed(4);

/**
 * @param {THREE.Material} material Lambert / Phong / Standard / Physical (anything with <lights_fragment_end>)
 * @param {{ shadow?: string, light?: string, amount?: number, warm?: number, ground?: boolean }} [opts]
 */
export function steppeShade(material, opts = {}) {
  const shadow = new THREE.Color(opts.shadow ?? (opts.ground ? '#5a4a6e' : '#4a3f6b'));
  const light = new THREE.Color(opts.light ?? '#ffd9a0');
  const amount = opts.amount ?? (opts.ground ? 0.55 : 0.62);
  const warm = opts.warm ?? 0.12;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('#include <opaque_fragment>', `
{
  float nl = 0.0;
  #if NUM_DIR_LIGHTS > 0
    nl = max(dot(normalize(normal), directionalLights[0].direction), 0.0);
  #endif
  float shade = 1.0 - smoothstep(0.08, 0.7, nl) * getShadowMask();
  vec3 inkCol = vec3(${f(shadow.r)}, ${f(shadow.g)}, ${f(shadow.b)}) * (0.92 + diffuseColor.r * 0.14);
  outgoingLight *= mix(vec3(1.0), vec3(${f(light.r)}, ${f(light.g)}, ${f(light.b)}) * 1.08, smoothstep(0.5, 0.95, nl) * ${f(warm)} * 4.0);
  outgoingLight = mix(outgoingLight, inkCol * diffuseColor.rgb * 1.6, shade * ${f(amount)});
}
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `steppe-shade:${opts.ground ? 'g' : 'o'}:${amount}:${warm}:${shadow.getHexString()}`;
  material.needsUpdate = true;
  return material;
}

/**
 * Background-layer grade (sisyphus idea): desaturate, flatten contrast and mix toward the haze colour by depth.
 * @param {THREE.Material} material any material with <color_fragment> (Basic / Lambert / Standard)
 */
export function paintedDepth(material, { saturation = 0.6, contrast = 0.8, fog = 0.3, fogColor = '#e8b57a' } = {}) {
  const c = new THREE.Color(fogColor);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, ${f(saturation)});
  diffuseColor.rgb = (diffuseColor.rgb - vec3(0.3)) * ${f(contrast)} + vec3(0.3);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)}), ${f(fog)});
}`);
  };
  material.customProgramCacheKey = () => `painted-depth:${saturation}:${contrast}:${fog}:${c.getHexString()}`;
  material.needsUpdate = true;
  return material;
}
