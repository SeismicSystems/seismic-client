import { Hex } from 'viem'

import { AesGcmCrypto } from '@sviem/crypto/aes.ts'
import { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
import type { EncryptionNonce } from '@sviem/crypto/nonce.ts'

export type EncryptionActions = {
  getEncryption: () => Hex
  getEncryptionPublicKey: () => Hex
  encrypt: (
    plaintext: Hex
  ) => Promise<{ ciphertext: Hex; encryptionNonce: Hex }>
  decrypt: (ciphertext: Hex, encryptionNonce: EncryptionNonce) => Promise<Hex>
}

export const encryptionActions = (
  encryption: Hex,
  encryptionPublicKey: Hex
): EncryptionActions => {
  return {
    getEncryption: () => encryption,
    getEncryptionPublicKey: () => encryptionPublicKey,
    encrypt: async (plaintext: Hex) => {
      const aesCipher = new AesGcmCrypto(encryption)
      const encryptionNonce = randomEncryptionNonce()
      const ciphertext = await aesCipher.encrypt(plaintext, encryptionNonce)
      return { ciphertext, encryptionNonce }
    },
    decrypt: async (ciphertext: Hex, encryptionNonce: EncryptionNonce) => {
      const aesCipher = new AesGcmCrypto(encryption)
      return await aesCipher.decrypt(ciphertext, encryptionNonce)
    },
  }
}
