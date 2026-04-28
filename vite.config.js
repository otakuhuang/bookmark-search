import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    crx({
      manifest,
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    base: './',
    rollupOptions: {
      input: {
        popup: './src/popup/index.html',
        loading: './src/popup/loading.html',
      },
    },
  },
});