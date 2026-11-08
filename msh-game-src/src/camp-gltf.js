// Camp environment from camp-world.glb. Y-up glTF; do not apply a Blender Z-up fix.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const CAMP_GLB_URL = './models/camp-world.glb';

const SOLID = /^(ger_placement|fence_placement|cart_placement|rock_[abc]_placement|pine_placement|Steppe_edge_rock_)/;
const _down = new THREE.Vector3(0, -1, 0);
const _origin = new THREE.Vector3();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _dummy = new THREE.Object3D();

/**
 * Loads the camp GLB into the scene. Height is 0 until the terrain mesh is ready.
 * Solid colliders (ger, fence, rock, cart, pine) are pushed into `colliders`.
 * Grass, paths, bushes, the saddle, and the woodpile stay visual.
 */
export function attachCamp(scene, { shadows = true, colliders = [], onReady } = {}) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 180;
  let terrain = null;
  const waiters = [];

  function heightAt(x, z) {
    if (!terrain) return 0;
    _origin.set(x, 80, z);
    raycaster.set(_origin, _down);
    const hit = raycaster.intersectObject(terrain, false)[0];
    return hit ? hit.point.y : 0;
  }

  function whenReady(fn) {
    if (terrain) fn(terrain.userData.campMeasure);
    else waiters.push(fn);
  }
  if (onReady) whenReady(onReady);

  const loader = new GLTFLoader();
  loader.load(
    CAMP_GLB_URL,
    (gltf) => {
      try {
        const root = gltf.scene;
        root.name = 'camp-world';
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
        root.scale.set(1, 1, 1);
        scene.add(root);
        root.updateMatrixWorld(true);

        const measure = measureAndDress(root, { shadows, colliders });
        terrain = measure.terrain;
        terrain.userData.campMeasure = measure;
        console.info('[camp] loaded', JSON.stringify(measure.report));
        waiters.splice(0).forEach((fn) => fn(measure));
      } catch (err) {
        console.error('[camp] setup failed', err);
      }
    },
    undefined,
    (err) => console.error('[camp] GLB failed', err)
  );

  return { heightAt, whenReady };
}

function measureAndDress(root, { shadows, colliders }) {
  const sceneBox = new THREE.Box3().setFromObject(root);
  const sceneSize = sceneBox.getSize(new THREE.Vector3());
  const sceneCenter = sceneBox.getCenter(new THREE.Vector3());

  let terrain = null;
  root.traverse((o) => {
    if (o.isMesh && o.name === 'Rolling steppe with flat camp clearing') terrain = o;
  });
  if (!terrain) {
    let best = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.geometry?.attributes?.position?.count || 0;
      if (n > best) { best = n; terrain = o; }
    });
  }
  if (!terrain) throw new Error('camp terrain mesh missing');

  paintSteppe(terrain);
  terrain.receiveShadow = shadows;
  terrain.castShadow = false;

  const grasses = [];
  root.traverse((o) => {
    if (!o.isMesh || o === terrain) return;
    const named = `${o.name} ${o.parent?.name || ''}`;
    if (/grass/i.test(named)) {
      grasses.push(o);
      return;
    }
    const solid = /ger|fence|rock|cart|pine|tug|wood|saddle/i.test(named);
    o.castShadow = shadows && solid;
    o.receiveShadow = shadows;
    const mat = o.material;
    const mats = Array.isArray(mat) ? mat : [mat];
    mats.forEach(soften);
  });
  instanceGrass(root, grasses);

  const gers = [];
  root.traverse((o) => {
    if (!SOLID.test(o.name || '')) return;
    const added = addSolidCollider(o, colliders);
    if (added && o.name.startsWith('ger_placement')) gers.push(added);
  });

  const tBox = new THREE.Box3().setFromObject(terrain);
  const report = {
    sceneMin: roundV(sceneBox.min),
    sceneMax: roundV(sceneBox.max),
    sceneCenter: roundV(sceneCenter),
    sceneSize: roundV(sceneSize),
    terrainMin: roundV(tBox.min),
    terrainMax: roundV(tBox.max),
    gers,
    colliders: colliders.length,
    grassInstances: grasses.length,
  };
  return { terrain, report, gers };
}

function paintSteppe(terrain) {
  const geo = terrain.geometry;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const low = new THREE.Color('#6a6e32');
  const mid = new THREE.Color('#b7a45c');
  const high = new THREE.Color('#d2c48a');
  const dirt = new THREE.Color('#8d7344');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(y / 16, 0, 1);
    const n = (Math.sin(x * 0.07 + z * 0.04) * Math.cos(z * 0.06) + 1) * 0.5;
    c.copy(low).lerp(mid, t * 0.65 + n * 0.2).lerp(high, t * t * 0.55);
    if (y < 0.35) c.lerp(dirt, 0.22);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mats = Array.isArray(terrain.material) ? terrain.material : [terrain.material];
  mats.forEach((m) => {
    m.vertexColors = true;
    if (m.color) m.color.set('#ffffff');
    soften(m);
    m.needsUpdate = true;
  });
}

function soften(m) {
  if (!m) return;
  if ('metalness' in m && m.metalness > 0.2) m.metalness = 0.12;
  if ('roughness' in m && m.roughness < 0.45) m.roughness = 0.62;
}

function instanceGrass(root, grasses) {
  if (grasses.length < 2) return;
  const buckets = new Map();
  for (const mesh of grasses) {
    const key = mesh.geometry.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  }
  for (const group of buckets.values()) {
    const inst = new THREE.InstancedMesh(group[0].geometry, group[0].material, group.length);
    inst.name = 'camp-grass';
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.frustumCulled = true;
    group.forEach((mesh, i) => {
      _dummy.matrix.copy(mesh.matrixWorld);
      inst.setMatrixAt(i, _dummy.matrix);
      mesh.removeFromParent();
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, -4), 70);
    root.add(inst);
  }
}

function addSolidCollider(obj, colliders) {
  _box.setFromObject(obj);
  if (_box.isEmpty()) return null;
  _box.getSize(_size);
  _box.getCenter(_center);
  const name = obj.name;
  if (name.startsWith('fence_placement')) {
    const longX = _size.x >= _size.z;
    const len = longX ? _size.x : _size.z;
    const thick = Math.max(0.34, (longX ? _size.z : _size.x) * 0.5 + 0.18);
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      colliders.push({
        x: longX ? THREE.MathUtils.lerp(_box.min.x, _box.max.x, t) : _center.x,
        z: longX ? _center.z : THREE.MathUtils.lerp(_box.min.z, _box.max.z, t),
        r: thick,
        kind: 'fence',
      });
    }
    return { kind: 'fence', x: round(_center.x), z: round(_center.z) };
  }
  const r = name.startsWith('ger_placement')
    ? Math.min(_size.x, _size.z) * 0.46
    : Math.max(_size.x, _size.z) * 0.4;
  const kind = name.startsWith('ger') ? 'ger'
    : name.startsWith('cart') ? 'cart'
    : name.startsWith('pine') ? 'pine'
    : 'rock';
  const entry = { x: _center.x, z: _center.z, r: Math.max(0.35, r), kind };
  colliders.push(entry);
  return { kind, x: round(entry.x), z: round(entry.z), r: round(entry.r) };
}

function round(n) { return Math.round(n * 100) / 100; }
function roundV(v) { return [round(v.x), round(v.y), round(v.z)]; }
