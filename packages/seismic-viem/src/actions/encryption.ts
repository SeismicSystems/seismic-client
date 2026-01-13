import { Hex } from 'viem'

import { encodeSeismicMetadataAsAAD } from '@sviem/crypto/aead.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'
import type { TxSeismicMetadata } from '@sviem/metadata.ts'

export type EncryptionActions = {
  getEncryption: () => Hex
  getEncryptionPublicKey: () => Hex
  encrypt: (
    plaintext: Hex | undefined,
    metadata: TxSeismicMetadata
  ) => Promise<Hex>
  decrypt: (
    ciphertext: Hex | undefined,
    metadata: TxSeismicMetadata
  ) => Promise<Hex>
}

export const encryptionActions = (
  encryption: Hex,
  encryptionPublicKey: Hex
): EncryptionActions => {
  return {
    getEncryption: () => encryption,
    getEncryptionPublicKey: () => encryptionPublicKey,
    encrypt: async (
      plaintext: Hex | undefined,
      metadata: TxSeismicMetadata
    ) => {
      const aesCipher = new AesGcmCrypto(encryption)
      const aad = encodeSeismicMetadataAsAAD(metadata)
      const ciphertext = await aesCipher.encrypt(
        plaintext,
        metadata.seismicElements.encryptionNonce,
        aad
      )
      return ciphertext
    },
    decrypt: async (
      ciphertext: Hex | undefined,
      metadata: TxSeismicMetadata
    ) => {
      const aesCipher = new AesGcmCrypto(encryption)
      const aad = encodeSeismicMetadataAsAAD(metadata)
      return await aesCipher.decrypt(
        ciphertext,
        metadata.seismicElements.encryptionNonce,
        aad
      )
    },
  }
}
