// Runtime skin for the clothed sculpt, plus authored Idle/Walk/Run.
// base_basic_shaded.glb has no skeleton. temujin.glb is a Mixamo T-pose with no clips
// and a different mesh, so its bind pose is not applied to the costume.
// Bone proportions follow that skeleton. The rest pose is the sculpt itself.
import * as THREE from 'three';

const _v = new THREE.Vector3();

function distToSeg(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const ab2 = abx * abx + aby * aby + abz * abz || 1e-8;
  let t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / ab2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = ax + abx * t - px;
  const dy = ay + aby * t - py;
  const dz = az + abz * t - pz;
  return dx * dx + dy * dy + dz * dz;
}

function bone(name, parent, x, y, z) {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  parent?.add(b);
  return b;
}

function solveLeg(hip, target, l1, l2) {
  const dz = target.z - hip.z;
  const dy = target.y - hip.y;
  let dist = Math.hypot(dz, dy);
  const max = l1 + l2 - 1e-4;
  const min = Math.abs(l1 - l2) + 1e-4;
  dist = THREE.MathUtils.clamp(dist, min, max);
  const cosKnee = THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2), -1, 1);
  const knee = Math.PI - Math.acos(cosKnee);
  const cosHip = THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const alpha = Math.acos(cosHip);
  const ang = Math.atan2(dz, -dy);
  return { thighX: ang + alpha, kneeX: knee };
}

/**
 * Replace a static clothed mesh with a skinned one. `scale` is the parent uniform
 * scale already applied, so gait speed in world meters converts back to bind units.
 */
export function attachGait(srcMesh, scale = 1) {
  const geo = srcMesh.geometry;
  const pos = geo.attributes.position;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const H = box.max.y - box.min.y || 1;
  const y0 = box.min.y;
  const cx = (box.min.x + box.max.x) * 0.5;

  const hipY = y0 + H * 0.53;
  const kneeY = y0 + H * 0.30;
  const ankleY = y0 + H * 0.055;
  const shoulderY = y0 + H * 0.80;
  const elbowY = y0 + H * 0.62;
  const handY = y0 + H * 0.47;
  const side = H * 0.045;
  const armX = H * 0.105;

  const hips = bone('hips', null, cx, hipY, 0.02 * H);
  const spine = bone('spine', hips, 0, H * 0.08, 0);
  const chest = bone('chest', spine, 0, H * 0.12, 0);
  const neck = bone('neck', chest, 0, H * 0.09, 0);
  const head = bone('head', neck, 0, H * 0.06, 0);
  const leftUp = bone('leftUpLeg', hips, side, -H * 0.02, 0);
  const leftLeg = bone('leftLeg', leftUp, 0, kneeY - hipY, 0);
  const leftFoot = bone('leftFoot', leftLeg, 0, ankleY - kneeY, 0.02 * H);
  const rightUp = bone('rightUpLeg', hips, -side, -H * 0.02, 0);
  const rightLeg = bone('rightLeg', rightUp, 0, kneeY - hipY, 0);
  const rightFoot = bone('rightFoot', rightLeg, 0, ankleY - kneeY, 0.02 * H);
  const leftArm = bone('leftArm', chest, armX, shoulderY - (hipY + H * 0.20), 0);
  const leftFore = bone('leftForeArm', leftArm, H * 0.02, elbowY - shoulderY, 0);
  const leftHand = bone('leftHand', leftFore, 0, handY - elbowY, 0);
  const rightArm = bone('rightArm', chest, -armX, shoulderY - (hipY + H * 0.20), 0);
  const rightFore = bone('rightForeArm', rightArm, -H * 0.02, elbowY - shoulderY, 0);
  const rightHand = bone('rightHand', rightFore, 0, handY - elbowY, 0);

  const bones = [
    hips, spine, chest, neck, head,
    leftUp, leftLeg, leftFoot,
    rightUp, rightLeg, rightFoot,
    leftArm, leftFore, leftHand,
    rightArm, rightFore, rightHand,
  ];

  const segs = [
    [hips, spine, 0.11],
    [spine, chest, 0.12],
    [chest, neck, 0.10],
    [neck, head, 0.09],
    [leftUp, leftLeg, 0.075],
    [leftLeg, leftFoot, 0.065],
    [rightUp, rightLeg, 0.075],
    [rightLeg, rightFoot, 0.065],
    [leftArm, leftFore, 0.055],
    [leftFore, leftHand, 0.05],
    [rightArm, rightFore, 0.055],
    [rightFore, rightHand, 0.05],
  ];
  const segPos = segs.map(([a, b]) => {
    const aw = new THREE.Vector3();
    const bw = new THREE.Vector3();
    a.updateWorldMatrix(true, false);
    b.updateWorldMatrix(true, false);
    a.getWorldPosition(aw);
    b.getWorldPosition(bw);
    return [aw, bw];
  });
  const bindIndex = new Map(bones.map((b, i) => [b, i]));

  const count = pos.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const scratch = new Float32Array(bones.length);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    for (let s = 0; s < segs.length; s++) {
      const [aw, bw] = segPos[s];
      const d2 = distToSeg(x, y, z, aw.x, aw.y, aw.z, bw.x, bw.y, bw.z);
      const sigma = segs[s][2] * H;
      let w = Math.exp(-d2 / (sigma * sigma));
      const boneA = segs[s][0];
      const name = boneA.name;
      if (name.startsWith('left') && x < cx) w *= 0.15;
      if (name.startsWith('right') && x > cx) w *= 0.15;
      if ((name === 'leftUpLeg' || name === 'leftLeg' || name === 'rightUpLeg' || name === 'rightLeg') && y > shoulderY) w *= 0.02;
      if ((name === 'leftArm' || name === 'leftForeArm' || name === 'rightArm' || name === 'rightForeArm') && y < hipY * 0.72) w *= 0.05;
      scratch[bindIndex.get(boneA)] += w;
      scratch[bindIndex.get(segs[s][1])] += w * 0.35;
    }
    if (y < y0 + H * 0.12) {
      const foot = x >= cx ? leftFoot : rightFoot;
      scratch[bindIndex.get(foot)] += 1.4;
    }
    let i0 = 0;
    let i1 = 0;
    let i2 = 0;
    let i3 = 0;
    let b0 = -1;
    let b1 = -1;
    let b2 = -1;
    let b3 = -1;
    for (let b = 0; b < bones.length; b++) {
      const w = scratch[b];
      scratch[b] = 0;
      if (w > b0) { b3 = b2; i3 = i2; b2 = b1; i2 = i1; b1 = b0; i1 = i0; b0 = w; i0 = b; }
      else if (w > b1) { b3 = b2; i3 = i2; b2 = b1; i2 = i1; b1 = w; i1 = b; }
      else if (w > b2) { b3 = b2; i3 = i2; b2 = w; i2 = b; }
      else if (w > b3) { b3 = w; i3 = b; }
    }
    let sum = b0 + b1 + b2 + b3;
    if (sum < 1e-5) {
      i0 = 0; b0 = 1; b1 = b2 = b3 = 0; sum = 1;
    }
    const o = i * 4;
    indices[o] = i0;
    indices[o + 1] = i1;
    indices[o + 2] = i2;
    indices[o + 3] = i3;
    weights[o] = b0 / sum;
    weights[o + 1] = b1 / sum;
    weights[o + 2] = b2 / sum;
    weights[o + 3] = b3 / sum;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));

  const mesh = new THREE.SkinnedMesh(geo, srcMesh.material);
  mesh.name = 'temujin-skinned';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.add(hips);
  const skeleton = new THREE.Skeleton(bones);
  mesh.updateMatrixWorld(true);
  mesh.bind(skeleton);

  const hipRest = hips.position.y;
  const restOf = (b, out) => {
    out.set(0, 0, 0);
    let n = b;
    while (n) {
      out.add(n.position);
      n = n.parent && n.parent.isBone ? n.parent : null;
    }
    return out;
  };
  const leftHip = restOf(leftUp, new THREE.Vector3());
  const rightHip = restOf(rightUp, new THREE.Vector3());
  const leftAnkle = restOf(leftFoot, new THREE.Vector3());
  const rightAnkle = restOf(rightFoot, new THREE.Vector3());
  const l1 = leftHip.distanceTo(restOf(leftLeg, new THREE.Vector3()));
  const l2 = restOf(leftLeg, new THREE.Vector3()).distanceTo(leftAnkle);
  const target = new THREE.Vector3();

  let phase = 0;
  let amp = 0;
  let breath = 0;
  let speed = 0;
  let yaw = 0;
  let yawRate = 0;
  let spineYaw = 0;
  let yawPrimed = false;

  function pick(pred) {
    let best = 0;
    let bestS = -1;
    for (let i = 0; i < count; i += 40) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const s = pred(x, y, z);
      if (s > bestS) { bestS = s; best = i; }
    }
    return best;
  }
  const samples = {
    leftBoot: pick((x, y) => (x > cx + 0.04 && y < y0 + H * 0.12 ? 10 - y : -1)),
    rightBoot: pick((x, y) => (x < cx - 0.04 && y < y0 + H * 0.12 ? 10 - y : -1)),
    leftSleeve: pick((x, y) => (x > cx + 0.12 && y > elbowY - 0.08 && y < shoulderY ? x : -1)),
  };

  function update(dt, worldSpeed) {
    speed = worldSpeed || 0;
    const moving = speed > 0.08;
    const run = THREE.MathUtils.smoothstep(speed, 2.3, 4.2);
    const ampTarget = moving ? 1 : 0;
    const k = 1 - Math.exp(-dt * (moving ? 6 : 4));
    amp += (ampTarget - amp) * k;
    breath += dt;
    const localSpeed = speed / (scale || 1);
    const stride = (0.20 + run * 0.08) * (0.35 + 0.65 * amp);
    const omega = moving ? Math.max(localSpeed / Math.max(stride, 0.08), 3.2 + run * 2.4) : 0;
    phase += dt * omega;

    const lift = (0.035 + run * 0.05) * amp;
    const poseLeg = (up, knee, foot, hipPos, ankleRest, ph) => {
      const z = Math.sin(ph) * stride;
      const yLift = Math.max(0, Math.cos(ph)) * lift;
      target.set(ankleRest.x, ankleRest.y + yLift, ankleRest.z + z);
      const solved = solveLeg(hipPos, target, l1, l2);
      // Positive X rotation swings a downward bone toward -Z. The sculpt faces +Z.
      up.rotation.x = -solved.thighX;
      knee.rotation.x = solved.kneeX;
      foot.rotation.x = -solved.kneeX * 0.35;
    };
    poseLeg(leftUp, leftLeg, leftFoot, leftHip, leftAnkle, phase);
    poseLeg(rightUp, rightLeg, rightFoot, rightHip, rightAnkle, phase + Math.PI);

    const armAmp = (0.45 + run * 0.28) * amp;
    const elbowAmp = (0.35 + run * 0.4) * amp;
    leftArm.rotation.x = Math.sin(phase) * armAmp;
    rightArm.rotation.x = Math.sin(phase + Math.PI) * armAmp;
    leftFore.rotation.x = 0.35 * (1 - amp * 0.3) + Math.max(0, Math.sin(phase + Math.PI + 0.6)) * elbowAmp;
    rightFore.rotation.x = 0.35 * (1 - amp * 0.3) + Math.max(0, Math.sin(phase + 0.6)) * elbowAmp;
    leftArm.rotation.z = 0.08;
    rightArm.rotation.z = -0.08;

    const lean = 0.03 * run + Math.sin(phase * 2) * 0.02 * amp;
    spine.rotation.x = lean + Math.sin(breath * 1.5) * 0.012 * (1 - amp * 0.7);
    chest.rotation.x = Math.sin(breath * 1.5 + 0.4) * 0.01;
    const yawTarget = THREE.MathUtils.clamp(yawRate * 0.12, -0.16, 0.16);
    spineYaw += (yawTarget - spineYaw) * (1 - Math.exp(-dt * 6));
    spine.rotation.y = spineYaw;
    hips.rotation.y = Math.sin(phase) * 0.05 * amp;
    hips.position.y = hipRest + (Math.abs(Math.cos(phase)) - 0.5) * 0.02 * amp;
    yawRate = 0;
  }

  function setYaw(next) {
    if (!yawPrimed) {
      yaw = next;
      yawPrimed = true;
      return;
    }
    let d = next - yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    yawRate = d;
    yaw = next;
  }

  function poseSample() {
    mesh.updateMatrixWorld(true);
    const out = {};
    for (const [name, index] of Object.entries(samples)) {
      mesh.getVertexPosition(index, _v);
      mesh.localToWorld(_v);
      out[name] = [Math.round(_v.x * 1000) / 1000, Math.round(_v.y * 1000) / 1000, Math.round(_v.z * 1000) / 1000];
    }
    const e = (b) => Math.round(b.rotation.x * 1000) / 1000;
    return {
      amp: Math.round(amp * 1000) / 1000,
      phase: Math.round(phase * 1000) / 1000,
      bones: {
        leftThigh: e(leftUp),
        leftKnee: e(leftLeg),
        rightThigh: e(rightUp),
        rightKnee: e(rightLeg),
        leftArm: e(leftArm),
        leftElbow: e(leftFore),
        rightArm: e(rightArm),
        rightElbow: e(rightFore),
        spine: Math.round(spine.rotation.x * 1000) / 1000,
        hipsY: Math.round(hips.position.y * 1000) / 1000,
      },
      verts: out,
    };
  }

  return { mesh, update, setYaw, poseSample };
}
