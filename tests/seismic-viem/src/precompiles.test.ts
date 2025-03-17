import { afterAll, describe, test } from 'bun:test'
import { http } from 'viem'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { testRng } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfHex } from '@sviem-tests/tests/precompiles.ts'
import { testAesGcm } from '@sviem-tests/tests/precompiles.ts'
import { testSecp256k1 } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfString } from '@sviem-tests/tests/precompiles.ts'
import { testEcdh } from '@sviem-tests/tests/precompiles.ts'
import { testRngWithPers } from '@sviem-tests/tests/precompiles.ts'
import { createShieldedPublicClient } from '@sviem/client.ts'

const chain = envChain()

const { url, exitProcess } = await setupNode(chain, {
  // Running on a different port because contract.test.ts uses 8545
  port: 8548,
  silent: true,
})

const publicClient = createShieldedPublicClient({
  chain,
  transport: http(url),
})

describe('Seismic Precompiles', async () => {
  test('RNG(1)', () => testRng(publicClient, 1), { timeout: 20_000 })
  test('RNG(8)', () => testRng(publicClient, 8), { timeout: 20_000 })
  test('RNG(16)', () => testRng(publicClient, 16), { timeout: 20_000 })
  test('RNG(32)', () => testRng(publicClient, 32), { timeout: 20_000 })
  test('RNG(32, pers)', () => testRngWithPers(publicClient, 32), {
    timeout: 20_000,
  })
  test('ECDH', () => testEcdh(publicClient), { timeout: 20_000 })
  test('HKDF(string)', () => testHkdfString(publicClient), {
    timeout: 20_000,
  })
  test('HKDF(hex)', () => testHkdfHex(publicClient), { timeout: 20_000 })
  test('AES-GCM', () => testAesGcm(publicClient), { timeout: 20_000 })
  test('secp256k1', () => testSecp256k1(publicClient), { timeout: 20_000 })
})

afterAll(async () => {
  await exitProcess()
})
