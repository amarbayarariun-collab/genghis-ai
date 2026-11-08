import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Zero-setup file:// build: one HTML with inlined JS/CSS/images.
// publicDir is off, so GLB requests miss and the camp placeholders stay.
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
