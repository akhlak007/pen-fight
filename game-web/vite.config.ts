import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || './',
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
