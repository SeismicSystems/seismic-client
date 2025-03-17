import { afterAll, describe, expect, test } from 'bun:test'
import { hexToBytes, http, recoverMessageAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { createShieldedPublicClient } from '@sviem/client.ts'
import { generateAesKey } from '@sviem/crypto/aes.ts'
import { compressPublicKey } from '@sviem/crypto/secp.ts'

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

const testRng = async (size: number) => {
  const randomU8 = await publicClient.rng({ numBytes: size })
  expect(randomU8).toBeGreaterThan(0n)
  expect(randomU8).toBeLessThan(2n ** BigInt(8 * size))
}

const testRngWithPers = async (size: number) => {
  const pers = new Uint8Array([1, 2, 3, 4])
  const randomU8 = await publicClient.rng({ numBytes: size, pers })
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

const testHkdfString = async () => {
  const inputString = 'HelloHKDF'
  const key = await publicClient.hdfk(inputString)
  // from revm test
  expect(key).toBe(
    '0x7f527a655fecfa58cd49e00b13684f2df335a3e1a3b9bee749f4d494087038f2'
  )
}

const testHkdfHex = async () => {
  const inputHex = '0x1234abcd'
  const key = await publicClient.hdfk(inputHex)
  // from revm test
  expect(key).toBe(
    '0x67b4c8f882a3a82e4eb12b97aa70652afd62167d0ffd28f81b22e1684c1e8fb2'
  )
}

const testAesGcm = async () => {
  const aesKey =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  const nonce = 0
  const plaintext = 'HelloAESGCM'
  const ciphertext = await publicClient.aesGcmEncryption({
    aesKey,
    nonce,
    plaintext,
  })
  expect(ciphertext).toBe(
    '0x86c22c5122212e3d400d886f80dfcfcbacb96cbc815db886e1a6cd'
  )
  const decrypted = await publicClient.aesGcmDecryption({
    aesKey,
    nonce,
    ciphertext,
  })
  expect(decrypted).toBe(plaintext)
}

const testSecp256k1 = async () => {
  const sk =
    '0xaac6ccf1fdec03b4838a3c97628f381b34a949967f46d3f8a9a9c741ce982a87'
  const address = privateKeyToAccount(sk).address
  const signature = await publicClient.secp256k1Signature({
    sk,
    message: 'i signed this',
  })
  const recoveredAddress = await recoverMessageAddress({
    message: 'i signed this',
    signature: signature,
  })
  expect(recoveredAddress).toBe(address)
}

describe('Seismic Precompiles', async () => {
  test('RNG(1)', () => testRng(1), { timeout: 20_000 })
  test('RNG(8)', () => testRng(8), { timeout: 20_000 })
  test('RNG(16)', () => testRng(16), { timeout: 20_000 })
  test('RNG(32)', () => testRng(32), { timeout: 20_000 })
  test('RNG(32, pers)', () => testRngWithPers(32), { timeout: 20_000 })
  test('ECDH', testEcdh, { timeout: 20_000 })
  test('HKDF(string)', testHkdfString, { timeout: 20_000 })
  test('HKDF(hex)', testHkdfHex, { timeout: 20_000 })
  test('AES-GCM', testAesGcm, { timeout: 20_000 })
  test('secp256k1', testSecp256k1, { timeout: 20_000 })
})

afterAll(async () => {
  await exitProcess()
})
