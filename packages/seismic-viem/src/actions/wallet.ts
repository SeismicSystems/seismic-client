import type { Account, Chain, Transport } from 'viem'
import { readContract, writeContract } from 'viem/actions'

import { ShieldedWalletClient } from '@sviem/client'
import { signedReadContract } from '@sviem/contract/read'
import { shieldedWriteContract } from '@sviem/contract/write'
import type {
  SendSeismicTransactionParameters,
  SendSeismicTransactionRequest,
  SendSeismicTransactionReturnType,
} from '@sviem/sendTransaction.js'
import { sendShieldedTransaction } from '@sviem/sendTransaction.js'
import { signedCall } from '@sviem/signedCall'
import type { SignedCall } from '@sviem/signedCall'
import type { ReadContract, WriteContract } from '@sviem/viem-internal/contract'

/**
 * Defines the actions available for a shielded wallet client.
 *
 * These actions provide functionality for interacting with shielded contracts,
 * making signed calls, sending shielded transactions, and retrieving encryption keys.
 *
 * @template TChain - The type of the blockchain chain (extends `Chain` or `undefined`).
 * @template TAccount - The type of the account (extends `Account` or `undefined`).
 *
 * @property writeContract - Executes a write operation on a shielded contract.
 * Takes parameters specific to the contract and returns the transaction result.
 *
 * @property readContract - Reads data from a shielded contract using signed read methods.
 * Returns the contract's data as defined by the provided arguments.
 *
 * @property signedCall - Executes a signed call on the blockchain, allowing for
 * advanced interactions with shielded contracts or transactions.
 *
 * @property sendShieldedTransaction - Sends a shielded transaction using encrypted payloads
 * and advanced features such as blobs and authorization lists.
 *
 * @param args - The parameters required for sending the transaction.
 *
 * @returns A promise that resolves to the result of the shielded transaction.
 *
 * @property getEncryption - Retrieves the encryption key for the shielded wallet client.
 * @returns {Hex} The encryption key in hexadecimal format.
 */
export type ShieldedWalletActions<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
> = {
  writeContract: WriteContract<TChain, TAccount>
  twriteContract: WriteContract<TChain, TAccount>
  readContract: ReadContract
  treadContract: ReadContract
  signedCall: SignedCall<TChain>
  sendShieldedTransaction: <
    const request extends SendSeismicTransactionRequest<TChain, TChainOverride>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    args: SendSeismicTransactionParameters<
      TChain,
      TAccount,
      TChainOverride,
      request
    >
  ) => Promise<SendSeismicTransactionReturnType>
}

/**
 * Creates the shielded wallet actions for a given shielded wallet client.
 *
 * This function initializes and returns a set of actions, such as interacting with shielded
 * contracts, making signed calls, sending shielded transactions, and retrieving encryption keys.
 *
 * @template TTransport - The transport type used by the client (extends `Transport`).
 * @template TChain - The blockchain chain type (extends `Chain` or `undefined`).
 * @template TAccount - The account type associated with the client (extends `Account` or `undefined`).
 *
 * @param client - The shielded wallet client instance.
 * @param encryption - The encryption key used by the shielded wallet client.
 *
 * @returns {ShieldedWalletActions<TChain, TAccount>} An object containing the shielded wallet actions.
 *
 * @example
 * ```typescript
 * const actions = shieldedWalletActions(client, '0xabcdef123456...');
 *
 * // Write to a shielded contract
 * const writeResult = await actions.writeContract({
 *   address: '0x1234...',
 *   data: '0xdeadbeef...',
 * });
 *
 * // Read from a shielded contract
 * const readResult = await actions.readContract({
 *   address: '0x1234...',
 *   method: 'getValue',
 * });
 *
 * // Send a shielded transaction
 * const txResult = await actions.sendShieldedTransaction({
 *   account: { address: '0x5678...' },
 *   data: '0xabcdef...',
 *   value: 1000n,
 * });
 *
 * // Get encryption key
 * const encryptionKey = actions.getEncryption();
 * console.log('Encryption Key:', encryptionKey);
 * ```
 */
export const shieldedWalletActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account = Account,
>(
  client: ShieldedWalletClient<TTransport, TChain, TAccount>
): ShieldedWalletActions<TChain, TAccount> => {
  return {
    writeContract: (args) => shieldedWriteContract(client, args as any),
    readContract: (args) => signedReadContract(client, args as any),
    treadContract: (args) => readContract(client, args as any),
    twriteContract: (args) => writeContract(client, args as any),
    signedCall: (args) => signedCall(client, args as any),
    sendShieldedTransaction: (args) =>
      sendShieldedTransaction(client, args as any),
  }
}
