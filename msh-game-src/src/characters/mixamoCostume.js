// Flat-colour low-poly costume pieces for the Mixamo body, pinned to bones so they
// follow every animation. No image textures anywhere (project rule).
// All builders take the ctx from mixamoBody.mountMixamoBody.
import * as THREE from 'three';
import { lambert, lumpy, tubeBetween, braid } from './mixamoBody.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Body measurements reused by several pieces
export function measure(ctx, { hemAt = 'knee' } = {}) {
  const { m, H, frontZ, backZ, halfWidth, k } = ctx;
  const sw = Math.abs(m.shL.x - m.shR.x) / 2; // shoulder joint half-width
  const beltY = m.hips.y + (m.chest.y - m.hips.y) * 0.28;
  const waist = {
    hx: halfWidth(beltY, 0.03, sw * 0.95) + 0.018 * k,
    zf: frontZ(beltY, 0.03, sw * 0.95) + 0.016 * k,
    zb: backZ(beltY, 0.03, sw * 0.95) - 0.016 * k,
  };
  waist.zc = (waist.zf + waist.zb) / 2;
  waist.hz = (waist.zf - waist.zb) / 2;
  const shY = m.shL.y;
  const torso = {
    zf: frontZ(shY - 0.06 * k, 0.03, sw * 0.8),
    zb: backZ(shY - 0.06 * k, 0.03, sw * 0.8),
  };
  const hemY = hemAt === 'ankle'
    ? m.anL.y + (m.knL.y - m.anL.y) * 0.12
    : m.knL.y - (m.knL.y - m.anL.y) * 0.12;
  const faceZ = frontZ(m.head.y + H * 0.45, H * 0.1, H * 0.14);
  return { sw, beltY, waist, torso, hemY, faceZ, shY, H, k };
}

// Round fur hat: puffy fur ring, red crown dome, bronze knob, long red ribbon behind.
export function furHat(ctx, ms, c) {
  const { m, H, pin } = ctx;
  const g = new THREE.Group();
  const fur = lambert(c.fur), fur2 = lambert(c.fur2 || c.fur);
  const ring = new THREE.Mesh(lumpy(new THREE.TorusGeometry(H * 0.5, H * 0.26, 7, 14), H * 0.12), fur);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1.05, 1.05, 1.15);
  // shaggy tufts on the ring
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(H * 0.1, H * 0.22, 4), i % 2 ? fur : fur2);
    tuft.position.set(Math.sin(a) * H * 0.74, -H * 0.05 + (i % 3) * H * 0.04, Math.cos(a) * H * 0.74);
    tuft.lookAt(Math.sin(a) * H * 3, -H * 0.6, Math.cos(a) * H * 3);
    tuft.rotateX(Math.PI / 2);
    g.add(tuft);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(H * 0.5, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert(c.crown));
  crown.scale.y = 1.15;
  crown.position.y = H * 0.08;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.51, H * 0.53, H * 0.12, 12), lambert(c.crownDark || c.crown));
  band.position.y = H * 0.08;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.07, H * 0.1, H * 0.16, 6), lambert(c.knob));
  knob.position.y = H * 0.64;
  g.add(ring, band, crown, knob);
  // ribbon: pivot at the knob so it can flutter
  const rib = new THREE.Group();
  rib.position.y = H * 0.66;
  const rm = lambert(c.ribbon);
  rm.side = THREE.DoubleSide;
  const segs = [[0.0, 0.25, -0.35, 0.5], [0.15, 0.0, -0.55, 0.55], [0.25, -0.45, -0.45, 0.6]];
  let p = V(0, 0, 0);
  for (const [dx, dy, dz, w] of segs) {
    const d = V(dx, dy, dz).multiplyScalar(H * 1.25);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(H * 0.22 * w * 1.6, d.length()), rm);
    strip.position.copy(p).addScaledVector(d, 0.5);
    strip.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    strip.rotateY(0.6);
    rib.add(strip);
    p = p.clone().add(d);
  }
  // forked ribbon tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(H * 0.12, H * 0.35, 3), rm);
  tail.position.copy(p).add(V(0, -H * 0.12, 0));
  tail.rotation.x = Math.PI;
  rib.add(tail);
  g.add(rib);
  pin('Head', g, V(m.head.x, m.head.y + H * 0.86, m.head.z - H * 0.06));
  return { hat: g, ribbon: rib };
}

// Woman's cap (Hoelun): red cap with cream fur band and a silver ornament at the front.
export function furCap(ctx, ms, c) {
  const { m, H, pin } = ctx;
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.46, H * 0.56, H * 0.55, 10), lambert(c.cap));
  cap.position.y = H * 0.25;
  const top = new THREE.Mesh(new THREE.SphereGeometry(H * 0.46, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), lambert(c.cap));
  top.scale.y = 0.5;
  top.position.y = H * 0.52;
  const band = new THREE.Mesh(lumpy(new THREE.TorusGeometry(H * 0.56, H * 0.14, 6, 14), H * 0.06), lambert(c.fur));
  band.rotation.x = Math.PI / 2;
  band.position.y = H * 0.02;
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.13, H * 0.13, H * 0.05, 10), lambert(c.silver));
  disk.rotation.x = Math.PI / 2;
  disk.position.set(0, H * 0.3, H * 0.52);
  const stud = new THREE.Mesh(new THREE.SphereGeometry(H * 0.05, 6, 4), lambert(c.silver));
  stud.position.set(0, H * 0.3, H * 0.56);
  // ribbon/veil hanging at the back like the concept art
  const veil = new THREE.Mesh(new THREE.BoxGeometry(H * 0.5, H * 1.3, H * 0.04), lambert(c.capDark || c.cap));
  veil.position.set(H * 0.18, -H * 0.35, -H * 0.55);
  veil.rotation.set(0.25, 0, -0.12);
  g.add(cap, top, band, disk, stud, veil);
  pin('Head', g, V(m.head.x, m.head.y + H * 0.72, m.head.z - H * 0.05));
  return g;
}

// Hair: back mass, jagged fringe and side locks. style: 'jagged' (Temujin) | 'parted' (Hoelun)
export function hair(ctx, ms, c, style = 'jagged') {
  const { m, H, pin } = ctx;
  const dark = lambert(c.hair);
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.SphereGeometry(H * 0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), dark);
  back.position.set(0, H * 0.5, -H * 0.7);
  g.add(back);
  if (style === 'jagged') {
    for (let i = -3; i <= 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(H * 0.065, H * 0.17 + (i % 2 ? H * 0.05 : 0), 4), dark);
      f.position.set(i * H * 0.085, H * 0.6, -H * 0.06);
      f.rotation.set(Math.PI + 0.25, 0, i * 0.12);
      g.add(f);
    }
    for (const s of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(H * 0.1, H * 0.46, H * 0.2), dark);
      lock.position.set(s * H * 0.39, H * 0.38, -H * 0.24);
      lock.rotation.z = s * 0.08;
      g.add(lock);
      for (let j = 0; j < 2; j++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(H * 0.05, H * 0.16, 4), dark);
        spike.position.set(s * H * 0.39, H * 0.12 - j * H * 0.02, -H * 0.18 - j * H * 0.1);
        spike.rotation.x = Math.PI;
        g.add(spike);
      }
    }
  } else {
    // smooth centre-parted hair framing the face
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.SphereGeometry(H * 0.3, 7, 5), dark);
      side.scale.set(0.55, 1.15, 0.9);
      side.position.set(s * H * 0.33, H * 0.5, -H * 0.2);
      g.add(side);
    }
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(H * 0.7, H * 0.08, H * 0.12), dark);
    fringe.position.set(0, H * 0.66, -H * 0.06);
    g.add(fringe);
  }
  g.position.set(m.head.x, m.head.y, ms.faceZ);
  pin('Head', g, g.position.clone());
  return g;
}

// Face: eyes, brows, nose, mouth. look: 'stern' | 'soft'
export function face(ctx, ms, c, look = 'stern') {
  const { m, H, pin } = ctx;
  const dark = lambert(c.eye, false), browM = lambert(c.brow || c.hair), lip = lambert(c.lip), skinD = lambert(c.skinShade);
  const g = new THREE.Group();
  const stern = look === 'stern';
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(H * (stern ? 0.11 : 0.09), H * (stern ? 0.045 : 0.055), H * 0.07), dark);
    eye.position.set(s * H * 0.16, H * 0.37, -H * 0.01);
    eye.rotation.z = s * (stern ? -0.12 : 0.05);
    const white = new THREE.Mesh(new THREE.BoxGeometry(H * 0.04, H * 0.03, H * 0.07), lambert('#f1e6d6'));
    white.position.set(s * H * 0.205, H * 0.37, -H * 0.012);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(H * (stern ? 0.17 : 0.14), H * (stern ? 0.045 : 0.022), H * 0.07), browM);
    brow.position.set(s * H * 0.16, H * (stern ? 0.455 : 0.47), -H * 0.01);
    brow.rotation.z = s * (stern ? -0.28 : 0.12);
    g.add(white, eye, brow);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(H * 0.045, H * 0.14, 4), skinD);
  nose.position.set(0, H * 0.27, H * 0.01);
  nose.rotation.x = -0.3;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(H * (stern ? 0.13 : 0.1), H * 0.025, H * 0.06), lip);
  mouth.position.set(0, H * 0.13, -H * 0.05);
  g.add(nose, mouth);
  if (!stern) {
    for (const s of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(H * 0.06, 6), lambert('#c9785e'));
      blush.position.set(s * H * 0.22, H * 0.23, -H * 0.02);
      g.add(blush);
    }
  }
  g.position.set(m.head.x, m.head.y, ms.faceZ);
  pin('Head', g, g.position.clone());
  return g;
}

// Fur shoulder collar: open at the front, spiky lower edge.
export function furCollar(ctx, ms, c, { spikes = true, scale = 1 } = {}) {
  const { m, k, pin } = ctx;
  const fur = lambert(c.fur), fur2 = lambert(c.fur2 || c.fur);
  const g = new THREE.Group();
  const zc = (ms.torso.zf + ms.torso.zb) / 2;
  const depth = (ms.torso.zf - ms.torso.zb) / 2;
  const rTop = ms.sw * 0.62 * scale, rBot = ms.sw * 1.32 * scale, h = 0.15 * k * scale;
  const open = 0.42;
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 14, 2, true, open, Math.PI * 2 - open * 2);
  const shell = new THREE.Mesh(lumpy(geo, 0.025 * k), fur.clone());
  shell.material.side = THREE.DoubleSide;
  const zs = Math.max(0.6, (depth + 0.05 * k) / (rBot * 0.85));
  shell.scale.z = zs;
  g.add(shell);
  // a second, smaller upper layer for volume
  const geo2 = new THREE.CylinderGeometry(rTop * 0.92, rBot * 0.8, h * 0.8, 12, 1, true, open, Math.PI * 2 - open * 2);
  const shell2 = new THREE.Mesh(lumpy(geo2, 0.02 * k), fur2.clone());
  shell2.material.side = THREE.DoubleSide;
  shell2.scale.z = zs;
  shell2.position.y = h * 0.35;
  g.add(shell2);
  if (spikes) {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = open + (i + 0.5) / n * (Math.PI * 2 - open * 2);
      const len = (0.07 + (i % 3) * 0.025) * k * scale;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035 * k * scale, len, 4), i % 2 ? fur : fur2);
      sp.position.set(Math.sin(a) * rBot * 0.98, -h / 2 - len * 0.4, Math.cos(a) * rBot * 0.98 * zs);
      sp.rotation.x = Math.PI;
      sp.rotation.y = a;
      sp.scale.z = 0.5;
      g.add(sp);
    }
  }
  pin('Spine2', g, V(m.neck.x, ms.shY - 0.015 * k, zc));
  return g;
}

// Deel sleeves (wide, over the thin mannequin arms) with cuffs at the wrists.
export function sleeves(ctx, ms, c, { bell = 1 } = {}) {
  const { m, k, pin } = ctx;
  const cloth = lambert(c.deel), cuffM = lambert(c.cuff);
  for (const s of ['L', 'R']) {
    const sh = m['sh' + s], el = m['el' + s], wr = m['wr' + s];
    const dir = wr.clone().sub(el).normalize();
    const upA = sh.clone().lerp(el, 0.15);
    const up = tubeBetween(upA, el, 0.06 * k, 0.058 * k, cloth);
    pin(s === 'L' ? 'LeftArm' : 'RightArm', up.mesh, up.mid, up.quat);
    const wrEnd = wr.clone().addScaledVector(dir, -0.06 * k);
    const lo = tubeBetween(el, wrEnd, 0.058 * k, 0.066 * k * bell, cloth);
    pin(s === 'L' ? 'LeftForeArm' : 'RightForeArm', lo.mesh, lo.mid, lo.quat);
    const cuffA = wrEnd.clone().addScaledVector(dir, -0.005 * k), cuffB = wrEnd.clone().addScaledVector(dir, 0.055 * k);
    const cf = tubeBetween(cuffA, cuffB, 0.074 * k * bell, 0.078 * k * bell, cuffM);
    pin(s === 'L' ? 'LeftForeArm' : 'RightForeArm', cf.mesh, cf.mid, cf.quat);
  }
}

// Belt with a round buckle (bronze or silver).
export function belt(ctx, ms, c, { width = 0.075 } = {}) {
  const { m, k, pin } = ctx;
  const g = new THREE.Group();
  const w = ms.waist;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(w.hx, w.hx * 1.02, width * k, 14), lambert(c.belt));
  band.scale.z = w.hz / w.hx;
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(w.hx * 1.01, w.hx * 1.01, 0.012 * k, 14), lambert(c.beltEdge || c.belt));
  edge.scale.z = w.hz / w.hx;
  edge.position.y = width * k * 0.32;
  const edge2 = edge.clone();
  edge2.position.y = -width * k * 0.32;
  const buckle = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * k, 0.045 * k, 0.018 * k, 12), lambert(c.buckle));
  buckle.rotation.x = Math.PI / 2;
  buckle.position.z = w.hz + 0.006 * k;
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.026 * k, 0.006 * k, 4, 10), lambert(c.buckleDark || c.belt));
  knot.position.z = w.hz + 0.016 * k;
  g.add(band, edge, edge2, buckle, knot);
  pin('Hips', g, V(m.hips.x, ms.beltY, w.zc));
  return g;
}

// Deel skirt from the belt to the hem: two halves (left/right) on pivots at the belt so
// they can swing a little with the thighs and drape forward when riding.
export function skirt(ctx, ms, c, { flare = 1.0 } = {}) {
  const { m, k, pin } = ctx;
  const w = ms.waist;
  const top = ms.beltY - 0.02 * k, len = top - ms.hemY;
  const halves = [];
  for (const s of [1, -1]) { // +1 = character's left (+X)
    const pivot = new THREE.Group();
    const cloth = lambert(c.deel).clone();
    cloth.side = THREE.DoubleSide;
    const hemM = lambert(c.hem).clone();
    hemM.side = THREE.DoubleSide;
    // theta 0 = +Z (front); left half covers theta 0..PI on +X side
    const t0 = s > 0 ? 0 : Math.PI;
    const rT = w.hx * 0.98, rB = w.hx * 1.55 * flare;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, len, 9, 2, true, t0 - 0.03, Math.PI + 0.06), cloth);
    body.position.y = -len / 2;
    body.scale.z = (w.hz * 1.05) / w.hx;
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(rB * 1.005, rB * 1.03, 0.05 * k, 9, 1, true, t0 - 0.03, Math.PI + 0.06), hemM);
    hem.position.y = -len + 0.025 * k;
    hem.scale.z = body.scale.z;
    // tan front edge where the deel overlaps (visible line down the front)
    pivot.add(body, hem);
    if (s > 0) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03 * k, len, 0.012 * k), hemM);
      edge.position.set(0.035 * k, -len / 2, (w.hz * 1.05) * (1 + (rB / rT - 1) * 0.5));
      edge.rotation.x = -Math.atan2((rB - rT) * body.scale.z, len);
      pivot.add(edge);
    }
    pin('Hips', pivot, V(m.hips.x, top, w.zc));
    halves.push(pivot);
  }
  return halves; // [left, right]
}

// Diagonal deel overlap on the chest (tan lapel), following the chest surface.
export function lapel(ctx, ms, c) {
  const { m, k, pin, frontZ } = ctx;
  const g = new THREE.Group();
  const mat = lambert(c.hem);
  const y0 = m.neck.y - 0.03 * k, y1 = ms.beltY + 0.04 * k;
  const x0 = -0.025 * k, x1 = ms.waist.hx * 0.55;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const a = V(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, 0), b = V(x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, 0);
    a.z = frontZ(a.y, 0.02, 0.2) + 0.006 * k;
    b.z = frontZ(b.y, 0.02, 0.2) + 0.006 * k;
    const d = b.clone().sub(a);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035 * k, d.length() * 1.08, 0.01 * k), mat);
    seg.position.copy(a).addScaledVector(d, 0.5);
    seg.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    g.add(seg);
  }
  pin('Spine2', g, V(0, 0, 0));
  return g;
}

// Inner collar (Hoelun's blue inner collar showing at the neck)
export function innerCollar(ctx, ms, c) {
  const { m, k, pin, frontZ } = ctx;
  const g = new THREE.Group();
  const y = m.neck.y - 0.02 * k;
  const z = frontZ(y - 0.03 * k, 0.02, 0.08) + 0.004 * k;
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03 * k, 0.11 * k, 0.012 * k), lambert(c.inner));
    strip.position.set(s * 0.028 * k, y - 0.045 * k, z);
    strip.rotation.z = s * 0.5;
    g.add(strip);
  }
  pin('Spine2', g, V(0, 0, 0));
  return g;
}

// Boots: shaft on the shin, foot on the foot bone, tan top band.
export function boots(ctx, ms, c) {
  const { m, k, pin } = ctx;
  const leather = lambert(c.boot), top = lambert(c.bootTop), sole = lambert(c.sole);
  for (const s of ['L', 'R']) {
    const knee = m['kn' + s], ankle = m['an' + s], toe = m['toe' + s], tip = m['tip' + s];
    const shaftH = (knee.y - ankle.y) * 0.62;
    const shaft = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.064 * k, 0.057 * k, shaftH, 7), leather);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * k, 0.07 * k, 0.04 * k, 7), top);
    cuff.position.y = shaftH / 2 - 0.01 * k;
    shaft.add(tube, cuff);
    pin(s === 'L' ? 'LeftLeg' : 'RightLeg', shaft, V(ankle.x, ankle.y + shaftH / 2 - 0.02 * k, ankle.z - 0.005 * k));
    const len = tip.z - ankle.z + 0.075 * k;
    const foot = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.105 * k, 0.09 * k, len), leather);
    const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.1 * k, 0.06 * k, 0.05 * k), leather);
    toeCap.position.set(0, -0.012 * k, len / 2 + 0.01 * k);
    toeCap.rotation.x = -0.35; // Mongol boots turn up at the toe
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.112 * k, 0.025 * k, len + 0.012 * k), sole);
    sl.position.y = -0.055 * k;
    foot.add(upper, toeCap, sl);
    pin(s === 'L' ? 'LeftFoot' : 'RightFoot', foot, V((ankle.x + toe.x) / 2, Math.max(0.06 * k, toe.y + 0.018 * k), ankle.z + len / 2 - 0.06 * k));
  }
}

// Two braids hanging IN FRONT of the shoulders, ending in tassels (pinned to the chest).
export function frontBraids(ctx, ms, c, { length = 'chest', rings = 0 } = {}) {
  const { m, H, k, pin, frontZ } = ctx;
  const g = new THREE.Group();
  const hairM = lambert(c.hair), tipM = lambert(c.tassel), ringM = c.ring ? lambert(c.ring) : null;
  for (const s of [-1, 1]) {
    const p0 = V(s * H * 0.4, m.head.y + H * 0.2, ms.faceZ - H * 0.32);
    const endY = length === 'waist' ? ms.beltY + 0.02 * k : ms.shY - 0.13 * k;
    const midY = ms.shY + 0.02 * k;
    const x1 = s * (ms.sw * 0.55), x2 = s * (ms.sw * 0.5);
    const p1 = V(x1, midY, frontZ(midY - 0.05 * k, 0.03, ms.sw) + 0.07 * k);
    const p2 = V(x2, endY, frontZ(endY, 0.03, ms.sw) + 0.045 * k);
    g.add(braid(p0, p1, p2, 0.017 * k, hairM, tipM, ringM, rings));
  }
  pin('Spine2', g, V(0, 0, 0));
  return g;
}
