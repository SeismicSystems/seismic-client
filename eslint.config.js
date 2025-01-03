const { ESLint } = require('eslint')
const {
  createTypeScriptImportResolver,
} = require('eslint-import-resolver-typescript')

module.exports = [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      import: require('eslint-plugin-import-x'), // Changed from eslint-plugin-import-x
      'no-relative-import-paths': require('eslint-plugin-no-relative-import-paths'),
    },
    languageOptions: {
      // Added languageOptions block
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: 'packages/*/tsconfig.json',
      },
    },
    rules: {
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: false },
      ],
    },
    settings: {
      'import/resolver': {
        // Fixed settings structure
        typescript: {
          alwaysTryTypes: true,
          project: 'packages/*/tsconfig.json',
        },
      },
    },
  },
]
