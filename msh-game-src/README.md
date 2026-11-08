# МСХ · Тэмүжин (Playable Legacy) v2

Бүтэн Act 0–III + Тайчууд олзлолт (олон бүлэгт түүх) дээр Claude-ийн хийсэн график/дүрийг нэгтгэсэн хувилбар:
Mixamo биетэй Тэмүжин (кодоор хувцасласан), үетэй Өэлүн болон бусад дүрүүд, амьд хөдөлгөөнтэй морьд ба давхидаг сүрэг,
Blender-ийн 12 объект (`src/assets/models/`: гэр, хашаа, туг, тэрэг, түлээ, чулуу ×3, нарс, мойл, өвс, эмээл),
морь унах (F / Shift), үсрэх (Space), салхинд найгах өвс, bloom + warm grade post-processing (дунд/өндөр чанарт),
морин хуур шиг аялгуу + салхи/гол/гал/хөл/туурай чимээ (M — дуу хаах).

```bash
npm install && npm run dev            # хөгжүүлэлт
npm run build:standalone              # dist-standalone/index.html — нэг файл, file:// дээр ажиллана
```

Бүтэц: `src/main.js` (цикл, камер, морь, үсрэлт, бүлэг солих) · `src/world.js` (Онон хуаран) · `src/scenes/` (бусад бүлгүүд) ·
`src/world-kit.js` (нийтлэг объект, GLB prop + fallback) · `src/characters/` (Тэмүжин, Өэлүн, морь, Mixamo бие, хувцас) ·
`src/systems/game-audio.js` (дуу) · `src/fx/` (Claude-ийн камер/агаар мандал/painterly, сонголтоор) · `src/story.js` (бүх монгол текст) ·
`tools/blender/build_assets.py` (объектуудыг дахин бүтээх).

See `HOW-TO-PLAY.md`, `MISTAKES.md`.
