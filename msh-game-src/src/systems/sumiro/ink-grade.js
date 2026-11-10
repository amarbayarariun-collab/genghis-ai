// Paper-and-edge grade. One color target, drawn only while the FX toggle is on.
// Not the reference ink G-buffer (opaque / lines / composite). No character UV change.
import * as THREE from 'three';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uTime;
uniform float uEdge;
varying vec2 vUv;

float depthEdge(vec2 uv) {
  float l = texture2D(tDepth, uv - vec2(uTexel.x, 0.0)).r;
  float r = texture2D(tDepth, uv + vec2(uTexel.x, 0.0)).r;
  float d = texture2D(tDepth, uv - vec2(0.0, uTexel.y)).r;
  float u = texture2D(tDepth, uv + vec2(0.0, uTexel.y)).r;
  return smoothstep(0.0035, 0.018, abs(r - l) + abs(u - d));
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  float e = depthEdge(vUv) * uEdge;
  float n = fract(sin(dot(vUv + uTime * 0.01, vec2(19.17, 73.31))) * 43758.5453);
  vec3 paper = vec3(0.93, 0.84, 0.68);
  col = mix(col, paper, 0.035);
  col *= 0.985 + n * 0.02;
  col = mix(col, col * vec3(0.42, 0.32, 0.24), e);
  // The scene target is linear. The canvas expects the sRGB output the other materials write.
  vec3 lo = col * 12.92;
  vec3 hi = 1.055 * pow(max(col, vec3(0.0)), vec3(0.41666)) - 0.055;
  gl_FragColor = vec4(mix(lo, hi, step(vec3(0.0031308), col)), 1.0);
}
`;

export function createInkGrade(renderer) {
  const size = new THREE.Vector2(1, 1);
  renderer.getDrawingBufferSize(size);
  const target = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), {
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.depthTexture = new THREE.DepthTexture(target.width, target.height);
  target.depthTexture.type = THREE.UnsignedShortType;
  const uniforms = {
    tColor: { value: target.texture },
    tDepth: { value: target.depthTexture },
    uTexel: { value: new THREE.Vector2(1 / target.width, 1 / target.height) },
    uTime: { value: 0 },
    uEdge: { value: 0.42 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const passScene = new THREE.Scene();
  passScene.add(quad);
  const passCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const buf = new THREE.Vector2();

  function fit() {
    renderer.getDrawingBufferSize(buf);
    const w = Math.max(2, buf.x);
    const h = Math.max(2, buf.y);
    if (target.width === w && target.height === h) return;
    target.setSize(w, h);
    uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  return {
    render(scene, camera, time = 0) {
      fit();
      uniforms.uTime.value = time;
      const prev = renderer.getRenderTarget();
      const prevMask = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prev);
      renderer.autoClear = prevMask;
      renderer.render(passScene, passCam);
    },
    dispose() {
      target.dispose();
      target.depthTexture?.dispose?.();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
