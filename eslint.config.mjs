// Root ESLint flat config.
// Workspace apps (apps/web) provide their own framework-aware configs; this
// config lints everything else and delegates to framework configs where present.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/*.config.{js,mjs,cjs,ts}',
      'apps/web/**', // linted by `npm run lint -w @weld/web` (next lint config)
      'apps/api/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
