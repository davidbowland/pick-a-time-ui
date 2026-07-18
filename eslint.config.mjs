// Fleet ESLint flat config — UI (React / CRA / Next-style TypeScript) flavor.
// ESLint 9 + typescript-eslint 8 + eslint-plugin-react. Translated from the
// fleet's .eslintrc.json (food-ui / pick-a-time-ui) preserving original intent.
//
// PER-REPO ADAPTATION:
//   1. `ignores`: mirror the repo's old .eslintignore. UI repos vary a lot here
//      (out/, .cache/, public/, static/, next-env.d.ts, next.config.*,
//      next-sitemap.config.js, export-images.config.js, scripts/). Add whatever
//      the repo had. Defaults below cover the common set.
//   2. React version is auto-detected (`settings.react.version = 'detect'`); no
//      edit needed as long as react is a dependency.
//   3. This flavor intentionally does NOT include eslint-plugin-functional:
//      React error boundaries (e.g. src/components/error-boundary) MUST be class
//      components, and the fleet's UI eslintrc never enforced functional rules.
//      Keep the functional mandate for UI in CLAUDE.md prose, not lint.
//
// Requires devDeps: eslint, @eslint/js, typescript-eslint, eslint-plugin-react,
//   eslint-plugin-jest, eslint-config-prettier, globals.
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jest from 'eslint-plugin-jest'
import react from 'eslint-plugin-react'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 1) ADAPT PER REPO.
  //    CRITICAL: ESLint 9 flat config does NOT implicitly skip dot-directories the
  //    way eslint 8's enumerator did. Every Next.js repo has a `.next/` (and often
  //    `.swc/`) build cache on disk after a local build/dev run; if it isn't listed
  //    here `eslint .` lints the minified webpack runtime + generated route .d.ts
  //    and emits thousands of errors. `.next/` and `.swc/` MUST stay in this list.
  //    Add any other output dir the repo gitignores that isn't already here.
  {
    ignores: [
      '**/__mocks__/',
      '**/__snapshots__/',
      '.cache/',
      '.next/',
      '.swc/',
      'build/',
      'coverage/',
      'deploy/',
      'dist/',
      'node_modules/',
      'out/',
      'public/',
      'static/',
      'next-env.d.ts',
      '**/*.min.*',
      'jest.*.*',
    ],
  },

  // 2) Base recommended sets.
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,

  // 3) Language options + fleet rule intent (from food-ui / pick-a-time-ui).
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        exports: 'writable',
        module: 'readonly',
        require: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // ignoreRestSiblings keeps the fleet's `{ field: _, ...rest }` drop-a-field
      // idiom clean; varsIgnorePattern alone does NOT cover destructured args.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '_', ignoreRestSiblings: true, varsIgnorePattern: '_' },
      ],
      'no-negated-condition': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-curly-brace-presence': ['error', { children: 'never', propElementValues: 'always', props: 'never' }],
      'react/jsx-sort-props': 'error',
      'sort-vars': 'error',
    },
  },

  // 4) Node scripts / config files may use CommonJS require() and Node globals
  //    (process, __dirname, etc). This repo's Next config is next.config.mjs
  //    (ESM), not next.config.js -- listed explicitly alongside the kit default.
  {
    files: ['scripts/**/*.js', '*.config.js', 'next.config.js', 'next.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // 5) Jest rules scoped to test / mock / test-support files only.
  //    `*TestUtils.*` are test helpers (jest.isolateModules + require() patterns),
  //    so require-style imports are allowed there just like in *.test.* files.
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*TestUtils.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx}',
    ],
    ...jest.configs['flat/recommended'],
    settings: { jest: { version: 29 } },
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/no-mocks-import': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // 6) Prettier LAST — disables all formatting rules that would fight prettier.
  prettier,
)
