/// <reference types="node" />

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },

  {
    files: ['**/*.js'],

    extends: [js.configs.recommended],
  },

  {
    files: ['src/**/*.ts', 'tests/**/*.ts'], // 測試也是正式程式碼的一部分

    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-console': 'off',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
    },
  },

  eslintConfigPrettier,
);
