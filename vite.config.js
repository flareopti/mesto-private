import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { open: true, host: '127.0.0.1' },
  build: { sourcemap: false },
});
