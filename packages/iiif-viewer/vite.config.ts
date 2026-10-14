import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import { generateRegistries } from '../../scripts/gen-registries.mjs';

generateRegistries();

// Build of the <iiif-viewer> tag: one ES module (iiif-viewer.js) with React and the
// viewer inside, plus style.css. The 3D part (three.js, react-three-fiber) is a lazy
// import in Viewer.tsx, so it ends up in separate chunks next to iiif-viewer.js and is
// only fetched when a Scene is shown.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: {
    // Library mode does not replace this; React reads it.
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  css: {
    postcss: { plugins: [tailwindcss()] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/element/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'iiif-viewer.js',
      cssFileName: 'style',
    },
    rollupOptions: {
      // 'use client' in the React sources means nothing in a plain browser bundle.
      onwarn(warning, defaultHandler) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        defaultHandler(warning);
      },
      output: {
        chunkFileNames: 'iiif-viewer-[name]-[hash].js',
      },
    },
  },
});
