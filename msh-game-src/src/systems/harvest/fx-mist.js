/**
 * fx-mist.js — Онон мөрний өглөөний манан (layered ground mist / river haze)
 *
 * Source / idea: Sumiro bundle `fx_mist-*.js` (xikhar.github.io, NO license → technique only, no code or ink look
 *   copied). Kept: several stacked translucent sheets, each with "level silk" streaks = fbm noise stretched hard along
 *   the wind axis (u*0.2) and squashed across it (v*1.9); one long slow bend so no streak is ruler-straight; alpha from
 *   optical depth `1 - exp(-density * depth)`; the bank thins as the camera nears (rock "ghosts through"); fine grain
 *   that holds its size on screen; a shared `intensity` state the chapter can animate (Sumiro `uState`).
 *   Dropped: the frozen-camera field texture, the depth-texture soft-Z, the gap wedge. Colour: warm steppe gold-grey.
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/main.js (Act I camp: mist along the Onon on the north side):
 *   import { createMist } from './systems/fx-mist.js';
 *   const mist = createMist(scene, { center: [0, 0.4, -22], size: [70, 26], along: [1, 0.15], layers: 4 });
 *   // tick(): mist.update(dt, camera);   // loadScene(): mist.dispose(); then create again for the new world
 *   // Burkhan khaldun: center high on the slope, size [120, 60], intensity 0.8, color '#d8d2c4'.
 */
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), u.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), u.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), u.x), u.y),
      u.z);
  }
  float fbm3(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return s;
  }`;

const VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  uniform float uTime, uSeed, uIntensity, uOpticalDepth, uAlphaMax, uPxScale;
  uniform vec2 uAlong, uCamFade;
  uniform vec3 uMistCol, uMistThin;
  ${NOISE}
  void main() {
    vec2 across = vec2(-uAlong.y, uAlong.x);
    float u = dot(vWorld.xz, uAlong);      // metres along the wind / river
    float v = dot(vWorld.xz, across);      // metres across it
    float t = uTime * 0.05;
    // one long slow bend shared by every streak
    float bendA = vnoise(vec3(u * 0.17, v * 0.31, uSeed + t)) - 0.5;
    float bendB = vnoise(vec3(u * 0.23 + 9.0, v * 0.43, uSeed + 13.0 + t)) - 0.5;
    // level silk: long and thin, drifting along
    float drift = uTime * 0.35;
    float level = fbm3(vec3((u - drift + bendB * 4.0) * 0.2, (v + bendA * 1.6 - u * 0.07) * 1.9, uSeed + t * 1.1));
    float fine  = fbm3(vec3((u - drift * 1.3 + bendB * 3.0) * 0.3, (v + bendA * 1.1 - u * 0.07) * 2.4, uSeed + 7.0 + t * 1.4));
    float silk = level * 0.62 + fine * 0.38;
    float streak = smoothstep(0.3, 0.68, silk);
    // the sheet's own soft outline (ellipse in uv, pushed around by the bend)
    vec2 q = (vUv - 0.5) * 2.0 + vec2(bendB, bendA) * 0.25;
    float mask = 1.0 - smoothstep(0.45, 1.0, dot(q, q));
    float heart = smoothstep(0.25, 0.85, mask);
    float density = pow(mask, 1.6) * mix(streak * 1.1, 0.72 + 0.46 * streak, heart) * uIntensity;
    if (density < 0.002) discard;
    float zF = length(cameraPosition - vWorld);
    density *= mix(0.5, 1.0, smoothstep(4.0, 11.5, zF));           // thins as the camera nears
    float a = 1.0 - exp(-density * uOpticalDepth);
    a *= smoothstep(uCamFade.x, uCamFade.y, zF);                     // gone right at the lens
    vec2 frag = gl_FragCoord.xy;
    float grain = vnoise(vec3(frag / (uPxScale * 2.6), uSeed + uTime * 0.3)) - 0.5;
    float grainB = vnoise(vec3(frag / (uPxScale * 1.2), uSeed + 5.0 + uTime * 0.4)) - 0.5;
    vec3 col = mix(uMistThin, uMistCol, smoothstep(0.05, 0.6, density) * 0.75 + streak * 0.25);
    col += (grain * 0.6 + grainB * 0.4) * 0.032;
    a *= 1.0 + (grain * 0.5 + grainB * 0.5) * 0.14;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uAlphaMax);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * @param {THREE.Scene} scene
 * @param {{
 *   center?: [number, number, number], size?: [number, number], along?: [number, number],
 *   layers?: number, gap?: number, color?: string, thin?: string,
 *   intensity?: number, opticalDepth?: number, alphaMax?: number, seed?: number
 * }} [opts]
 */
export function createMist(scene, opts = {}) {
  const center = opts.center ?? [0, 0.5, -20];
  const [w, d] = opts.size ?? [60, 24];
  const along = new THREE.Vector2(...(opts.along ?? [1, 0])).normalize();
  const layers = opts.layers ?? 4;
  const gap = opts.gap ?? 0.45;
  const group = new THREE.Group();
  group.name = 'fx_mist';
  const state = { intensity: opts.intensity ?? 1 };
  const mats = [];

  const yaw = Math.atan2(along.x, along.y); // rotate the sheet so its long side follows `along`
  for (let i = 0; i < layers; i++) {
    const geo = new THREE.PlaneGeometry(w * (1 - i * 0.08), d * (1 - i * 0.1), 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: (opts.seed ?? 3.17) + i * 19.41 },
        uIntensity: { value: 1 },
        uOpticalDepth: { value: (opts.opticalDepth ?? 1.6) * (1 - i * 0.15) },
        uAlphaMax: { value: opts.alphaMax ?? 0.9 },
        uPxScale: { value: 1 },
        uAlong: { value: along },
        uCamFade: { value: new THREE.Vector2(0.9, 3.2) },
        uMistCol: { value: new THREE.Color(opts.color ?? '#e6d7bd') },
        uMistThin: { value: new THREE.Color(opts.thin ?? '#d9c6a6') },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = yaw;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center[0], center[1] + i * gap, center[2]);
    mesh.renderOrder = 6 + i;
    mesh.frustumCulled = false;
    group.add(mesh);
    mats.push(mat);
  }
  scene.add(group);

  return {
    group,
    state,
    /** Chapter can breathe the bank in/out: 0 = gone, 1 = full. */
    setIntensity(v) { state.intensity = v; },
    update(dt, camera, renderer) {
      const px = renderer ? renderer.getPixelRatio() : 1;
      for (let i = 0; i < mats.length; i++) {
        const u = mats[i].uniforms;
        u.uTime.value += dt;
        u.uPxScale.value = px;
        // upper layers are thinner and vanish first
        u.uIntensity.value = Math.max(0, state.intensity * (1 - i * 0.18) - (1 - state.intensity) * i * 0.2);
      }
      // sheets below the camera read as a floor haze; when the camera dips into them they fade (uCamFade handles it)
      void camera;
    },
    dispose() {
      group.parent?.remove(group);
      for (const m of group.children) { m.geometry.dispose(); m.material.dispose(); }
    },
  };
}
