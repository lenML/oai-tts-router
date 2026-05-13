// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base recommended rules (no project service needed)
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Type-aware rules for source code only
  ...tseslint.configs.recommendedTypeChecked.map(conf => ({
    ...conf,
    files: ['src/**/*.ts'],
  })),
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['snake_case'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'snake_case'] },
        { selector: 'import', format: ['PascalCase', 'snake_case'] },
        { selector: 'variable', modifiers: ['const'], format: ['UPPER_CASE', 'snake_case'] },
        { selector: 'objectLiteralProperty', format: ['UPPER_CASE', 'snake_case'] },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'error',
      // Express req.body is typed as `any`; we validate with zod anyway
      '@typescript-eslint/no-unsafe-assignment': 'off',
      quotes: ['error', 'single', { avoidEscape: true }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Test and config files: basic rules only (no project service)
  {
    files: ['tests/**/*.ts', 'vitest.config.ts'],
    rules: {
      'quotes': ['error', 'single', { avoidEscape: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'docs/', 'eslint.config.js'],
  },
);
