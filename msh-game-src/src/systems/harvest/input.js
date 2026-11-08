/**
 * input.js — Удирдлага (keyboard + mouse + gamepad + touch in one object)
 *
 * Source / idea: Walden `game/src/input.js` (xikhar/Walden, NO license file → re-implemented from its API shape,
 *   no code copied): `down(code)` held, `hit(code)` pressed-this-frame (cleared by `endFrame()`), accumulated mouse
 *   deltas while pointer-locked or middle-dragging, wheel sign, blur clears keys. Also cybercity `engine/Input.js`
 *   pattern of a `scripted` flag that mutes input during shots. Added: gamepad sticks, touch (left half = move
 *   stick, right half = look), `axis()` returning the camera-relative wish vector used by player-move.js.
 * License of this file: MIT (MSH project).
 *
 * Wire into demo-slice/src/main.js (replaces the `keys` object + pointer handlers):
 *   import { createInput } from './systems/input.js';
 *   const input = createInput(canvas, { lock: false });     // lock: true → click to capture mouse (Walden)
 *   // tick():  const a = input.axis();  mover.step(dt, { forward: a.y > 0.2, back: a.y < -0.2, left: a.x < -0.2, right: a.x > 0.2 }, ...)
 *   //          cam.lookDelta(input.mouseDX, input.mouseDY);  if (input.hit('KeyE')) talk(nearest());  input.endFrame();
 */
export function createInput(dom, opts = {}) {
  const keys = new Set(), pressed = new Set();
  const st = { mouseDX: 0, mouseDY: 0, wheel: 0, locked: false, dragging: false, muted: false, touchMove: { x: 0, y: 0 } };
  const wantLock = !!opts.lock;
  const lookSens = opts.lookSens ?? 1;

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code); pressed.add(e.code);
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    pressed.add(e.button === 2 ? 'MouseRight' : e.button === 0 ? 'MouseLeft' : 'MouseMiddle');
    if (e.button === 0 && wantLock) requestLock();
    if (e.button === 0 || e.button === 1) st.dragging = true;
  });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') st.dragging = false; });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (st.locked || st.dragging) { st.mouseDX += e.movementX * lookSens; st.mouseDY += e.movementY * lookSens; }
  });
  dom.addEventListener('wheel', (e) => { st.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerlockchange', () => { st.locked = document.pointerLockElement === dom; });

  // touch: left half = virtual stick (relative to first touch), right half = look drag
  const touches = new Map();
  dom.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      const role = t.clientX < innerWidth * 0.5 ? 'move' : 'look';
      touches.set(t.identifier, { role, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY });
      if (role === 'look' && e.changedTouches.length === 1 && touches.size === 1) pressed.add('Tap');
    }
    e.preventDefault();
  }, { passive: false });
  dom.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      const k = touches.get(t.identifier); if (!k) continue;
      if (k.role === 'look') { st.mouseDX += (t.clientX - k.x) * 1.6 * lookSens; st.mouseDY += (t.clientY - k.y) * 1.6 * lookSens; }
      k.x = t.clientX; k.y = t.clientY;
      if (k.role === 'move') {
        const r = 60;
        st.touchMove.x = Math.max(-1, Math.min(1, (k.x - k.x0) / r));
        st.touchMove.y = Math.max(-1, Math.min(1, -(k.y - k.y0) / r));
      }
    }
    e.preventDefault();
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) { const k = touches.get(t.identifier); if (k?.role === 'move') st.touchMove.x = st.touchMove.y = 0; touches.delete(t.identifier); }
  };
  dom.addEventListener('touchend', endTouch);
  dom.addEventListener('touchcancel', endTouch);

  function requestLock() {
    if (!st.locked && dom.requestPointerLock) { try { dom.requestPointerLock()?.catch?.(() => {}); } catch { /* unsupported */ } }
  }
  function gamepad() {
    const gp = navigator.getGamepads?.()?.[0];
    if (!gp) return null;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    return { lx: dz(gp.axes[0]), ly: dz(gp.axes[1]), rx: dz(gp.axes[2] ?? 0), ry: dz(gp.axes[3] ?? 0), a: !!gp.buttons[0]?.pressed };
  }

  const axis = { x: 0, y: 0 };
  return {
    state: st,
    down: (code) => !st.muted && keys.has(code),
    hit: (code) => !st.muted && pressed.has(code),
    get mouseDX() { return st.muted ? 0 : st.mouseDX; },
    get mouseDY() { return st.muted ? 0 : st.mouseDY; },
    get wheel() { return st.muted ? 0 : st.wheel; },
    get locked() { return st.locked; },
    requestLock,
    /** Move wish in [-1,1]²: x = strafe right, y = forward. Keyboard, gamepad left stick, touch stick merged. */
    axis() {
      if (st.muted) { axis.x = axis.y = 0; return axis; }
      let x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      let y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const gp = gamepad();
      if (gp) { x += gp.lx; y -= gp.ly; st.mouseDX += gp.rx * 14; st.mouseDY += gp.ry * 10; if (gp.a) pressed.add('KeyE'); }
      x += st.touchMove.x; y += st.touchMove.y;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      axis.x = x; axis.y = y;
      return axis;
    },
    /** Call once at the end of every frame. */
    endFrame() { pressed.clear(); st.mouseDX = st.mouseDY = st.wheel = 0; },
  };
}
