import { Hex, hexToBytes } from 'viem'

import { Precompile, calcLinearGasCostU32 } from '@sviem/precompiles/precompile'

export const AES_GCM_ENCRYPTION_ADDRESS = '0x66'
export const AES_GCM_DECRYPTION_ADDRESS = '0x67'

export const AES_GCM_BASE_GAS = 1000n
export const AES_GCM_PER_BLOCK = 30n

export const MIN_AES_DECRYPTION_LENGTH = 60
export const MIN_AES_ENCRYPTION_LENGTH = 44

const aesGcmGasCost = ([_aesKey, _nonce, ciphertext]: readonly unknown[]) => {
  const ciphertextLength = hexToBytes(ciphertext as Hex).length
  return calcLinearGasCostU32({
    bus: 16,
    len: ciphertextLength,
    base: AES_GCM_BASE_GAS,
    word: AES_GCM_PER_BLOCK,
  })
}

export const aesGcmEncryption: Precompile<[Hex, number, string]> = {
  address: AES_GCM_ENCRYPTION_ADDRESS,
  abi: [
    {
      name: 'aesGcmEncrypt',
      inputs: [
        { name: 'aesKey', type: 'bytes32' },
        { name: 'nonce', type: 'bytes12' },
        { name: 'plaintext', type: 'bytes' },
      ],
      outputs: [{ type: 'bytes' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: aesGcmGasCost,
  transformParams: (args) => args,
}

export const aesGcmDecryption: Precompile<[Hex, number, Hex]> = {
  address: AES_GCM_DECRYPTION_ADDRESS,
  abi: [
    {
      name: 'aesGcmDecrypt',
      inputs: [
        { name: 'aesKey', type: 'bytes32' },
        { name: 'nonce', type: 'bytes12' },
        { name: 'ciphertext', type: 'bytes' },
      ],
      outputs: [{ type: 'bytes' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: aesGcmGasCost,
  transformParams: (args) => args,
}
