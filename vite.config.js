import { defineConfig } from 'vite';

// `base: './'` makes the built bundle path-relative so the same `dist/`
// works on GitHub Pages sub-paths, Netlify, Vercel or a local file server.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
