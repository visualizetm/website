// ESLint (CRM revamp, step 6): a missing import fails the audit before it
// reaches a phone. no-undef and no-unused-vars are errors; the hooks rules
// come from eslint-plugin-react-hooks; eslint-plugin-react only marks a
// component used in JSX as used. `npm run lint` runs it over src, api and
// scripts; scripts/regression.mjs runs it as its first step.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const shared = {
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: {
    ...js.configs.recommended.rules,
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-cond-assign': 'off',
    'no-control-regex': 'off',
    'no-prototype-builtins': 'off',
    'no-useless-escape': 'off',
    'no-fallthrough': 'off',
    'no-constant-condition': 'off',
    'no-async-promise-executor': 'off',
  },
};
export default [
  { ignores: ['dist/**', 'node_modules/**', '.tmp-verify/**', 'public/**', 'scripts/_*.tmp.mjs'] },
  {
    ...shared,
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { ...shared.languageOptions, globals: { ...globals.browser, ...globals.es2021 } },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: { ...shared.rules, 'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'off', 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
  {
    ...shared,
    files: ['api/**/*.js', 'scripts/**/*.{js,mjs}', 'vite.config.js', 'eslint.config.js'],
    // The audits pass functions into page.evaluate, so the browser globals apply there too.
    languageOptions: { ...shared.languageOptions, globals: { ...globals.node, ...globals.browser, ...globals.es2021 } },
  },
  {
    files: ['public/**/*.js', 'src/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },
];
