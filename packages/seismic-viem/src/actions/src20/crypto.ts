import type { Hex } from 'viem'

export const NONCE_LENGTH = 24 // 12 bytes in hex string

export function parseEncryptedData(encryptedData: Hex): {
  ciphertext: Hex
  nonce: Hex
} {
  // Handle empty/zero encrypted data
  if (!encryptedData || encryptedData === '0x' || encryptedData.length <= 2) {
    throw new Error('Empty encrypted data - recipient has no key')
  }

  const nonce = `0x${encryptedData.slice(-NONCE_LENGTH)}` as Hex
  const ciphertext = encryptedData.slice(0, -NONCE_LENGTH) as Hex

  return { ciphertext, nonce }
}
