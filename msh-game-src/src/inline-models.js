// Artifact hosting cannot serve .glb files, so the models ship as base64 JS
// chunks (one lazy chunk per model) and GLTFLoader.load is redirected to them.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLOB = import.meta.glob('./inline/*.js');
const CHUNKS = {};
for (const [path, loader] of Object.entries(GLOB)) {
  const name = path.replace('./inline/', '').replace('.js', '');
  CHUNKS[name] = loader;
}

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
