import type {
  Account,
  CallParameters,
  CallReturnType,
  Chain,
  Hex,
  TransactionRequest,
  Transport,
} from 'viem'
import {
  BaseError,
  ChainDoesNotSupportContract,
  ClientChainNotConfiguredError,
  CounterfactualDeploymentFailedError,
  assertRequest,
  numberToHex,
  offchainLookup,
  offchainLookupSignature,
} from 'viem'
import { prepareTransactionRequest } from 'viem/actions'
import { extract, getCallError, parseAccount } from 'viem/utils'

import { serializeSeismicTransaction } from '@sviem/chain'
import { ShieldedPublicClient, ShieldedWalletClient } from '@sviem/client'
import { SignedCallError } from '@sviem/error/signedCall'
import type { ScheduleMulticallParameters } from '@sviem/viem-internal/call'
import {
  getRevertErrorData,
  scheduleMulticall,
  serializeStateOverride,
  shouldPerformMulticall,
  toDeploylessCallViaBytecodeData,
  toDeploylessCallViaFactoryData,
} from '@sviem/viem-internal/call'
import type { ErrorType } from '@sviem/viem-internal/error'
import type { AssertRequestParameters } from '@sviem/viem-internal/request'

/**
 * @ignore
 * Represents the parameters for a signed call operation on a blockchain.
 *
 * This type extends the base `CallParameters` type with an additional optional `seismicInput` field,
 * which is used for shielded or specialized operations requiring extra data.
 *
 * @template chain - The blockchain chain type (extends `Chain` or `undefined`).
 *
 * @type {SignedCallParameters} - A combination of:
 * - `CallParameters<chain>`: The standard parameters for a blockchain call.
 * - `seismicInput`: Optional input data in hexadecimal format for advanced operations.
 *
 * @property {Hex | undefined} seismicInput - An optional field for passing additional encrypted or
 * specialized data to the signed call.
 *
 * @example
 * ```typescript
 * const parameters: SignedCallParameters<MyChain> = {
 *   account: { address: '0x1234...' },
 *   to: '0x5678...',
 *   data: '0xdeadbeef...',
 *   value: 1000n,
 *   gas: 21000n,
 *   seismicInput: '0xabcdef123456...',
 * };
 *
 * const result = await signedCall(parameters);
 * console.log('Call result:', result);
 * ```
 */
export type SignedCallParameters<chain extends Chain | undefined> =
  CallParameters<chain> & { seismicInput?: Hex | undefined }

/**
 * @ignore
 * Represents a signed call operation on a blockchain.
 *
 * A signed call is used to securely interact with blockchain functions that require
 * authentication, such as contract calls or transactions.
 *
 * @template chain - The blockchain chain type (extends `Chain` or `undefined`).
 *
 * @param args - The parameters for the signed call, including details such as:
 * - The blockchain account to use for signing.
 * - The contract address, method, and parameters.
 * - Additional transaction-related options (e.g., gas, value).
 *
 * @returns {Promise<CallReturnType>} A promise that resolves to the result of the signed call,
 * including any data returned by the contract or transaction.
 *
 * @example
 * ```typescript
 * const signedCall: SignedCall<MyChain> = async (args) => {
 *   const result = await performSignedCall(args);
 *   return result;
 * };
 *
 * const result = await signedCall({
 *   account: { address: '0x1234...' },
 *   to: '0x5678...',
 *   data: '0xdeadbeef...',
 *   value: 1000n,
 *   gas: 21000n,
 * });
 * console.log('Call result:', result);
 * ```
 */
export type SignedCall<chain extends Chain | undefined> = (
  args: SignedCallParameters<chain>
) => Promise<CallReturnType>

/**
 * Executes a signed Ethereum call or contract deployment.
 *
 * This function facilitates both standard signed calls and deployless calls using
 * either bytecode or a factory. It validates the provided parameters, constructs
 * the transaction request, and signs the transaction with the client's account.
 *
 * @template chain - The type of the blockchain chain (extends `Chain` or `undefined`).
 *
 * @param client - {@link ShieldedPublicClient}
 * @param args - {@link SignedCallParameters}
 *
 * @returns A promise that resolves to the result of the call, including any returned data.
 *
 * @throws {BaseError} If conflicting parameters are provided (e.g., both `code` and `factory`).
 * @throws {SignedCallError} If the client cannot sign for the specified address.
 * @throws {CounterfactualDeploymentFailedError} If a deployless call fails due to counterfactual deployment issues.
 *
 * @remarks
 * - Deployless calls can be made either via bytecode or a factory.
 * - Supports multicall batching if the client is configured accordingly.
 * - The function supports off-chain lookups (CCIP-Read) if enabled on the client.
 *
 * @example
 * ```typescript
 * const result = await signedCall(client, {
 *   to: '0x1234...',
 *   seismicInput: '0xabcdef...',
 * });
 * console.log(result.data);
 * ```
 */
export async function signedCall<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
>(
  client:
    | ShieldedPublicClient<TTransport, TChain, TAccount>
    | ShieldedWalletClient<TTransport, TChain, TAccount>,
  args: SignedCallParameters<TChain>
): Promise<CallReturnType> {
  const {
    account: account_ = client.account,
    batch = Boolean(client.batch?.multicall),
    blockNumber,
    blockTag = 'latest',
    accessList,
    blobs,
    code,
    data: data_,
    factory,
    factoryData,
    gas,
    gasPrice,
    maxFeePerBlobGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    to,
    value,
    stateOverride,
    seismicInput,
    ...rest
  } = args
  const account = account_ ? parseAccount(account_) : undefined

  if (code && (factory || factoryData))
    throw new BaseError(
      'Cannot provide both `code` & `factory`/`factoryData` as parameters.'
    )
  if (code && to)
    throw new BaseError('Cannot provide both `code` & `to` as parameters.')

  // Check if the call is deployless via bytecode.
  const deploylessCallViaBytecode = code && data_
  // Check if the call is deployless via a factory.
  const deploylessCallViaFactory = factory && factoryData && to && data_
  const deploylessCall = deploylessCallViaBytecode || deploylessCallViaFactory

  const data = (() => {
    if (deploylessCallViaBytecode)
      return toDeploylessCallViaBytecodeData({
        code,
        data: data_,
      })
    if (deploylessCallViaFactory)
      return toDeploylessCallViaFactoryData({
        data: data_,
        factory,
        factoryData,
        to,
      })
    return data_
  })()

  try {
    assertRequest(args as AssertRequestParameters)

    const blockNumberHex = blockNumber ? numberToHex(blockNumber) : undefined
    const block = blockNumberHex || blockTag

    const rpcStateOverride = serializeStateOverride(stateOverride)

    const chainFormat = client.chain?.formatters?.transactionRequest?.format

    const fromAddress = account?.address
    if (fromAddress && fromAddress !== client.account?.address) {
      throw new SignedCallError({
        // TODO: link this
        // docsPath: 'docs/actions/public/signedCall',
        reason: `Client cannot sign for address ${fromAddress}`,
      })
    }

    const request = {
      // Pick out extra data that might exist on the chain's transaction request type.
      ...extract(rest, { format: chainFormat }),
      from: fromAddress,
      accessList,
      blobs,
      data,
      gas,
      gasPrice,
      maxFeePerBlobGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      to: deploylessCall ? undefined : to,
      value,
    } as TransactionRequest

    if (batch && shouldPerformMulticall({ request }) && !rpcStateOverride) {
      try {
        return await scheduleMulticall(client, {
          ...request,
          blockNumber,
          blockTag,
        } as unknown as ScheduleMulticallParameters<TChain>)
      } catch (err) {
        if (
          !(err instanceof ClientChainNotConfiguredError) &&
          !(err instanceof ChainDoesNotSupportContract)
        )
          throw err
      }
    }

    // @ts-ignore
    const preparedTx = await prepareTransactionRequest(client, request)
    const serializedTransaction = await client.account!.signTransaction!(
      { seismicInput, ...preparedTx },
      { serializer: serializeSeismicTransaction }
    )

    // @ts-ignore
    const response: Hex = await client.request({
      method: 'eth_call',
      params: [serializedTransaction, block],
      // NOTE: not supporting state override for signed calls
      // params: rpcStateOverride
      //   ? [
      //       request as ExactPartial<RpcTransactionRequest>,
      //       block,
      //       rpcStateOverride,
      //     ]
      //   : [request as ExactPartial<RpcTransactionRequest>, block],
    })
    if (response === '0x') return { data: undefined }
    return { data: response }
  } catch (err) {
    const data = getRevertErrorData(err)

    // Check for CCIP-Read offchain lookup signature.
    if (
      client.ccipRead !== false &&
      data?.slice(0, 10) === offchainLookupSignature &&
      to
    )
      return { data: await offchainLookup(client, { data, to }) }

    // Check for counterfactual deployment error.
    if (deploylessCall && data?.slice(0, 10) === '0x101bb98d')
      throw new CounterfactualDeploymentFailedError({ factory })

    throw getCallError(err as ErrorType, {
      ...args,
      account,
      chain: client.chain,
    })
  }
}
