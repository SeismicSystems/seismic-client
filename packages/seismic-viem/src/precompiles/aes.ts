import {
  Hex,
  hexToBytes,
  hexToString,
  numberToBytes,
  numberToHex,
  stringToBytes,
  stringToHex,
  trim,
} from 'viem'

import { Precompile, calcLinearGasCostU32 } from '@sviem/precompiles/precompile'

export const AES_GCM_ENCRYPTION_ADDRESS =
  '0x0000000000000000000000000000000000000066'
export const AES_GCM_DECRYPTION_ADDRESS =
  '0x0000000000000000000000000000000000000067'

const AES_GCM_BASE_GAS = 1000n
const AES_GCM_PER_BLOCK = 30n

const MIN_AES_PLAINTEXT_LENGTH = 0
const MIN_AES_CIPHERTEXT_LENGTH = 16

const aesGcmGasCost = ([_aesKey, _nonce, ciphertext]: readonly unknown[]) => {
  const ciphertextLength = hexToBytes(ciphertext as Hex).length
  return calcLinearGasCostU32({
    bus: 16,
    len: ciphertextLength,
    base: AES_GCM_BASE_GAS,
    word: AES_GCM_PER_BLOCK,
  })
}

const validateParams = <T>(
  args: readonly unknown[],
  encryption: boolean
): readonly [Hex, bigint, T] => {
  const [aesKey, nonce, input] = args as [Hex, number, T]

  const aesKeyBytes = hexToBytes(aesKey as Hex)
  if (aesKeyBytes.length !== 32) {
    throw new Error(
      `Invalid AES key: expected 32 bytes but found ${aesKeyBytes.length}`
    )
  }
  const nonceBytes = numberToBytes(nonce as number, { size: 12 })
  if (nonceBytes.length !== 12) {
    throw new Error(
      `Invalid nonce: expected 12 bytes but found ${nonceBytes.length}`
    )
  }

  if (encryption) {
    const plaintextBytes = stringToBytes(input as string)
    if (plaintextBytes.length < MIN_AES_PLAINTEXT_LENGTH) {
      throw new Error(
        `Invalid plaintext: expected at least ${MIN_AES_PLAINTEXT_LENGTH} bytes but found ${plaintextBytes.length}`
      )
    }
  } else {
    const ciphertextBytes = hexToBytes(input as Hex)
    if (ciphertextBytes.length < MIN_AES_CIPHERTEXT_LENGTH) {
      throw new Error(
        `Invalid ciphertext: expected at least ${MIN_AES_CIPHERTEXT_LENGTH} bytes but found ${ciphertextBytes.length}`
      )
    }
  }
  return [aesKey, BigInt(nonce as number), input] as [Hex, bigint, T]
}

export const aesGcmEncryption: Precompile<AesGcmEncryptionParams, Hex> = {
  address: AES_GCM_ENCRYPTION_ADDRESS,
  gasLimit: aesGcmGasCost,
  encodeParams: (args) => {
    const [aesKey, nonce, plaintext] = validateParams<string>(
      [args.aesKey, args.nonce, args.plaintext],
      true
    )
    const nonceHex = numberToHex(nonce, { size: 12 })
    const plaintextHex = stringToHex(plaintext)
    return `${aesKey}${nonceHex.slice(2)}${plaintextHex.slice(2)}`
  },
  decodeResult: (result: Hex) => trim(result),
}

type AesGcmCommonParams = {
  aesKey: Hex
  nonce: number
}

export type AesGcmEncryptionParams = AesGcmCommonParams & {
  plaintext: string
}

export type AesGcmDecryptionParams = AesGcmCommonParams & {
  ciphertext: Hex
}

export const aesGcmDecryption: Precompile<AesGcmDecryptionParams, string> = {
  address: AES_GCM_DECRYPTION_ADDRESS,
  gasLimit: aesGcmGasCost,
  encodeParams: (args) => {
    const [aesKey, nonce, cipherText] = validateParams<Hex>(
      [args.aesKey, args.nonce, args.ciphertext],
      false
    )
    const nonceHex = numberToHex(nonce, { size: 12 })
    return `${aesKey}${nonceHex.slice(2)}${cipherText.slice(2)}`
  },
  decodeResult: (result: Hex) => hexToString(trim(result)),
}
