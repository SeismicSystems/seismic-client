module.exports = [
  {
    ignores: ['node_modules/**', '**/dist/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      import: require('eslint-plugin-import'),
      'no-relative-import-paths': require('eslint-plugin-no-relative-import-paths'),
      'unused-imports': require('eslint-plugin-unused-imports'),
    },
    languageOptions: {
      // Added languageOptions block
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: false },
      ],
      'unused-imports/no-unused-imports': 'error',
    },
  },
  {
    files: ['docs/pages/**/*.md', 'docs/pages/**/*.mdx'],
    plugins: {
      'eslint-plugin-mdx': require('eslint-plugin-mdx'),
    },
    languageOptions: {
      parser: require('eslint-mdx'),
    },
  },
]
