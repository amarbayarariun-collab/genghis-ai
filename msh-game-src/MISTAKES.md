# Mistakes library

Format: error message → cause → fix

1. **Build output breaks when opened from a subfolder (GitHub Pages)**: assets load from `/assets/...` and 404.
   → Cause: Vite defaults `base` to `/`.
   → Fix: `base: './'` in `vite.config.js`.

2. **Drag-to-look rotates the camera like a rolling ball / horizon tilts.**
   → Cause: default Euler order `XYZ` applies pitch before yaw.
   → Fix: `camera.rotation.set(pitch, yaw, 0, 'YXZ')`.

3. **Pointer lock fails inside embedded previews** (`The root document of this element is not valid for pointer lock`).
   → Cause: iframes without `allow-pointer-lock`.
   → Fix: use drag-to-look instead of pointer lock for the demo.

4. **Ground right in front of the camera renders solid black** (no console error).
   → Cause: `flatShading: true` computes normals from screen-space derivatives; on some GPUs / software renderers they break up close.
   → Fix: `geo.toNonIndexed(); geo.computeVertexNormals();` and drop `flatShading`. Debug trick: swap the material to `MeshBasicMaterial({color:'#00ff00'})` to see if the mesh is drawn at all.

5. **River invisible.**
   → Cause: river mesh sat at y=0.08 but the terrain around it was higher, so it was buried.
   → Fix: carve the terrain along the river path (`heightAt` lowers ground near `riverX(z)`). Watch the argument order: `THREE.MathUtils.smoothstep(x, min, max)`.

6. **Northern ridge hid the far mountains and the sky looked cut off.**
   → Cause: ridge height grew without limit (`(-60 - z) * 0.35`), so it became a wall taller than the mountains.
   → Fix: cap it: `Math.min(10, (-60 - z) * 0.2)`.

7. **Character cap covered the face's eyes.**
   → Cause: the face texture's eyes sit near the top of the image, and the cap band was placed at the same height.
   → Fix: raise cap/fur band from y=0.13 to y=0.2 on the head group. Always check a close-up screenshot after placing a texture. (Current build uses a procedural flat-color placeholder — no face texture path — so this is historical.)

8. **"Is it rendering?" with no way to see it.** (workflow, not a code bug)
   → Cause: building without ever opening the game hid bugs #4–#7 for several versions.
   → Fix: `npm run build && npm run preview`, then take a headless screenshot (Playwright + Chrome with `--use-gl=swiftshader`) after every visual change.

9. **GLB model renders solid black** (no error).
   → Cause: glTF materials are PBR (`MeshStandardMaterial`) and default to metallic; metal with no environment to reflect looks black.
   → Fix: give the scene an environment map: `scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture`.

10. **Test GLB lay on its side.**
   → Cause: the test tool (trimesh) builds Z-up; glTF and Three.js are Y-up.
   → Fix: rotate -90° on X before export. Tripo exports Y-up, so its models should stand correctly.

11. **`npm install` fails with `ENOSYS: function not implemented, rename .../node_modules/three`.**
   → Cause: some cloud/project store filesystems do not implement atomic rename that npm uses while extracting packages.
   → Fix: copy the project to a normal local disk (e.g. `~/msh-demo` or `/tmp/msh-demo`), run `npm install` there, then `npm run dev` / `build`. The zip handoff excludes `node_modules` for this reason.

12. **Title-card background 404 after Vite build.**
   → Cause: CSS `url("/title-card.jpg")` points at the site root; with `base: './'` or when CSS lives under `src/`, the file in `public/` is not rewritten.
   → Fix: keep `title-card.jpg` next to `src/style.css` and reference `url("./title-card.jpg")` so Vite emits a hashed asset.

13. **Camp looked sparse / “tech demo of boxes” vs Sumiro density.**
   → Cause: too few props, flat terrain, weak golden-hour contrast, only 2 gers.
   → Fix: denser instanced grass, 3 gers + fence + sulde + herd + player horse, Exp2 fog, warm key + cool rim, faceted clouds. Match hero framing to art-ref 18.

14. **River looked muddy orange at sunset and vanished into terrain.**
   → Cause: river tint followed fog too closely; no bank foam; buried by height.
   → Fix: cooler `#7eb8c8` Lambert water + foam strips; carve valley with `smoothstep` in `heightAt`.

15. **Chase cam feels stiff / movement teleports like a sketch, not Sumiro.**
   → Cause: single-frame `lerp` on a fixed offset + constant WASD deltas.
   → Fix: port Sumiro critically-damped spring rig + accel/grip mover (`src/systems/camera-rig.js`, `player-move.js`); collide with capsule r≈0.3. Techniques only — keep Mongolian art. See `docs/sumiro-port-notes.md`.

16. **Black spiky “vertex explosion” near player on camp.**
   → Cause: `InstancedMesh` created with count 2200 but `setMatrixAt` loop allowed `placed < 2800` (buffer overrun).
   → Fix: keep `placed < GRASS_N` equal to constructor capacity. The camp body is `base_basic_shaded.glb`. `temujin.glb` is an untextured Mixamo bind pose; scaling it needs a rebind or the skin explodes.


18. **Laggy Act I (~6 fps on SwiftShader / weak iGPU).**
   → Cause: pixelRatio up to 1.75, PCFSoft shadows 1024, 3200 grass + steppeShade on every Lambert, full mist/motes/birds/dust, RoomEnvironment PMREM, spring cam overwriting unused work, no tiering.
   → Fix: `src/systems/quality.js` tiers Бага/Дунд/Өндөр (Esc menu + auto probe 2s + `createAdaptiveQuality`); low skips FX/shadows/shade; grass InstancedMesh capped; F3 FPS HUD.
   → SwiftShader before/after (Act I camp): gameplay **~6 → ~60 fps** (low); aerial **~6 → ~29–32 fps** (low, F3 proof `25-perf-after.png`). Med stays fill-bound ~20 fps on SwiftShader (real iGPU target 60 at med).
