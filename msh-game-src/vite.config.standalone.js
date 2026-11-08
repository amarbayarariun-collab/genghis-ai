import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Zero-setup file:// build: one HTML with inlined JS/CSS/images/GLB props.
// The Mixamo body is already base64 in temujinBaseData.js; Blender props are
// inlined through loadModels.js (?inline), so publicDir is not needed.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  assetsInclude: ['**/*.glb'],
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 20000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  publicDir: false,
});
