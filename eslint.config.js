module.exports = [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      import: require('eslint-plugin-import'),
      'no-relative-import-paths': require('eslint-plugin-no-relative-import-paths'),
    },
    languageOptions: {
      // Added languageOptions block
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: [
          'tsconfig.json',
          'packages/*/tsconfig.json',
          'tests/*/tsconfig.json',
        ],
      },
    },
    rules: {
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: false },
      ],
    },
  },
  {
    files: ['**/*.md', '**/*.mdx'],
    plugins: {
      'eslint-plugin-mdx': require('eslint-plugin-mdx'),
    },
    languageOptions: {
      parser: require('eslint-mdx'),
    },
  },
]
