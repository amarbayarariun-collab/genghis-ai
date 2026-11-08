import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Zero-setup file:// build: one HTML with inlined JS/CSS/images.
// GLB stays off (USE_TEMUJIN_GLB=false) — not required to play.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  // Don't copy multi-MB public/models into standalone dist
  publicDir: false,
});
