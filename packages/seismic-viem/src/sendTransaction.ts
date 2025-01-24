import type {
  Account,
  Address,
  AssertCurrentChainErrorType,
  BaseError,
  Chain,
  Client,
  DeriveChain,
  FormattedTransactionRequest,
  GetChainIdErrorType,
  GetChainParameter,
  GetTransactionRequestKzgParameter,
  Hash,
  PrepareTransactionRequestErrorType,
  SendRawTransactionErrorType,
  Transport,
  UnionOmit,
} from 'viem'
import { assertCurrentChain } from 'viem'
import type {
  ParseAccountErrorType,
  SignTransactionErrorType,
} from 'viem/accounts'
import { parseAccount } from 'viem/accounts'
import {
  getChainId,
  prepareTransactionRequest,
  sendRawTransaction,
} from 'viem/actions'
import type { RecoverAuthorizationAddressErrorType } from 'viem/experimental'
import type {
  AssertRequestErrorType,
  GetTransactionErrorReturnType,
  RequestErrorType,
} from 'viem/utils'
import {
  assertRequest,
  extract,
  getAction,
  getTransactionError,
} from 'viem/utils'

import {
  SeismicTxExtras,
  TransactionSerializableSeismic,
  serializeSeismicTransaction,
} from '@sviem/chain'
import type {
  AccountNotFoundErrorType,
  AccountTypeNotSupportedErrorType,
} from '@sviem/error/account'
import {
  AccountNotFoundError,
  AccountTypeNotSupportedError,
} from '@sviem/error/account'
import { signSeismicTxTypedData } from '@sviem/signSeismicTypedData'
import type { GetAccountParameter } from '@sviem/viem-internal/account'
import type { ErrorType } from '@sviem/viem-internal/error'
import type { AssertRequestParameters } from '@sviem/viem-internal/request'

export type SendSeismicTransactionRequest<
  chain extends Chain | undefined = Chain | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  _derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>,
> = UnionOmit<FormattedTransactionRequest<_derivedChain>, 'from'> &
  GetTransactionRequestKzgParameter &
  SeismicTxExtras

export type SendSeismicTransactionParameters<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  request extends SendSeismicTransactionRequest<
    chain,
    chainOverride
  > = SendSeismicTransactionRequest<chain, chainOverride>,
> = request &
  GetAccountParameter<account, Account | Address, true, true> &
  GetChainParameter<chain, chainOverride> &
  GetTransactionRequestKzgParameter<request>

export type SendSeismicTransactionReturnType = Hash

export type SendSeismicTransactionErrorType =
  | ParseAccountErrorType
  | GetTransactionErrorReturnType<
      | AccountNotFoundErrorType
      | AccountTypeNotSupportedErrorType
      | AssertCurrentChainErrorType
      | AssertRequestErrorType
      | GetChainIdErrorType
      | PrepareTransactionRequestErrorType
      | SendRawTransactionErrorType
      | RecoverAuthorizationAddressErrorType
      | SignTransactionErrorType
      | RequestErrorType
    >
  | ErrorType

/**
 * Sends a shielded transaction on the Seismic network.
 *
 * This function facilitates sending a transaction that includes shielded inputs such as blobs,
 * authorization lists, and encrypted calldata. The transaction is prepared, signed, and
 * submitted to the network based on the provided parameters.
 *
 * @template TChain - The type of the blockchain chain (extends `Chain` or `undefined`).
 * @template TAccount - The type of the account (extends `Account` or `undefined`).
 * @template TRequest - The specific request type for the transaction.
 * @template TChainOverride - The type of the chain override (extends `Chain` or `undefined`).
 *
 * @param client - The client instance used to execute the transaction, including chain, account,
 * and transport configurations.
 * @param parameters - The transaction parameters, including gas, value, blobs, and other details.
 *
 * @returns A promise that resolves to the result of the shielded transaction submission.
 *
 * @throws {AccountNotFoundError} If no account is provided in the client or parameters.
 * @throws {AccountTypeNotSupportedError} If the account type is unsupported for shielded transactions.
 * @throws {Error} If the `data` is invalid or missing.
 *
 * @remarks
 * - Supports various account types, including `json-rpc` and `local`.
 * - Requires a valid `data` in hexadecimal format.
 * - Throws specific errors for unsupported account types or missing account configurations.
 * - Uses the `sendRawTransaction` method for final transaction submission.
 *
 * @example
 * ```typescript
 * const result = await sendShieldedTransaction(client, {
 *   account: { address: '0x1234...' },
 *   chain: seismicChain,
 *   data: '0xabcdef...',
 *   value: 1000n,
 *   gas: 21000n,
 * });
 * console.log('Transaction hash:', result.hash);
 * ```
 */
export async function sendShieldedTransaction<
  TChain extends Chain | undefined,
  TAccount extends Account,
  const TRequest extends SendSeismicTransactionRequest<TChain, TChainOverride>,
  TChainOverride extends Chain | undefined = undefined,
>(
  client: Client<Transport, TChain, TAccount>,
  parameters: SendSeismicTransactionParameters<
    TChain,
    TAccount,
    TChainOverride,
    TRequest
  >
): Promise<SendSeismicTransactionReturnType> {
  const {
    account: account_ = client.account,
    chain = client.chain,
    accessList,
    authorizationList,
    blobs,
    data,
    gas = 30_000_000,
    gasPrice,
    maxFeePerBlobGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    value,
    encryptionPubkey,
    ...rest
  } = parameters

  if (typeof account_ === 'undefined')
    throw new AccountNotFoundError({
      // TODO: link this
      // docsPath: '/docs/actions/wallet/sendSeismicTransaction',
    })
  const account = account_ ? parseAccount(account_) : null

  try {
    assertRequest(parameters as AssertRequestParameters)

    const to = await (async () => {
      if (parameters.to) return parameters.to
      return undefined
    })()

    if (
      account === null ||
      account?.type === 'local' ||
      account?.type === 'json-rpc'
    ) {
      let chainId: number | undefined
      if (chain !== null) {
        chainId = await getAction(client, getChainId, 'getChainId')({})
        assertCurrentChain({
          currentChainId: chainId,
          chain,
        })
      }

      const chainFormat = client.chain?.formatters?.transactionRequest?.format

      const request = {
        ...extract(rest, { format: chainFormat }),
        accessList,
        authorizationList,
        blobs,
        chainId,
        data,
        from: account?.address,
        gas,
        gasPrice,
        maxFeePerBlobGas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce,
        to,
        value,
        type: 'legacy',
        ...rest,
      } as any

      // @ts-ignore
      const { data: input, ...preparedTx } = await prepareTransactionRequest(
        client,
        request
      )
      const txRequest = {
        input,
        encryptionPubkey,
        ...preparedTx,
      } as any as TransactionSerializableSeismic
      if (account?.type === 'json-rpc') {
        const { typedData, signature } = await signSeismicTxTypedData(
          client,
          txRequest
        )
        // @ts-ignore
        return await sendRawTransaction(client, { typedData, signature })
      } else {
        const serializedTransaction = await account!.signTransaction!(
          txRequest,
          // @ts-ignore
          { serializer: serializeSeismicTransaction }
        )
        return await sendRawTransaction(client, { serializedTransaction })
      }
    }

    if (account?.type === 'smart')
      throw new AccountTypeNotSupportedError({
        metaMessages: ['Consider using the sendUserOperation Action instead.'],
        docsPath: '/docs/actions/bundler/sendUserOperation',
        type: 'smart',
      })

    throw new AccountTypeNotSupportedError({
      docsPath: '/docs/actions/wallet/sendSeismicTransaction',
      type: (account as any)?.type,
    })
  } catch (err) {
    if (err instanceof AccountTypeNotSupportedError) throw err
    throw getTransactionError(err as BaseError, {
      ...parameters,
      account,
      chain: chain || undefined,
    })
  }
}
