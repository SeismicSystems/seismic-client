import { afterAll, describe, test } from 'bun:test'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { testRng } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfHex } from '@sviem-tests/tests/precompiles.ts'
import { testAesGcm } from '@sviem-tests/tests/precompiles.ts'
import { testSecp256k1 } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfString } from '@sviem-tests/tests/precompiles.ts'
import { testEcdh } from '@sviem-tests/tests/precompiles.ts'
import { testRngWithPers } from '@sviem-tests/tests/precompiles.ts'

const chain = envChain()

const { exitProcess } = await setupNode(chain, {
  // Running on a different port because contract.test.ts uses 8545
  port: 8548,
  silent: true,
})

describe('Seismic Precompiles', async () => {
  test('RNG(1)', () => testRng(chain, 1), { timeout: 20_000 })
  test('RNG(8)', () => testRng(chain, 8), { timeout: 20_000 })
  test('RNG(16)', () => testRng(chain, 16), { timeout: 20_000 })
  test('RNG(32)', () => testRng(chain, 32), { timeout: 20_000 })
  test('RNG(32, pers)', () => testRngWithPers(chain, 32), {
    timeout: 20_000,
  })
  test('ECDH', () => testEcdh(chain), { timeout: 20_000 })
  test('HKDF(string)', () => testHkdfString(chain), {
    timeout: 20_000,
  })
  test('HKDF(hex)', () => testHkdfHex(chain), { timeout: 20_000 })
  test('AES-GCM', () => testAesGcm(chain), { timeout: 20_000 })
  test('secp256k1', () => testSecp256k1(chain), { timeout: 20_000 })
})

afterAll(async () => {
  await exitProcess()
})
