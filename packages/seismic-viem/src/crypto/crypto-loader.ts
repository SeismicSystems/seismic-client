// const getCrypto = () => {
//   if (typeof Bun !== 'undefined') {
//     // Bun environment
//     return require('node:crypto')
//   }
//   try {
//     // Node.js environment
//     return require('crypto')
//   } catch (err) {
//     throw new Error('crypto module is not available in this environment')
//   }
// }

// module.exports = getCrypto
