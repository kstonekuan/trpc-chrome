import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/__setup.ts'],
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'examples'],
  },
});
