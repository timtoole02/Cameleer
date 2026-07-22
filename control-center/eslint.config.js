// ESLint 9 flat config for the Cameleer frontend (HARDPAN G2).
// Replaces the old fake `lint` (which was just `tsc --noEmit`). `typecheck`
// stays separate. Scope is the TS/React source under src/ only.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      'scripts/**',
      'coverage/**',
      'eslint.config.js',
      'vite.config.ts',
      'vitest.config.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Unused vars are errors, but an underscore prefix marks intentional ones.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Tauri command payloads are dynamically typed; `any` is pragmatic here.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Test files may use a few extra globals.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Keep ESLint out of Prettier's lane (formatting is Prettier's job).
  prettier,
);
