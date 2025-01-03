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
  Hex,
  PrepareTransactionRequestErrorType,
  SendRawTransactionErrorType,
  TransactionRequest,
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

import { serializeSeismicTransaction } from '@actions/chain'
import type {
  AccountNotFoundErrorType,
  AccountTypeNotSupportedErrorType,
} from '@actions/error/account'
import {
  AccountNotFoundError,
  AccountTypeNotSupportedError,
} from '@actions/error/account'
import type { GetAccountParameter } from '@actions/viem/account'
import type { ErrorType } from '@actions/viem/error'
import type { AssertRequestParameters } from '@actions/viem/request'

export type SendSeismicTransactionRequest<
  chain extends Chain | undefined = Chain | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  _derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>,
> = UnionOmit<FormattedTransactionRequest<_derivedChain>, 'from'> &
  GetTransactionRequestKzgParameter & {
    seismicInput: Hex
  }

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
 * Sends a Seismic transaction,
 * taking in `seismicInput` as the (ciphered) input
 * to the node.
 */
export async function sendShieldedTransaction<
  TChain extends Chain | undefined,
  TAccount extends Account | undefined,
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
    gas,
    gasPrice,
    maxFeePerBlobGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    value,
    seismicInput,
    ...rest
  } = parameters

  if (typeof account_ === 'undefined')
    throw new AccountNotFoundError({
      docsPath: '/docs/actions/wallet/sendSeismicTransaction',
    })
  const account = account_ ? parseAccount(account_) : null

  try {
    assertRequest(parameters as AssertRequestParameters)

    if (
      !seismicInput ||
      typeof seismicInput !== 'string' ||
      !seismicInput.startsWith('0x')
    ) {
      throw new Error('seismicInput must be a non-empty hex string')
    }

    const to = await (async () => {
      if (parameters.to) return parameters.to
      return undefined
    })()

    if (
      account?.type === 'json-rpc' ||
      account === null ||
      account?.type === 'local'
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
      } as TransactionRequest

      // @ts-ignore
      const preparedTx = await prepareTransactionRequest(client, request)
      const serializedTransaction = await account!.signTransaction!(
        { seismicInput, ...preparedTx },
        { serializer: serializeSeismicTransaction }
      )
      return await sendRawTransaction(client, { serializedTransaction })
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
