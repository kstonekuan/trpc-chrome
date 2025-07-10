import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
      exclude: ['test/**/*', 'examples/**/*', 'vitest.config.ts'],
      copyDtsFiles: true,
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: {
        adapter: resolve(__dirname, 'src/adapter/index.ts'),
        link: resolve(__dirname, 'src/link/index.ts'),
        types: resolve(__dirname, 'src/types/index.ts'),
        utils: resolve(__dirname, 'src/utils/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const extension = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${extension}`;
      },
    },
    rollupOptions: {
      external: [
        '@trpc/server',
        '@trpc/client',
        '@trpc/server/observable',
        '@trpc/server/rpc',
        'superjson',
        // Mark chrome as external for browser environments
        /^chrome$/,
      ],
      output: {
        preserveModules: false,
        exports: 'named',
        chunkFileNames: (chunkInfo) => {
          const names = chunkInfo.name.split('-');
          return `chunks/${names[names.length - 1]}.js`;
        },
        banner: '/* @kstonekuan/trpc-chrome - MIT License */',
      },
    },
    sourcemap: true,
    minify: true,
    target: 'esnext',
    reportCompressedSize: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
