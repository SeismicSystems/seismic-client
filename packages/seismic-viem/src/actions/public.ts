import type {
  Account,
  BlockTag,
  Chain,
  GetStorageAtParameters,
  GetStorageAtReturnType,
  GetTransactionParameters,
  GetTransactionReturnType,
  Hex,
  RpcSchema,
  Transport,
} from 'viem'

import type { ShieldedPublicClient } from '@sviem/client'

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
  TChain extends Chain | undefined = Chain | undefined,
> = {
  getTeePublicKey: () => Promise<Hex | string>
  getStorageAt: (
    args: GetStorageAtParameters
  ) => Promise<GetStorageAtReturnType>
  getTransaction: (
    args: GetTransactionParameters
  ) => Promise<GetTransactionReturnType<TChain, BlockTag>>
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
): ShieldedPublicActions<TChain> => ({
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
  getTransaction: async (_args) => {
    throw new Error('Cannot call getTransaction with a shielded public client')
  },
})
