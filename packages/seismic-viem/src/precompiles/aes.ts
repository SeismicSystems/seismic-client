import {
  Hex,
  hexToBytes,
  hexToString,
  isHex,
  numberToBytes,
  numberToHex,
  stringToBytes,
  stringToHex,
  trim,
} from 'viem'

import {
  CallClient,
  Precompile,
  calcLinearGasCost,
  callPrecompile,
} from '@sviem/precompiles/precompile.ts'

export const AES_GCM_ENCRYPT_ADDRESS =
  '0x0000000000000000000000000000000000000066'
export const AES_GCM_DECRYPT_ADDRESS =
  '0x0000000000000000000000000000000000000067'

const AES_GCM_BASE_GAS = 1000n
const AES_GCM_PER_BLOCK = 30n

const MIN_AES_PLAINTEXT_LENGTH = 0
const MIN_AES_CIPHERTEXT_LENGTH = 16

const aesGcmGasCost = (value: string | Hex) => {
  const valueBytes = isHex(value)
    ? hexToBytes(value as Hex)
    : stringToBytes(value as string)
  return calcLinearGasCost({
    bus: 16,
    len: valueBytes.length,
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

/**
 * Common parameters used in AES-GCM encryption and decryption operations.
 *
 * @type {Object}
 * @property {Hex} aesKey - The AES key in hexadecimal format used for encryption/decryption.
 * @property {number} nonce - The nonce value used for encryption/decryption.
 */
type AesGcmCommonParams = {
  aesKey: Hex
  nonce: number
}

/**
 * Parameters required for AES-GCM encryption operations.
 *
 * @type {Object}
 * @property {Hex} aesKey - The AES key in hexadecimal format used for encryption.
 * @property {number} nonce - The nonce value used for encryption.
 * @property {string} plaintext - The plaintext string to be encrypted.
 */
export type AesGcmEncryptionParams = AesGcmCommonParams & {
  plaintext: string
}

/**
 * Parameters required for AES-GCM decryption operations.
 *
 * @type {Object}
 * @property {Hex} aesKey - The AES key in hexadecimal format used for decryption.
 * @property {number} nonce - The nonce value used for decryption.
 * @property {Hex} ciphertext - The ciphertext in hexadecimal format to be decrypted.
 */
export type AesGcmDecryptionParams = AesGcmCommonParams & {
  ciphertext: Hex
}

/**
 * Precompile contract configuration for AES-GCM encryption operations.
 *
 * @type {Precompile<AesGcmEncryptionParams, Hex>}
 * @property {Hex} address - The address of the AES-GCM encryption precompile contract.
 * @property {Function} gasLimit - Function that calculates the gas cost based on plaintext length.
 * @property {Function} encodeParams - Function that encodes the input parameters for the precompile call.
 *   - Validates and processes the AES key, nonce, and plaintext parameters.
 *   - Converts the nonce to a 12-byte hex representation.
 *   - Converts the plaintext to hex and concatenates all parameters.
 * @property {Function} decodeResult - Function that trims the result from the precompile call.
 */
export const aesGcmEncryptPrecompile: Precompile<AesGcmEncryptionParams, Hex> =
  {
    address: AES_GCM_ENCRYPT_ADDRESS,
    gasCost: (args) => aesGcmGasCost(args.plaintext as string),
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

/**
 * Precompile contract configuration for AES-GCM decryption operations.
 *
 * @type {Precompile<AesGcmDecryptionParams, string>}
 * @property {Hex} address - The address of the AES-GCM decryption precompile contract.
 * @property {Function} gasLimit - Function that calculates the gas cost based on ciphertext length.
 * @property {Function} encodeParams - Function that encodes the input parameters for the precompile call.
 *   - Validates and processes the AES key, nonce, and ciphertext parameters.
 *   - Converts the nonce to a 12-byte hex representation.
 *   - Concatenates all parameters.
 * @property {Function} decodeResult - Function that trims and converts the hex result to a string.
 */
export const aesGcmDecryptPrecompile: Precompile<
  AesGcmDecryptionParams,
  string
> = {
  address: AES_GCM_DECRYPT_ADDRESS,
  gasCost: (args) => aesGcmGasCost(args.ciphertext as Hex),
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

/**
 * Encrypts plaintext using AES-GCM encryption through a precompile contract.
 *
 * @param {CallClient} client - The public client to use for the precompile call.
 * @param {AesGcmEncryptionParams} args - The parameters for the AES-GCM encryption operation.
 *   - `aesKey` {Hex} - The AES key in hexadecimal format to use for encryption.
 *   - `nonce` {number} - The nonce value to use for encryption.
 *   - `plaintext` {string} - The plaintext string to encrypt.
 *
 * @throws {Error} May throw if parameter validation fails or if the precompile call fails.
 *
 * @returns {Promise<Hex>} A promise that resolves to the encrypted ciphertext in hexadecimal format.
 *
 * @example
 * ```typescript
 * const ciphertext = await aesGcmEncrypt(client, {
 *   aesKey: '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
 *   nonce: 123456,
 *   plaintext: 'Secret message'
 * });
 * ```
 */
export const aesGcmEncrypt = async (
  client: CallClient,
  args: AesGcmEncryptionParams
) => {
  return callPrecompile({
    client,
    precompile: aesGcmEncryptPrecompile,
    args,
  })
}

/**
 * Decrypts ciphertext using AES-GCM decryption through a precompile contract.
 *
 * @param {CallClient} client - The public client to use for the precompile call.
 * @param {AesGcmDecryptionParams} args - The parameters for the AES-GCM decryption operation.
 *   - `aesKey` {Hex} - The AES key in hexadecimal format to use for decryption.
 *   - `nonce` {number} - The nonce value to use for decryption.
 *   - `ciphertext` {Hex} - The ciphertext in hexadecimal format to decrypt.
 *
 * @throws {Error} May throw if parameter validation fails or if the precompile call fails.
 *
 * @returns {Promise<string>} A promise that resolves to the decrypted plaintext as a string.
 *
 * @example
 * ```typescript
 * const plaintext = await aesGcmDecrypt(client, {
 *   aesKey: '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
 *   nonce: 123456,
 *   ciphertext: '0x7b226d657373616765223a22656e63727970746564227d'
 * });
 * ```
 */
export const aesGcmDecrypt = async (
  client: CallClient,
  args: AesGcmDecryptionParams
) => {
  return callPrecompile({
    client,
    precompile: aesGcmDecryptPrecompile,
    args,
  })
}
