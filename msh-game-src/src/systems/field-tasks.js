/** Camp tasks: gather wood, ride three gates, herd sheep, shoot the target. */
import * as THREE from 'three';

const flat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

export function createFieldTasks(scene, heightAt) {
  const root = new THREE.Group();
  root.name = 'field-tasks';
  scene.add(root);
  const y = (x, z) => (heightAt?.(x, z) ?? 0);

  const gatherAt = new THREE.Vector3(14, y(14, 22), 22);
  const gates = [24, 32, 40].map((x) => ({ x, z: 12, passed: false }));
  const pen = new THREE.Vector3(-18, y(-18, 16), 16);
  const target = new THREE.Vector3(8, y(8, 36) + 1.45, 36);
  const shootFrom = new THREE.Vector3(8, y(8, 44), 44);

  const logs = new THREE.Group();
  logs.position.copy(gatherAt);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6), flat('#6a4428'));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i * 0.4;
    log.position.y = 0.16 + i * 0.12;
    logs.add(log);
  }
  root.add(logs);

  const wood = flat('#8a5a32');
  for (const gate of gates) {
    const g = new THREE.Group();
    g.position.set(gate.x, y(gate.x, gate.z), gate.z);
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6);
    const left = new THREE.Mesh(postGeo, wood);
    left.position.set(0, 1.2, -1.3);
    const right = new THREE.Mesh(postGeo, wood);
    right.position.set(0, 1.2, 1.3);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 2.8), wood);
    bar.position.y = 2.35;
    g.add(left, right, bar);
    root.add(g);
    gate.group = g;
  }

  const penPosts = new THREE.Group();
  penPosts.position.copy(pen);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 5), wood);
    p.position.set(x, 0.55, z);
    penPosts.add(p);
  }
  root.add(penPosts);

  const sheep = [-12, -11, -13].map((x, i) => {
    const s = new THREE.Group();
    s.name = 'sheep';
    const z = 15 + i;
    s.position.set(x, y(x, z), z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), flat('#f4efe6'));
    body.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), flat('#d8c8a8'));
    head.position.set(0.4, 0.5, 0);
    s.add(body, head);
    root.add(s);
    s.userData.home = s.position.clone();
    return s;
  });

  const board = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), flat('#f2efe6'));
  board.position.copy(target);
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), flat('#9a1e24'));
  ring.position.set(0, 0, 0.02);
  const bull = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), flat('#f0d090'));
  bull.position.set(0, 0, 0.04);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), wood);
  stand.position.set(target.x, target.y - 0.7, target.z);
  board.add(ring, bull);
  root.add(board, stand);

  const arrows = [];
  const prev = new THREE.Vector3();
  let havePrev = false;
  let gathered = false;
  let herded = false;
  let hunted = false;
  let just = '';

  function shoot(pos, yaw) {
    const dir = new THREE.Vector3(-Math.sin(yaw), 0.02, -Math.cos(yaw)).normalize();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), flat('#c4a574'));
    mesh.position.set(pos.x, pos.y + 1.35, pos.z);
    mesh.lookAt(mesh.position.clone().add(dir));
    root.add(mesh);
    arrows.push({ mesh, dir, life: 1.6 });
  }

  function line() {
    const passed = gates.filter((g) => g.passed).length;
    const penned = sheep.filter((s) => s.userData.inPen).length;
    return [
      gathered ? 'Мод бэлэн' : 'Мод түү',
      `Хаалга ${passed}/3`,
      herded ? 'Сүрэг хотонд' : `Хонь ${penned}/3`,
      hunted ? 'Онилов' : 'Нум харва',
    ].join(' · ');
  }

  function update(dt, pos, input = {}) {
    just = '';
    dt = Math.min(dt || 0, 0.05);
    if (!gathered && pos.distanceTo(gatherAt) < 2.4) {
      gathered = true;
      logs.visible = false;
      just = 'Мод түүв.';
    }
    if (input.mounted && havePrev) {
      for (const gate of gates) {
        if (gate.passed) continue;
        const crossed = (prev.x - gate.x) * (pos.x - gate.x) < 0;
        const inLane = Math.abs(pos.z - gate.z) < 2.4 && Math.abs(prev.z - gate.z) < 2.4;
        if (crossed && inLane) {
          gate.passed = true;
          just = gates.every((g) => g.passed) ? 'Гурван хаалгаар давхив.' : `Хаалга ${gates.filter((g) => g.passed).length}/3`;
        }
      }
    }
    let penned = 0;
    for (const s of sheep) {
      if (s.userData.inPen) {
        penned += 1;
        continue;
      }
      const distPen = s.position.distanceTo(pen);
      if (distPen < 2.1) {
        s.userData.inPen = true;
        penned += 1;
        continue;
      }
      if (pos.distanceTo(s.position) < 7) {
        const step = pen.clone().sub(s.position);
        if (step.lengthSq() > 1e-4) {
          step.normalize().multiplyScalar(3.4 * dt);
          s.position.add(step);
          s.position.y = y(s.position.x, s.position.z);
          s.lookAt(pen.x, s.position.y, pen.z);
        }
      }
    }
    if (!herded && penned === sheep.length) {
      herded = true;
      just = 'Хонио хотондоо туув.';
    }
    if (input.shoot) shoot(pos, input.yaw || 0);
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i];
      arrow.mesh.position.addScaledVector(arrow.dir, 24 * dt);
      arrow.life -= dt;
      if (!hunted && arrow.mesh.position.distanceTo(target) < 1.35) {
        hunted = true;
        just = 'Онионд тусав.';
      }
      if (arrow.life <= 0) {
        root.remove(arrow.mesh);
        arrows.splice(i, 1);
      }
    }
    prev.copy(pos);
    havePrev = true;
    return status();
  }

  function status() {
    return {
      gathered,
      gates: gates.filter((g) => g.passed).length,
      raced: gates.every((g) => g.passed),
      penned: sheep.filter((s) => s.userData.inPen).length,
      herded,
      hunted,
      line: line(),
      just,
      spots: {
        gather: [gatherAt.x, gatherAt.z],
        gates: gates.map((g) => [g.x, g.z]),
        herd: [pen.x, pen.z],
        shoot: [shootFrom.x, shootFrom.z],
        target: [target.x, target.z],
      },
    };
  }

  function aimYaw(from) {
    const origin = from || shootFrom;
    return Math.atan2(-(target.x - origin.x), -(target.z - origin.z));
  }

  return {
    update,
    status,
    shoot,
    aimYaw,
    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        o.geometry?.dispose?.();
      });
    },
  };
}
