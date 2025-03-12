import {
  Hex,
  decodeAbiParameters,
  encodeAbiParameters,
  numberToHex,
} from 'viem'

import {
  CallClient,
  Precompile,
  callPrecompile,
} from '@sviem/precompiles/precompile'

export const RNG_ADDRESS = '0x0000000000000000000000000000000000000064'
export const RNG_GAS = 3505n

/**
 * Precompile contract configuration for random number generation.
 *
 * @type {Precompile<bigint | number, bigint>}
 * @property {Hex} address - The address of the random number generator precompile contract.
 * @property {Function} gasLimit - Function that returns the gas cost for the RNG operation.
 * @property {Function} encodeParams - Function that encodes the input parameter for the precompile call.
 *   - Takes a number or bigint parameter representing the desired number of bytes.
 *   - Converts the bytes to a hex value and encodes it as bytes4.
 *   - Throws an error if the bytes is not a number or bigint, or if the bytes is greater than 32.
 * @property {Function} decodeResult - Function that decodes the result from the precompile call.
 *   - Parses the returned hex value as a uint256.
 *   - Returns the decoded value as a bigint.
 */
export const rngPrecompile: Precompile<bigint | number, bigint> = {
  address: RNG_ADDRESS,
  gasLimit: () => RNG_GAS,
  encodeParams: (bytes) => {
    if (typeof bytes !== 'bigint' && typeof bytes !== 'number') {
      throw new Error('Invalid length: must be a number or bigint')
    }
    if (BigInt(bytes) > 32n) {
      throw new Error('Invalid length: must be less than or equal to 32')
    }
    const encodedBytes = numberToHex(bytes, { size: 4 })
    return encodeAbiParameters(
      [{ name: 'bytes', type: 'bytes4' }],
      [encodedBytes]
    )
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'uint256' }], result)
    return output as bigint
  },
}

/**
 * Generates a random number using the RNG precompile.
 *
 * @param {CallClient} client - The public client to use for the precompile call.
 * @param {bigint | number} bytes - The number of bytes to generate.
 *
 * @throws {Error} Throws if:
 *   - The bytes argument is not a number or bigint.
 *   - The bytes argument is greater than 32.
 *   - The precompile call fails.
 *
 * @returns {Promise<bigint>} A promise that resolves to the randomly generated number as a bigint.
 *
 * @example
 * ```typescript
 * // Generate a random uint8
 * const randomUint8 = await rng(client, 1);
 *
 * // Generate a random uint256
 * const randomUint256 = await rng(client, 32);
 */
export const rng = async (
  client: CallClient,
  bytes: bigint | number
): Promise<bigint> => {
  return callPrecompile({
    client,
    precompile: rngPrecompile,
    args: bytes,
  })
}
