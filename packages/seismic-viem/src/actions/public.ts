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

import type { ShieldedPublicClient } from '@sviem/client'
import {
  AesGcmDecryptionParams,
  AesGcmEncryptionParams,
  aesGcmDecrypt,
  aesGcmEncrypt,
} from '@sviem/precompiles/aes'
import { EcdhParams, ecdhPrecompile } from '@sviem/precompiles/ecdh'
import { hdfkPrecompile } from '@sviem/precompiles/hkdf'
import { callPrecompile } from '@sviem/precompiles/precompile'
import { rngPrecompile } from '@sviem/precompiles/rng'
import {
  Secp256K1SigParams,
  secp256k1SigPrecompile,
} from '@sviem/precompiles/secp256k1'
import { RpcRequest } from '@sviem/viem-internal/rpc'

/**
 * Defines the additional actions available on a shielded public client.
 *
 * These actions provide functionality specific to shielded interactions,
 * such as retrieving the TEE public key or interacting with storage and transactions.
 *
 * @property getTeePublicKey - Retrieves the public key for the Trusted Execution Environment (TEE).
 * @returns A promise that resolves to the public key in hexadecimal or string format.
 *
 * @property getStorageAt - (Not Supported) Attempts to retrieve a storage value at a specified location.
 * Throws an error when called on a shielded public client.
 *
 * @property getTransaction - (Not Supported) Attempts to retrieve a transaction by its parameters.
 * Throws an error when called on a shielded public client.
 *
 * @property rng - Generates a random number of the specified size.
 * @param size - The size of the random number to generate.
 * @returns A promise that resolves to the random number in hexadecimal format.
 *
 * @property ecdh - Performs Elliptic Curve Diffie-Hellman key exchange.
 * @param params - The parameters for the ECDH operation.
 * @returns A promise that resolves to the shared secret in hexadecimal format.
 *
 * @property aesGcmEncryption - Encrypts a plaintext using AES-GCM.
 * @param params - The parameters for the AES-GCM operation.
 * @returns A promise that resolves to the encrypted ciphertext in hexadecimal format.
 *
 * @property aesGcmDecryption - Decrypts a ciphertext using AES-GCM.
 * @param params - The parameters for the AES-GCM operation.
 * @returns A promise that resolves to the decrypted plaintext.
 *
 * @property hdfk - Performs HKDF key derivation.
 * @param ikm - The input key material in hexadecimal format.
 * @returns A promise that resolves to the derived key in hexadecimal format.
 *
 * @property secp256k1Signature - Signs a message using secp256k1.
 * @param params - The parameters for the secp256k1 operation.
 * @returns A promise that resolves to the signature in hexadecimal format.
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
  rng: (size: bigint | number) => Promise<bigint>
  ecdh: (params: EcdhParams) => Promise<Hex>
  aesGcmEncryption: (params: AesGcmEncryptionParams) => Promise<Hex>
  aesGcmDecryption: (params: AesGcmDecryptionParams) => Promise<string>
  hdfk: (ikm: string | Hex) => Promise<Hex>
  secp256k1Signature: (params: Secp256K1SigParams) => Promise<Signature>
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
  // @ts-ignore
  publicRequest: async (_args) => client.request<TRpcSchema>(_args),
  rng: async (size) =>
    callPrecompile({
      client,
      precompile: rngPrecompile,
      args: size,
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
  secp256k1Signature: (params) =>
    callPrecompile({
      client,
      precompile: secp256k1SigPrecompile,
      args: params,
    }),
  aesGcmEncryption: (params) => aesGcmEncrypt(client, params),
  aesGcmDecryption: (params) => aesGcmDecrypt(client, params),
})
