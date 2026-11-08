import { defineConfig } from 'vite';

// base './' so the build works on GitHub Pages / Netlify subpaths
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: { target: 'es2022', chunkSizeWarningLimit: 20000 },
});
