import {
  Hex,
  decodeAbiParameters,
  hexToBytes,
  isHex,
  stringToBytes,
  stringToHex,
} from 'viem'

import {
  CallClient,
  Precompile,
  calcLinearGasCost,
  callPrecompile,
} from '@sviem/precompiles/precompile.ts'

export const HKDF_ADDRESS = '0x0000000000000000000000000000000000000068'

const SHA256_BASE_GAS = 60n
const SHA256_PER_WORD = 12n

export const HKDF_EXPAND_COST_GAS = 2n * SHA256_BASE_GAS
export const SHARED_SECRET_GAS = 3000n

/**
 * Precompile contract configuration for HKDF (Hash-based Derivation Function Keyed) operations.
 *
 * @type {Precompile<string | Hex, Hex>}
 * @property {Hex} address - The address of the HKDF precompile contract.
 * @property {Function} gasLimit - Function that calculates the gas cost for the HKDF operation.
 *   - Takes a string or Hex input key material (ikm).
 *   - Converts the input to bytes based on its type.
 *   - Calculates a linear gas cost based on input length.
 *   - Returns twice the linear gas cost plus a fixed expansion cost.
 * @property {Function} encodeParams - Function that encodes the input parameter for the precompile call.
 *   - Returns the input directly if it's already a Hex value.
 *   - Converts string input to a hexadecimal representation.
 * @property {Function} decodeResult - Function that decodes the result from the precompile call.
 *   - Parses the returned hex value as a bytes32 value.
 *   - Returns the decoded value as a Hex string.
 */
export const hdfkPrecompile: Precompile<string | Hex, Hex> = {
  address: HKDF_ADDRESS,
  gasCost: (ikmHex: string | Hex) => {
    const ikmBytes = isHex(ikmHex) ? hexToBytes(ikmHex) : stringToBytes(ikmHex)
    const linearGasCost = calcLinearGasCost({
      bus: 32,
      len: ikmBytes.length,
      base: SHARED_SECRET_GAS,
      word: SHA256_PER_WORD,
    })
    return 2n * linearGasCost + HKDF_EXPAND_COST_GAS
  },
  encodeParams: (input) => {
    if (isHex(input)) {
      return input
    }
    return stringToHex(input)
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'bytes32' }], result)
    return output as Hex
  },
}

/**
 * Executes the HKDF (Hash-based Derivation Function Keyed) precompile.
 *
 * @param {CallClient} client - The public client to use for the precompile call.
 * @param {string | Hex} input - The input to the HKDF precompile, either as a string or hexadecimal value.
 *
 * @throws {Error} May throw if the precompile call fails.
 *
 * @returns {Promise<Hex>} A promise that resolves to the 32-byte output of the HKDF precompile as a hexadecimal string.
 *
 * @example
 * ```typescript
 * // Using a string input
 * const result1 = await hdfk(client, "my input string");
 *
 * // Using a hex input
 * const result2 = await hdfk(client, "0x1234abcd...");
 * ```
 */
export const hdfk = async (
  client: CallClient,
  input: string | Hex
): Promise<Hex> => {
  return callPrecompile({
    client,
    precompile: hdfkPrecompile,
    args: input,
  })
}
