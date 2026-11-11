// Artifact hosting cannot serve .glb files, so the models ship as base64 JS
// chunks (one lazy chunk per model) and GLTFLoader.load is redirected to them.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CHUNKS = {
  'camp-world': () => import('./inline/camp-world.js'),
  hoelun: () => import('./inline/hoelun.js'),
  base_basic_shaded: () => import('./inline/base_basic_shaded.js'),
  chirha: () => import('./inline/chirha.js'),
  horse_hi: () => import('./inline/horse_hi.js'),
  horse_lo: () => import('./inline/horse_lo.js'),
  fig_tem_npc: () => import('./inline/fig_tem_npc.js'),
  fig_tem_crowd: () => import('./inline/fig_tem_crowd.js'),
  fig_eld_npc: () => import('./inline/fig_eld_npc.js'),
  fig_eld_crowd: () => import('./inline/fig_eld_crowd.js'),
};

function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const origLoad = GLTFLoader.prototype.load;
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  const m = /models\/([\w-]+)\.glb$/.exec(String(url));
  const chunk = m && CHUNKS[m[1]];
  if (!chunk) return origLoad.call(this, url, onLoad, onProgress, onError);
  chunk()
    .then((mod) => this.parse(b64ToBuffer(mod.default), '', onLoad, onError))
    .catch((e) => { console.error('[inline-models]', m[1], e); onError?.(e); });
};
