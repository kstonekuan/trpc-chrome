import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      exclude: ['test/**', 'examples/**'],
    }),
  ],
  build: {
    lib: {
      entry: {
        adapter: resolve(__dirname, 'src/adapter/index.ts'),
        link: resolve(__dirname, 'src/link/index.ts'),
        types: resolve(__dirname, 'src/types/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        '@trpc/server',
        '@trpc/client',
        '@trpc/server/observable',
        '@trpc/server/unstable-core-do-not-import',
        '@trpc/server/adapters/node-http',
        'chrome',
      ],
      output: {
        exports: 'named',
      },
    },
    sourcemap: true,
    minify: false, // Keep unminified for library
  },
});
