// const { ESLint } = require('eslint')
// const {
//   createTypeScriptImportResolver,
// } = require('eslint-import-resolver-typescript')
// module.exports = [
//   {
//     ignores: ['node_modules/**'],
//   },
//   {
//     files: ['**/*.ts', '**/*.tsx'],
//     plugins: {
//       '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
//       import: require('eslint-plugin-import-x'),
//       'no-relative-import-paths': require('eslint-plugin-no-relative-import-paths'),
//     },
//     rules: {
//       'no-relative-import-paths/no-relative-import-paths': [
//         'error',
//         { allowSameFolder: false },
//       ],
//     },
//     settings: {
//       'import/resolver-next': [
//         createTypeScriptImportResolver({
//           // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
//           alwaysTryTypes: true,
//           project: 'packages/*/tsconfig.json',
//           // // use an array of glob patterns
//           // project: [
//           //   "packages/*/tsconfig.json",
//           //   "other-packages/*/tsconfig.json"
//           // ]
//         }),
//       ],
//     },
//   },
// ]
