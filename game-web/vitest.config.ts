import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
