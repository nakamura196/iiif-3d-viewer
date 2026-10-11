import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// `next lint` was removed in Next.js 16; ESLint runs directly with the flat config.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler rules (eslint-plugin-react-hooks 7). three.js code moves the
    // camera and controls in place and syncs state from the URL / localStorage in
    // effects, which these rules report. Kept visible as warnings, not errors.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'vercel-static/**', 'next-env.d.ts']),
]);
