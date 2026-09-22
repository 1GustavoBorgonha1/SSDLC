import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['error', 'log'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // NFR-S11 — o cliente estático não pode usar innerHTML/eval.
    files: ['public/**/*.js'],
    languageOptions: {
      globals: { document: 'readonly', window: 'readonly', fetch: 'readonly', URLSearchParams: 'readonly' },
    },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'document', property: 'write', message: 'NFR-S11: proibido.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'NFR-S11: use textContent/createElement em vez de innerHTML.',
        },
      ],
    },
  },
);
