import { Hex } from 'viem'

export type EncryptionActions = {
  getEncryption: () => Hex
  getEncryptionPublicKey: () => Hex
}

export const encryptionActions = (
  encryption: Hex,
  encryptionPublicKey: Hex
): EncryptionActions => {
  return {
    getEncryption: () => encryption,
    getEncryptionPublicKey: () => encryptionPublicKey,
  }
}
