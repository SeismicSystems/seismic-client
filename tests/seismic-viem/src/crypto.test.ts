import { describe, test } from 'bun:test'

import { testAesKeygen } from '@sviem-tests/tests/aesKeygen.ts'

describe('AES', async () => {
  test('generates AES key correctly', testAesKeygen)
})
