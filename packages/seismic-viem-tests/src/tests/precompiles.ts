import { expect } from 'bun:test'
import { createShieldedPublicClient } from 'seismic-viem'
import { generateAesKey } from 'seismic-viem'
import { compressPublicKey } from 'seismic-viem'
import { Chain, hexToBytes, http, recoverMessageAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export type PublicClientConfig = {
  chain: Chain
  url: string
}

export const testRng = async (
  { chain, url }: PublicClientConfig,
  size: number
) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const randomU8 = await publicClient.rng({ numBytes: size })
  expect(randomU8).toBeGreaterThan(0n)
  expect(randomU8).toBeLessThan(2n ** BigInt(8 * size))
}

export const testRngWithPers = async (
  { chain, url }: PublicClientConfig,
  size: number
) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const pers = new Uint8Array([1, 2, 3, 4])
  const randomU8 = await publicClient.rng({ numBytes: size, pers })
  expect(randomU8).toBeGreaterThan(0n)
  expect(randomU8).toBeLessThan(2n ** BigInt(8 * size))
}

export const testEcdh = async ({ chain, url }: PublicClientConfig) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
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

export const testHkdfString = async ({ chain, url }: PublicClientConfig) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const inputString = 'HelloHKDF'
  const key = await publicClient.hdfk(inputString)
  // from revm test
  expect(key).toBe(
    '0x7f527a655fecfa58cd49e00b13684f2df335a3e1a3b9bee749f4d494087038f2'
  )
}

export const testHkdfHex = async ({ chain, url }: PublicClientConfig) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const inputHex = '0x1234abcd'
  const key = await publicClient.hdfk(inputHex)
  // from revm test
  expect(key).toBe(
    '0x67b4c8f882a3a82e4eb12b97aa70652afd62167d0ffd28f81b22e1684c1e8fb2'
  )
}

export const testAesGcm = async ({ chain, url }: PublicClientConfig) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
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

export const testSecp256k1 = async ({ chain, url }: PublicClientConfig) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
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
