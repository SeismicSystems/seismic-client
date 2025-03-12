import {
  ByteArray,
  Hex,
  bytesToHex,
  decodeAbiParameters,
  hexToBytes,
  isBytes,
  isHex,
  numberToHex,
  pad,
} from 'viem'

import {
  CallClient,
  Precompile,
  calcLinearGasCostU32,
  callPrecompile,
} from '@sviem/precompiles/precompile'

export const RNG_ADDRESS = '0x0000000000000000000000000000000000000064'
const RNG_INIT_BASE_GAS = 3500n
const STROBE_128_WORD_GAS = 5n

const persToBytes = (pers?: Hex | ByteArray): ByteArray => {
  if (!pers) {
    return new Uint8Array()
  }
  if (isHex(pers)) {
    return hexToBytes(pers)
  } else if (isBytes(pers)) {
    return pers
  }
  throw new Error('Invalid pers: must be a hex or bytes array')
}

export type RngParams = {
  numBytes: bigint | number
  pers?: Hex | ByteArray
}

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
export const rngPrecompile: Precompile<RngParams, bigint> = {
  address: RNG_ADDRESS,
  gasCost: ({ numBytes, pers }) => {
    // calls to rng from here will always require an init cost,
    // so we assume it in the gas calculation.
    // if one tx makes multiple calls to rng, it will only pay the init cost once.
    const initCost = calcLinearGasCostU32({
      len: persToBytes(pers).length,
      base: RNG_INIT_BASE_GAS,
      word: STROBE_128_WORD_GAS,
    })
    const fillCost = calcLinearGasCostU32({
      len: Number(numBytes),
      base: 0n,
      word: STROBE_128_WORD_GAS,
    })
    return initCost + fillCost
  },
  encodeParams: ({ numBytes, pers }) => {
    if (typeof numBytes !== 'bigint' && typeof numBytes !== 'number') {
      throw new Error('Invalid length: must be a number or bigint')
    }
    if (BigInt(numBytes) > 32n) {
      throw new Error('Invalid length: must be less than or equal to 32')
    }
    const encodedBytes = numberToHex(numBytes, { size: 4 })
    if (!pers) {
      return encodedBytes
    }
    const encodedPers = bytesToHex(persToBytes(pers))
    return `${encodedBytes}${encodedPers.slice(2)}`
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'uint256' }], pad(result))
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
  args: RngParams
): Promise<bigint> => {
  return callPrecompile({
    client,
    precompile: rngPrecompile,
    args,
  })
}
