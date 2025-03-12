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
} from '@sviem/explorer'
import {
  AesGcmDecryptionParams,
  AesGcmEncryptionParams,
  aesGcmDecryption,
  aesGcmEncryption,
} from '@sviem/precompiles/aes'
import { EcdhParams, ecdh } from '@sviem/precompiles/ecdh'
import { hdfk } from '@sviem/precompiles/hkdf'
import { callPrecompile } from '@sviem/precompiles/precompile'
import { rng } from '@sviem/precompiles/rng'
import {
  Secp256K1SigParams,
  secp256k1Signature,
} from '@sviem/precompiles/secp256k1'
import { RpcRequest } from '@sviem/viem-internal/rpc'

/**
 * Defines the additional actions available on a shielded public client.
 *
 * These actions provide functionality specific to shielded interactions,
 * such as retrieving the TEE public key or interacting with storage and transactions.
 *
 * @template TChain - The type of the blockchain chain (extends `Chain` or `undefined`).
 *
 * @property getTeePublicKey - Retrieves the public key for the Trusted Execution Environment (TEE).
 * @returns A promise that resolves to the public key in hexadecimal or string format.
 *
 * @property getStorageAt - (Not Supported) Attempts to retrieve a storage value at a specified location.
 * Throws an error when called on a shielded public client.
 *
 * @property getTransaction - (Not Supported) Attempts to retrieve a transaction by its parameters.
 * Throws an error when called on a shielded public client.
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
  explorerUrl: (options: GetExplorerUrlOptions) => string | undefined
  addressExplorerUrl: (options: GetAddressExplorerOptions) => string | undefined
  blockExplorerUrl: (options: GetBlockExplorerOptions) => string | undefined
  txExplorerUrl: (options: GetTxExplorerOptions) => string | undefined
  tokenExplorerUrl: (options: GetTokenExplorerOptions) => string | undefined
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
 * @template TTransport - The transport type used by the client (extends `Transport`).
 * @template TChain - The blockchain chain type (extends `Chain` or `undefined`).
 * @template TAccount - The account type associated with the client (extends `Account` or `undefined`).
 * @template TRpcSchema - The RPC schema type (extends `RpcSchema` or `undefined`).
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
  rng: async (size) =>
    callPrecompile({
      call: client.call,
      precompile: rng,
      args: size,
    }),
  ecdh: (args) =>
    callPrecompile({
      call: client.call,
      precompile: ecdh,
      args,
    }),
  hdfk: (input) =>
    callPrecompile({
      call: client.call,
      precompile: hdfk,
      args: input,
    }),
  secp256k1Signature: (params) =>
    callPrecompile({
      call: client.call,
      precompile: secp256k1Signature,
      args: params,
    }),
  aesGcmEncryption: (params) =>
    callPrecompile({
      call: client.call,
      precompile: aesGcmEncryption,
      args: params,
    }),
  aesGcmDecryption: (params) =>
    callPrecompile({
      call: client.call,
      precompile: aesGcmDecryption,
      args: params,
    }),
})
