import { Address, decodeAbiParameters, hexToBytes } from 'viem'
import { Hex } from 'viem'

import {
  HKDF_EXPAND_COST_GAS,
  SHARED_SECRET_GAS,
} from '@sviem/precompiles/hkdf.ts'
import {
  CallClient,
  Precompile,
  callPrecompile,
} from '@sviem/precompiles/precompile.ts'

export const ECDH_ADDRESS: Address =
  '0x0000000000000000000000000000000000000065'
const SECRET_KEY_LENGTH = 32
const PUBLIC_KEY_LENGTH = 33

const validateKey = (key: Hex, sk: boolean) => {
  const bytes = hexToBytes(key)
  const expectedLength = sk ? SECRET_KEY_LENGTH : PUBLIC_KEY_LENGTH
  if (bytes.length !== expectedLength) {
    throw new Error(
      `Invalid ${sk ? 'secret' : 'public'} key: must be ${expectedLength} bytes (received ${bytes.length})`
    )
  }
}

/**
 * Parameters required for ECDH (Elliptic Curve Diffie-Hellman) operations.
 *
 * @type {Object}
 * @property {Hex} sk - The secret key in hexadecimal format.
 * @property {Hex} pk - The public key in hexadecimal format.
 */
export type EcdhParams = {
  sk: Hex
  pk: Hex
}

/**
 * Precompile contract configuration for ECDH (Elliptic Curve Diffie-Hellman) operations.
 *
 * @type {Precompile<EcdhParams, Hex>}
 * @property {Hex} address - The address of the ECDH precompile contract.
 * @property {Function} gasLimit - Function that returns the gas cost for the ECDH operation.
 *   - Returns the sum of the shared secret gas cost and HKDF expansion cost.
 * @property {Function} encodeParams - Function that encodes the input parameters for the precompile call.
 *   - Validates both the secret key and public key.
 *   - Concatenates the secret key and public key (without the '0x' prefix on the public key).
 * @property {Function} decodeResult - Function that decodes the result from the precompile call.
 *   - Parses the returned hex value as a bytes32 value.
 *   - Returns the decoded value as a Hex string.
 */
export const ecdhPrecompile: Precompile<EcdhParams, Hex> = {
  address: ECDH_ADDRESS,
  gasCost: () => SHARED_SECRET_GAS + HKDF_EXPAND_COST_GAS,
  encodeParams: ({ sk, pk }) => {
    validateKey(sk, true)
    validateKey(pk, false)
    return `${sk}${pk.slice(2)}`
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'bytes32' }], result)
    return output as Hex
  },
}

/**
 * Performs an ECDH (Elliptic Curve Diffie-Hellman) key exchange operation to derive a shared secret.
 *
 * @param {CallClient} client - The public client to use for the precompile call.
 * @param {EcdhParams} args - The parameters for the ECDH operation.
 *   - `sk` {Hex} - The secret key in hexadecimal format.
 *   - `pk` {Hex} - The public key in hexadecimal format.
 *
 * @throws {Error} May throw if key validation fails or if the precompile call fails.
 *
 * @returns {Promise<Hex>} A promise that resolves to the 32-byte shared secret in hexadecimal format.
 *
 * @example
 * ```typescript
 * const sharedSecret = await ecdh(client, {
 *   sk: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
 *   pk: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba'
 * });
 * ```
 */
export const ecdh = async (
  client: CallClient,
  args: EcdhParams
): Promise<Hex> => {
  return callPrecompile({
    client,
    precompile: ecdhPrecompile,
    args,
  })
}
