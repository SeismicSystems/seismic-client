import { afterAll, describe, expect, test } from 'bun:test'
import { hexToBytes, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { createShieldedPublicClient } from '@sviem/client'
import { generateAesKey } from '@sviem/crypto/aes'
import { compressPublicKey } from '@sviem/crypto/secp'
import { envChain } from '@test/process/node'

// Running on a different port because contract.test.ts uses 8545
const chain = envChain()
// const { url, exitProcess } = await setupNode(chain, 8547)
const url = 'http://localhost:8545'

const publicClient = createShieldedPublicClient({
  chain,
  transport: http(url),
})

const testRng = async (size: number) => {
  const randomU8 = await publicClient.rng(size)
  expect(randomU8).toBeGreaterThan(0n)
  expect(randomU8).toBeLessThan(2n ** BigInt(8 * size))
}

const testEcdh = async () => {
  const sk1 = generatePrivateKey()
  const sk2 = generatePrivateKey()
  const pk2 = compressPublicKey(privateKeyToAccount(sk2).publicKey)
  const sharedSecret = await publicClient.ecdh({ sk: sk1, pk: pk2 })
  const ssBytes = hexToBytes(sharedSecret)
  const expected = generateAesKey({
    privateKey: sk1,
    networkPublicKey: pk2.slice(2),
  })
  expect(ssBytes.length).toBe(32)
  expect(sharedSecret).toBe(expected)
}

const testHkdf = async () => {
  const inputString = 'HelloHKDF'
  const key = await publicClient.hdfk(inputString)
  // from revm test
  expect(key).toBe(
    '0x7f527a655fecfa58cd49e00b13684f2df335a3e1a3b9bee749f4d494087038f2'
  )
}

const testAesGcm = async () => {
  const aesKey =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  const nonce = 0
  const plaintext = 'HelloAESGCM'
  console.log('calling encrypt')
  const ciphertext = await publicClient.aesGcmEncryption({
    aesKey,
    nonce,
    plaintext,
  })
  expect(ciphertext).toBe(
    '0xcea7403d4d606b6e074ec5d3baf39d18726003ca37a62a74d1a2f58e7506358edd4ab1284d4ae17b41e85924470c36f74741cb8181bb7f30617c1de3ab0c3a1fd0c48f7321a82d376095ace0419167a0bcaf49bb88abca4189fd5935131d50adabfa77cd6e85da245fb0bdc5e52cfc29ba0ae1abb15c680f740428faef70746d1fec8857'
  )
  console.log('calling decrypt')
  const decrypted = await publicClient.aesGcmDecryption({
    aesKey,
    nonce,
    ciphertext,
  })
  expect(decrypted).toBe(plaintext)
}

describe('Seismic Precompiles', async () => {
  // test('RNG(1)', () => testRng(1), { timeout: 20_000 })
  // test('RNG(8)', () => testRng(8), { timeout: 20_000 })
  // test('RNG(16)', () => testRng(16), { timeout: 20_000 })
  // test('RNG(32)', () => testRng(32), { timeout: 20_000 })
  // test('ECDH', testEcdh, { timeout: 20_000 })
  // test('HKDF', testHkdf, { timeout: 20_000 })
  test('AES-GCM', testAesGcm, { timeout: 20_000 })
})

afterAll(async () => {
  process.exit(0)
})
