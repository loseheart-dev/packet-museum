import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/packet-museum/',
  build: { outDir: '../dist', emptyOutDir: true },
});
