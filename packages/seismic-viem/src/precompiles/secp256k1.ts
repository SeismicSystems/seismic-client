import {
  Signature,
  encodeAbiParameters,
  hashMessage,
  parseSignature,
} from 'viem'
import { Hex } from 'viem'

import {
  CallClient,
  Precompile,
  callPrecompile,
} from '@sviem/precompiles/precompile.ts'

export const SECP256K1_SIG_ADDRESS =
  '0x0000000000000000000000000000000000000069'
export const SECP256K1_SIG_BASE_GAS = 3000n

/**
 * Parameters required for secp256k1 signature generation.
 *
 * @type {Object}
 * @property {Hex} sk - The secret key in hexadecimal format to use for signing.
 * @property {string} message - The message to be signed.
 */
export type Secp256K1SigParams = { sk: Hex; message: string }

/**
 * Precompile contract configuration for secp256k1 signature generation.
 *
 * @type {Precompile<Secp256K1SigParams, Signature>}
 * @property {Hex} address - The address of the secp256k1 signature precompile contract.
 * @property {Function} gasLimit - Function that returns the base gas cost for the operation.
 * @property {Function} encodeParams - Function that encodes the input parameters for the precompile call.
 *   - Takes an object with `sk` (secret key) and `message` parameters.
 *   - Returns ABI-encoded parameters with the secret key and hashed message.
 * @property {Function} decodeResult - Function that parses the signature from the precompile result.
 */
export const secp256k1SigPrecompile: Precompile<Secp256K1SigParams, Signature> =
  {
    address: SECP256K1_SIG_ADDRESS,
    gasCost: () => SECP256K1_SIG_BASE_GAS,
    encodeParams: ({ sk, message }) => {
      const params = [
        { name: 'sk', type: 'bytes32' },
        { name: 'messageHash', type: 'bytes32' },
      ]
      const skHex = sk as Hex
      return encodeAbiParameters(params, [skHex, hashMessage(message)])
    },
    decodeResult: parseSignature,
  }

/**
 * Signs a message using secp256k1.
 *
 * @param {CallClient} client - The public client to use for the precompile call.
 * @param {Secp256K1SigParams} args - The parameters for the secp256k1 signature operation.
 *   - `sk` {Hex} - The secret key in hexadecimal format to use for signing.
 *   - `message` {string} - The message to sign.
 *
 * @throws {Error} May throw if the precompile call fails.
 *
 * @returns {Promise<Signature>} A promise that resolves to the signature in the format defined by the Signature type.
 *
 * @example
 * ```typescript
 * const signature = await secp256k1Sig(client, {
 *   sk: '0x123...', // Your private key
 *   message: 'Hello, world!'
 * });
 * ```
 */
export const secp256k1Sig = async (
  client: CallClient,
  args: Secp256K1SigParams
) => {
  return callPrecompile({
    client,
    precompile: secp256k1SigPrecompile,
    args,
  })
}
