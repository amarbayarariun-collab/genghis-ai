// A single Taichiud watcher beside the south path.
// One timing beat: he raises the spear, you push back on the open moment.
// No stance list, no blade arts, no damage.
import * as THREE from 'three';

const AT = { x: 9.2, z: 16.4 };
const IDLE = { prompt: '', toast: '', resolved: false };

function felt(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function createEncounter(scene, world) {
  const group = new THREE.Group();
  group.name = 'taichiud-watcher';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.95, 7), felt('#6e2430'));
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), felt('#c48a5e'));
  head.position.y = 1.48;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 6), felt('#3a2418'));
  cap.position.y = 1.68;
  const spear = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 5), felt('#8a6a3a'));
  shaft.position.y = 0.7;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), felt('#d7d0c4'));
  tip.position.y = 1.6;
  spear.add(shaft, tip);
  spear.position.set(0.28, 0.7, 0.05);
  spear.rotation.z = 0.35;
  group.add(body, head, cap, spear);
  const y = world.heightAt?.(AT.x, AT.z) ?? 0;
  group.position.set(AT.x, y, AT.z);
  group.rotation.y = Math.PI / 2;

  const col = { x: AT.x, z: AT.z, r: 0.5, kind: 'scout' };
  let shown = false;
  function show() {
    if (shown) return;
    shown = true;
    scene.add(group);
    world.colliders?.push(col);
  }
  function hide() {
    if (!shown) return;
    shown = false;
    scene.remove(group);
    const list = world.colliders;
    const i = list?.indexOf(col) ?? -1;
    if (i >= 0) list.splice(i, 1);
  }

  let phase = 'watch';
  let clock = 0;
  let toast = '';
  let toastLife = 0;
  const home = group.position.clone();

  function dropCollider() {
    const list = world.colliders;
    const i = list?.indexOf(col) ?? -1;
    if (i >= 0) list.splice(i, 1);
  }

  return {
    update(dt, player, pressed) {
      toastLife = Math.max(0, toastLife - dt);
      if (toastLife === 0) toast = '';
      const dx = player.x - AT.x;
      const dz = player.z - AT.z;
      const dist2 = dx * dx + dz * dz;
      if (phase === 'watch' && dist2 > 196) {
        hide();
        return IDLE;
      }
      show();
      const near = dist2 < 9.6;

      if (phase === 'watch') {
        spear.rotation.z += (0.35 - spear.rotation.z) * Math.min(1, dt * 4);
        if (near && pressed) {
          phase = 'brace';
          clock = 0;
        }
      } else if (phase === 'brace') {
        clock += dt;
        const k = Math.min(1, clock / 0.7);
        spear.rotation.z = 0.35 + k * -1.15;
        const windowOpen = clock > 0.28 && clock < 0.72;
        if (windowOpen && pressed) {
          phase = 'yield';
          clock = 0;
          dropCollider();
          toast = 'Тайчууд буцлаа. Зам чинь нээлттэй.';
          toastLife = 3.2;
          return { prompt: '', toast, resolved: true };
        }
        if (clock >= 0.78) {
          phase = 'watch';
          toast = 'Эртдэв. Дахиад ойрт.';
          toastLife = 1.4;
        }
      } else if (phase === 'yield') {
        clock += dt;
        group.position.x = home.x + Math.min(4.5, clock * 1.6);
        group.position.y = world.heightAt?.(group.position.x, group.position.z) ?? home.y;
        spear.rotation.z += (0.9 - spear.rotation.z) * Math.min(1, dt * 3);
        if (clock > 3.2) {
          phase = 'left';
          group.visible = false;
        }
      }

      let prompt = '';
      if (phase === 'watch' && near) prompt = 'F · жад түлх';
      else if (phase === 'brace' && clock > 0.28 && clock < 0.72) prompt = 'F · одоо түлх';
      else if (phase === 'brace') prompt = 'Хүлээ…';
      return { prompt, toast: toastLife > 0 ? toast : '', resolved: false };
    },
    dispose() {
      dropCollider();
      scene.remove(group);
      group.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material && !o.material.dispose?.done) o.material.dispose?.();
      });
    },
  };
}
