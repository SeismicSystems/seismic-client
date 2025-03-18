import { afterAll, beforeAll, describe, test } from 'bun:test'
import type { Chain } from 'viem'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { testRng } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfHex } from '@sviem-tests/tests/precompiles.ts'
import { testAesGcm } from '@sviem-tests/tests/precompiles.ts'
import { testSecp256k1 } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfString } from '@sviem-tests/tests/precompiles.ts'
import { testEcdh } from '@sviem-tests/tests/precompiles.ts'
import { testRngWithPers } from '@sviem-tests/tests/precompiles.ts'
import { loadDotenv } from '@test/env.ts'

let chain: Chain
let url: string
let exitProcess: () => Promise<void>

beforeAll(async () => {
  loadDotenv()
  chain = envChain()
  const node = await setupNode(chain, {
    port: 8548, // contract.test.ts uses 8545
    silent: true,
  })
  url = node.url
  exitProcess = node.exitProcess
})

describe('Seismic Precompiles', async () => {
  test('RNG(1)', () => testRng({ chain, url }, 1), { timeout: 20_000 })
  test('RNG(8)', () => testRng({ chain, url }, 8), { timeout: 20_000 })
  test('RNG(16)', () => testRng({ chain, url }, 16), { timeout: 20_000 })
  test('RNG(32)', () => testRng({ chain, url }, 32), { timeout: 20_000 })
  test('RNG(32, pers)', () => testRngWithPers({ chain, url }, 32), {
    timeout: 20_000,
  })
  test('ECDH', () => testEcdh({ chain, url }), { timeout: 20_000 })
  test('HKDF(string)', () => testHkdfString({ chain, url }), {
    timeout: 20_000,
  })
  test('HKDF(hex)', () => testHkdfHex({ chain, url }), { timeout: 20_000 })
  test('AES-GCM', () => testAesGcm({ chain, url }), { timeout: 20_000 })
  test('secp256k1', () => testSecp256k1({ chain, url }), { timeout: 20_000 })
})

afterAll(async () => {
  await exitProcess()
})
