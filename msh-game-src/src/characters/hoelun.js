// Өэлүн эх — swappable character module (jointed low-poly humanoid, concept-art colours).
//
// Interface used by world.js (keep this when swapping):
//   createHoelun() -> THREE.Group   (feet at y=0, facing +Z)
//   group.userData.update(t, lookAtWorldPos)   called every frame
//
// TO SWAP IN A GLB (Tripo / Meshy):
//   1. Put it at public/models/hoelun.glb
//   2. Set HOELUN_GLB_URL = './models/hoelun.glb'

import * as THREE from 'three';
import { buildHumanoid } from './humanoid.js';
import { loadGlb } from './glb.js';

export const HOELUN_GLB_URL = null;
const HEIGHT = 1.64;

export function createHoelun() {
  const group = new THREE.Group();
  // Colors from the Hoelun concept art (dark red deel, fur collar and cap, braids)
  const h = buildHumanoid({
    height: HEIGHT,
    build: 'female',
    robeLength: 1,
    hat: 'furCap',
    furMantle: true,
    braids: true,
    colors: {
      deel: '#7a2430', trim: '#c9993f', inner: '#3b4a6b', belt: '#5a3a22', buckle: '#c8c9cf',
      pants: '#4a2a1c', boot: '#3a2416', skin: '#c68d62', hair: '#1c1414', fur: '#d8c6a4',
      hat: '#7e1f28', ribbon: '#8e2a2c', eye: '#1c1410', brow: '#3a2418', lip: '#9a5a48',
    },
  });
  // hands folded in front, as in the concept art
  h.pose = (t) => {
    h.rig.torso.rotation.x = Math.sin(t * 1.6) * 0.012;
    h.rig.arms.forEach((a, i) => {
      a.shoulder.rotation.x = -0.35;
      a.shoulder.rotation.z = (i ? 1 : -1) * -0.25;
      a.elbow.rotation.x = -1.2;
    });
    if (h.rig.ribbon) h.rig.ribbon.rotation.x = 0.2 + Math.sin(t * 3) * 0.12;
  };
  group.add(h.root);

  const tmp = new THREE.Vector3();
  group.userData.update = (t, lookAt) => {
    h.pose(t);
    if (lookAt) {
      group.worldToLocal(tmp.copy(lookAt));
      const yaw = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -0.9, 0.9);
      h.rig.neck.rotation.y += (yaw - h.rig.neck.rotation.y) * 0.08;
    }
  };
  if (HOELUN_GLB_URL) loadGlb(group, h.root, HOELUN_GLB_URL, HEIGHT);
  return group;
}
