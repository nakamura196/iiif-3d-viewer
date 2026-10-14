import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { generateRegistries } from './scripts/gen-registries.mjs';

generateRegistries();

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'packages/*/src/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
