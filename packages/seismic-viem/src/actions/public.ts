import type {
  Account,
  Chain,
  EIP1193RequestFn,
  EIP1474Methods,
  GetStorageAtParameters,
  GetStorageAtReturnType,
  Hex,
  RpcSchema,
  Signature,
  Transport,
} from 'viem'

import type { ShieldedPublicClient } from '@sviem/client.ts'
import {
  GetAddressExplorerOptions,
  GetBlockExplorerOptions,
  GetExplorerUrlOptions,
  GetTokenExplorerOptions,
  GetTxExplorerOptions,
  addressExplorerUrl,
  blockExplorerUrl,
  getExplorerUrl,
  tokenExplorerUrl,
  txExplorerUrl,
} from '@sviem/explorer.ts'
import {
  AesGcmDecryptionParams,
  AesGcmEncryptionParams,
  aesGcmDecrypt,
  aesGcmEncrypt,
} from '@sviem/precompiles/aes.ts'
import { EcdhParams, ecdhPrecompile } from '@sviem/precompiles/ecdh.ts'
import { hdfkPrecompile } from '@sviem/precompiles/hkdf.ts'
import { callPrecompile } from '@sviem/precompiles/precompile.ts'
import { RngParams, rngPrecompile } from '@sviem/precompiles/rng.ts'
import {
  Secp256K1SigParams,
  secp256k1SigPrecompile,
} from '@sviem/precompiles/secp256k1.ts'
import { RpcRequest } from '@sviem/viem-internal/rpc.ts'

/**
 * Defines the additional actions available on a shielded public client.
 *
 * These actions provide functionality specific to shielded interactions,
 * such as retrieving the TEE public key or interacting with storage and transactions.
 *
 * @type {Object}
 * @template {rpcSchema} - The RPC schema type, which may be undefined.
 * @property {Function} getTeePublicKey - Retrieves the public key for the Trusted Execution Environment (TEE).
 *   @returns {Promise<Hex | string>} A promise that resolves to the public key in hexadecimal or string format.
 *
 * @property {Function} getStorageAt - (Not Supported) Attempts to retrieve a storage value at a specified location.
 *   @param {GetStorageAtParameters} args - The parameters for the storage retrieval.
 *   @returns {Promise<GetStorageAtReturnType>} Throws an error when called on a shielded public client.
 *
 * @property {Function} publicRequest - Performs a public RPC request.
 *   @param {RpcRequest} args - The RPC request parameters.
 *   @returns {EIP1193RequestFn} A function that performs the EIP-1193 request.
 *
 * @property {Function} explorerUrl - Generates a URL for the block explorer based on the provided options.
 *   @param {GetExplorerUrlOptions} options - Options containing:
 *     - `id` {string} - The identifier for the item (address, transaction hash, etc.).
 *     - `item` {'tx'|'address'|'token'|'block'} - The type of item to explore.
 *     - `tab` {TxExplorerTab|AddressExplorerTab|TokenExplorerTab|BlockExplorerTab} [optional] - Specific tab to open in the explorer.
 *   @returns {string|undefined} The generated URL or undefined if not available.
 *
 * @property {Function} addressExplorerUrl - Generates a URL for exploring an address in the block explorer.
 *   @param {GetAddressExplorerOptions} options - Options containing:
 *     - `address` {Address} - The address to explore.
 *     - `tab` {AddressExplorerTab} [optional] - Specific tab to open in the explorer.
 *   @returns {string|undefined} The generated URL or undefined if not available.
 *
 * @property {Function} blockExplorerUrl - Generates a URL for exploring a block in the block explorer.
 *   @param {GetBlockExplorerOptions} options - Options containing:
 *     - `blockNumber` {number} - The block number to explore.
 *     - `tab` {BlockExplorerTab} [optional] - Specific tab to open in the explorer.
 *   @returns {string|undefined} The generated URL or undefined if not available.
 *
 * @property {Function} txExplorerUrl - Generates a URL for exploring a transaction in the block explorer.
 *   @param {GetTxExplorerOptions} options - Options containing:
 *     - `txHash` {Hex} - The transaction hash to explore.
 *     - `tab` {TxExplorerTab} [optional] - Specific tab to open in the explorer.
 *   @returns {string|undefined} The generated URL or undefined if not available.
 *
 * @property {Function} tokenExplorerUrl - Generates a URL for exploring a token in the block explorer.
 *   @param {GetTokenExplorerOptions} options - Options containing:
 *     - `address` {Address} - The token contract address to explore.
 *     - `tab` {TokenExplorerTab} [optional] - Specific tab to open in the explorer.
 *   @returns {string|undefined} The generated URL or undefined if not available.
 *
 * @property {Function} rng - Generates a random number of the specified size.
 *   @param {RngParams} args - The parameters for random number generation.
 *     - `numBytes` {bigint | number} - The number of bytes to generate (must be less than or equal to 32).
 *     - `pers` {Hex | ByteArray} [optional] - Personalization string to seed the random number generator.
 *   @returns {Promise<bigint>} A promise that resolves to the random number as a bigint.
 *
 * @property {Function} ecdh - Performs Elliptic Curve Diffie-Hellman key exchange.
 *   @param {EcdhParams} args - The parameters for the ECDH operation.
 *     - `sk` {Hex} - The private key of the local party.
 *     - `pk` {Hex} - The public key of the remote party.
 *   @returns {Promise<Hex>} A promise that resolves to the shared secret in hexadecimal format.
 *
 * @property {Function} aesGcmEncryption - Encrypts a plaintext using AES-GCM.
 *   @param {AesGcmEncryptionParams} args - The parameters for the AES-GCM encryption operation.
 *     - `aesKey` {Hex} - The AES key in hexadecimal format to use for encryption.
 *     - `nonce` {number} - The nonce value to use for encryption.
 *     - `plaintext` {string} - The plaintext string to encrypt.
 *   @returns {Promise<Hex>} A promise that resolves to the encrypted ciphertext in hexadecimal format.
 *
 * @property {Function} aesGcmDecryption - Decrypts a ciphertext using AES-GCM.
 *   @param {AesGcmDecryptionParams} args - The parameters for the AES-GCM decryption operation.
 *     - `aesKey` {Hex} - The AES key in hexadecimal format to use for decryption.
 *     - `nonce` {number} - The nonce value to use for decryption.
 *     - `ciphertext` {Hex} - The ciphertext in hexadecimal format to decrypt.
 *   @returns {Promise<string>} A promise that resolves to the decrypted plaintext as a string.
 *
 * @property {Function} hdfk - Performs HKDF key derivation function.
 *   @param {string | Hex} ikm - The input key material as a string or in hexadecimal format.
 *   @returns {Promise<Hex>} A promise that resolves to the derived key in hexadecimal format.
 *
 * @property {Function} secp256k1Signature - Signs a message using secp256k1.
 *   @param {Secp256K1SigParams} args - The parameters for the secp256k1 signing operation.
 *     - `sk` {Hex} - The private key in hexadecimal format.
 *     - `message` {string} - The message to sign.
 *   @returns {Promise<Signature>} A promise that resolves to the signature object.
 */
export type ShieldedPublicActions<
  rpcSchema extends RpcSchema | undefined = undefined,
> = {
  getTeePublicKey: () => Promise<Hex | string>
  getStorageAt: (
    args: GetStorageAtParameters
  ) => Promise<GetStorageAtReturnType>
  publicRequest: (
    args: RpcRequest
  ) => EIP1193RequestFn<
    rpcSchema extends undefined ? EIP1474Methods : rpcSchema
  >
  explorerUrl: (options: GetExplorerUrlOptions) => string | null
  addressExplorerUrl: (options: GetAddressExplorerOptions) => string | null
  blockExplorerUrl: (options: GetBlockExplorerOptions) => string | null
  txExplorerUrl: (options: GetTxExplorerOptions) => string | null
  tokenExplorerUrl: (options: GetTokenExplorerOptions) => string | null
  rng: (args: RngParams) => Promise<bigint>
  ecdh: (args: EcdhParams) => Promise<Hex>
  aesGcmEncryption: (args: AesGcmEncryptionParams) => Promise<Hex>
  aesGcmDecryption: (args: AesGcmDecryptionParams) => Promise<string>
  hdfk: (ikm: string | Hex) => Promise<Hex>
  secp256k1Signature: (args: Secp256K1SigParams) => Promise<Signature>
}

/**
 * Implements the shielded public actions for a given shielded public client.
 *
 * This function defines the behavior of the shielded-specific actions, such as
 * retrieving the TEE public key. It also disables unsupported actions like
 * `getStorageAt` and `getTransaction`, throwing errors if they are called.
 *
 * @param client - The shielded public client instance.
 *
 * @returns {ShieldedPublicActions<TChain>} An object containing the shielded public actions.
 *
 * @example
 * ```typescript
 * const actions = shieldedPublicActions(client);
 *
 * // Retrieve the TEE public key
 * const teeKey = await actions.getTeePublicKey();
 * console.log('TEE Public Key:', teeKey);
 *
 * // Attempting to call unsupported actions
 * actions.getStorageAt(...); // Throws an error
 * actions.getTransaction(...); // Throws an error
 *
 * // Generate a random number
 * const randomNumber = await actions.rng({ numBytes: 32 });
 * console.log('Random Number:', randomNumber);
 * ```
 */
export const shieldedPublicActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TRpcSchema extends RpcSchema | undefined = undefined,
>(
  client: ShieldedPublicClient<TTransport, TChain, TAccount, TRpcSchema>
): ShieldedPublicActions => ({
  getTeePublicKey: async () => {
    // @ts-ignore
    const key: Hex | string = await client.request({
      method: 'seismic_getTeePublicKey',
    })
    return key.startsWith('0x') ? key.slice(2) : key
  },
  getStorageAt: async (_args) => {
    throw new Error('Cannot call getStorageAt with a shielded public client')
  },
  // @ts-expect-error: TODO: fix this typing
  publicRequest: async (_args) => client.request<TRpcSchema>(_args),
  explorerUrl: (options) => getExplorerUrl(client.chain, options),
  addressExplorerUrl: (options) =>
    addressExplorerUrl({ chain: client.chain, ...options }),
  blockExplorerUrl: (options) =>
    blockExplorerUrl({ chain: client.chain, ...options }),
  txExplorerUrl: (options) =>
    txExplorerUrl({ chain: client.chain, ...options }),
  tokenExplorerUrl: (options) =>
    tokenExplorerUrl({ chain: client.chain, ...options }),
  rng: async (args) =>
    callPrecompile({
      client,
      precompile: rngPrecompile,
      args,
    }),
  ecdh: (args) =>
    callPrecompile({
      client,
      precompile: ecdhPrecompile,
      args,
    }),
  hdfk: (input) =>
    callPrecompile({
      client,
      precompile: hdfkPrecompile,
      args: input,
    }),
  secp256k1Signature: (args) =>
    callPrecompile({
      client,
      precompile: secp256k1SigPrecompile,
      args,
    }),
  aesGcmEncryption: (args) => aesGcmEncrypt(client, args),
  aesGcmDecryption: (args) => aesGcmDecrypt(client, args),
})
