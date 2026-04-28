import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    crx({
      manifest,
    }),
  ],
  define: {
    // 替换 import.meta.url 为 assets 目录的相对路径
    // sandbox 中会通过 parent 传递 modelsDir，所以这里只需要一个占位符
    'import.meta.url': JSON.stringify('./assets/worker.js'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    base: './',
    rollupOptions: {
      input: {
        popup: './src/popup/index.html',
        loading: './src/popup/loading.html',
        settings: './src/popup/settings.html',
        worker: './src/worker/embedding.worker.js',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});