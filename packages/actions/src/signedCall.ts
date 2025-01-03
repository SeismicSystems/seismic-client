import type {
  CallParameters,
  CallReturnType,
  Chain,
  Client,
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

import { serializeSeismicTransaction } from '@actions/chain'
import type { ScheduleMulticallParameters } from '@actions/viem/call'
import {
  getRevertErrorData,
  scheduleMulticall,
  serializeStateOverride,
  shouldPerformMulticall,
  toDeploylessCallViaBytecodeData,
  toDeploylessCallViaFactoryData,
} from '@actions/viem/call'
import type { ErrorType } from '@actions/viem/error'
import type { AssertRequestParameters } from '@actions/viem/request'

export type SignedCallParameters<chain extends Chain | undefined> =
  CallParameters<chain> & { seismicInput?: Hex | undefined }

export type SignedCall<chain extends Chain | undefined> = (
  args: SignedCallParameters<chain>
) => Promise<CallReturnType>

export async function signedCall<chain extends Chain | undefined>(
  client: Client<Transport, chain>,
  args: SignedCallParameters<chain>
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
      throw new Error(`Client cannot sign for address ${fromAddress}`)
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
        } as unknown as ScheduleMulticallParameters<chain>)
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
