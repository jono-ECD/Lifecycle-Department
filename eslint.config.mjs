import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/**', '.next/**', '.next-e2e/**', 'storage-e2e/**', '.npm-cache/**', 'storage/**', 'test-results/**', 'playwright-report/**', 'reference/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Plain <img> is intended: designs are served from our own storage at their real size.
      '@next/next/no-img-element': 'off',
      // The font link lives in the App Router root layout, which covers every page.
      '@next/next/no-page-custom-font': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];

export default eslintConfig;
