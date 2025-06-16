import type {
  AccountStateConflictErrorType,
  Address,
  CallParameters,
  Chain,
  Client,
  Hex,
  InvalidAddressErrorType,
  NumberToHexErrorType,
  RpcAccountStateOverride,
  RpcStateMapping,
  RpcStateOverride,
  StateAssignmentConflictErrorType,
  StateMapping,
  StateOverride,
  TransactionRequest,
  Transport,
} from 'viem'
import {
  AccountStateConflictError,
  BaseError,
  ClientChainNotConfiguredError,
  InvalidAddressError,
  RawContractError,
  StateAssignmentConflictError,
  decodeFunctionResult,
  deploylessCallViaBytecodeBytecode,
  deploylessCallViaFactoryBytecode,
  encodeDeployData,
  encodeFunctionData,
  getChainContractAddress,
  isAddress,
  multicall3Abi,
  numberToHex,
  parseAbi,
} from 'viem'

import {
  type PromiseWithResolvers,
  withResolvers,
} from '@sviem/viem-internal/withResolvers.ts'

// We only want to perform a scheduled multicall if:
// - The request has calldata,
// - The request has a target address,
// - The target address is not already the aggregate3 signature,
// - The request has no other properties (`nonce`, `gas`, etc cannot be sent with a multicall).
const aggregate3Signature = '0x82ad56cb'
export function shouldPerformMulticall({
  request,
}: {
  request: TransactionRequest
}) {
  const { data, to, ...request_ } = request
  if (!data) return false
  if (data.startsWith(aggregate3Signature)) return false
  if (!to) return false
  if (
    Object.values(request_).filter((x) => typeof x !== 'undefined').length > 0
  )
    return false
  return true
}

type SerializeStateMappingParameters = StateMapping | undefined

type InvalidBytesLengthErrorType = InvalidBytesLengthError & {
  name: 'InvalidBytesLengthError'
}
class InvalidBytesLengthError extends BaseError {
  constructor({
    size,
    targetSize,
    type,
  }: {
    size: number
    targetSize: number
    type: 'hex' | 'bytes'
  }) {
    super(
      `${type.charAt(0).toUpperCase()}${type
        .slice(1)
        .toLowerCase()} is expected to be ${targetSize} ${type} long, but is ${size} ${type} long.`,
      { name: 'InvalidBytesLengthError' }
    )
  }
}

function serializeStateMapping(
  stateMapping: SerializeStateMappingParameters
): RpcStateMapping | undefined {
  if (!stateMapping || stateMapping.length === 0) return undefined
  return stateMapping.reduce((acc, { slot, value }) => {
    if (slot.length !== 66)
      throw new InvalidBytesLengthError({
        size: slot.length,
        targetSize: 66,
        type: 'hex',
      })
    if (value.length !== 66)
      throw new InvalidBytesLengthError({
        size: value.length,
        targetSize: 66,
        type: 'hex',
      })
    acc[slot] = value
    return acc
  }, {} as RpcStateMapping)
}

type SerializeAccountStateOverrideParameters = Omit<
  StateOverride[number],
  'address'
>

function serializeAccountStateOverride(
  parameters: SerializeAccountStateOverrideParameters
): RpcAccountStateOverride {
  const { balance, nonce, state, stateDiff, code } = parameters
  const rpcAccountStateOverride: RpcAccountStateOverride = {}
  if (code !== undefined) rpcAccountStateOverride.code = code
  if (balance !== undefined)
    rpcAccountStateOverride.balance = numberToHex(balance)
  if (nonce !== undefined) rpcAccountStateOverride.nonce = numberToHex(nonce)
  if (state !== undefined)
    rpcAccountStateOverride.state = serializeStateMapping(state)
  if (stateDiff !== undefined) {
    if (rpcAccountStateOverride.state) throw new StateAssignmentConflictError()
    rpcAccountStateOverride.stateDiff = serializeStateMapping(stateDiff)
  }
  return rpcAccountStateOverride
}

type SerializeStateOverrideParameters = StateOverride | undefined

type SerializeStateMappingErrorType = InvalidBytesLengthErrorType

type SerializeAccountStateOverrideErrorType =
  | NumberToHexErrorType
  | StateAssignmentConflictErrorType
  | SerializeStateMappingErrorType

export type SerializeStateOverrideErrorType =
  | InvalidAddressErrorType
  | AccountStateConflictErrorType
  | SerializeAccountStateOverrideErrorType

export function serializeStateOverride(
  parameters?: SerializeStateOverrideParameters
): RpcStateOverride | undefined {
  if (!parameters) return undefined
  const rpcStateOverride: RpcStateOverride = {}
  for (const { address, ...accountState } of parameters) {
    if (!isAddress(address, { strict: false }))
      throw new InvalidAddressError({ address })
    if (rpcStateOverride[address])
      throw new AccountStateConflictError({ address: address })
    rpcStateOverride[address] = serializeAccountStateOverride(accountState)
  }
  return rpcStateOverride
}

export type ScheduleMulticallParameters<chain extends Chain | undefined> = Pick<
  CallParameters<chain>,
  'blockNumber' | 'blockTag'
> & {
  data: Hex
  multicallAddress?: Address | undefined
  to: Address
}

export async function scheduleMulticall<chain extends Chain | undefined>(
  client: Client<Transport>,
  args: ScheduleMulticallParameters<chain>
) {
  const { batchSize = 1024, wait = 0 } =
    typeof client.batch?.multicall === 'object' ? client.batch.multicall : {}
  const {
    blockNumber,
    blockTag = 'latest',
    data,
    multicallAddress: multicallAddress_,
    to,
  } = args

  let multicallAddress = multicallAddress_
  if (!multicallAddress) {
    if (!client.chain) throw new ClientChainNotConfiguredError()

    multicallAddress = getChainContractAddress({
      blockNumber,
      chain: client.chain,
      contract: 'multicall3',
    })
  }

  const blockNumberHex = blockNumber ? numberToHex(blockNumber) : undefined
  const block = blockNumberHex || blockTag

  const { schedule } = createBatchScheduler({
    id: `${client.uid}.${block}`,
    wait,
    shouldSplitBatch(args) {
      const size = args.reduce((size, { data }) => size + (data.length - 2), 0)
      return size > batchSize * 2
    },
    fn: async (
      requests: {
        data: Hex
        to: Address
      }[]
    ) => {
      const calls = requests.map((request) => ({
        allowFailure: true,
        callData: request.data,
        target: request.to,
      }))

      const calldata = encodeFunctionData({
        abi: multicall3Abi,
        args: [calls],
        functionName: 'aggregate3',
      })

      const data = await client.request({
        method: 'eth_call',
        params: [
          {
            data: calldata,
            to: multicallAddress,
          },
          block,
        ],
      })

      return decodeFunctionResult({
        abi: multicall3Abi,
        args: [calls],
        functionName: 'aggregate3',
        data: data || '0x',
      })
    },
  })

  const [{ returnData, success }] = await schedule({ data, to })

  if (!success) throw new RawContractError({ data: returnData })
  if (returnData === '0x') return { data: undefined }
  return { data: returnData }
}

export type ErrorType<name extends string = 'Error'> = Error & { name: name }

export function toDeploylessCallViaBytecodeData(parameters: {
  code: Hex
  data: Hex
}) {
  const { code, data } = parameters
  return encodeDeployData({
    abi: parseAbi(['constructor(bytes, bytes)']),
    bytecode: deploylessCallViaBytecodeBytecode,
    args: [code, data],
  })
}

export function toDeploylessCallViaFactoryData(parameters: {
  data: Hex
  factory: Address
  factoryData: Hex
  to: Address
}) {
  const { data, factory, factoryData, to } = parameters
  return encodeDeployData({
    abi: parseAbi(['constructor(address, bytes, address, bytes)']),
    bytecode: deploylessCallViaFactoryBytecode,
    args: [to, data, factory, factoryData],
  })
}

export function getRevertErrorData(err: unknown) {
  if (!(err instanceof BaseError)) return undefined
  const error = err.walk() as RawContractError
  return typeof error?.data === 'object' ? error.data?.data : error.data
}

type Resolved<returnType extends readonly unknown[] = any> = [
  result: returnType[number],
  results: returnType,
]

type BatchResultsCompareFn<result = unknown> = (a: result, b: result) => number

type CreateBatchSchedulerArguments<
  parameters = unknown,
  returnType extends readonly unknown[] = readonly unknown[],
> = {
  fn: (args: parameters[]) => Promise<returnType>
  id: number | string
  shouldSplitBatch?: ((args: parameters[]) => boolean) | undefined
  wait?: number | undefined
  sort?: BatchResultsCompareFn<returnType[number]> | undefined
}

type CreateBatchSchedulerReturnType<
  parameters = unknown,
  returnType extends readonly unknown[] = readonly unknown[],
> = {
  flush: () => void
  schedule: parameters extends undefined
    ? (args?: parameters | undefined) => Promise<Resolved<returnType>>
    : (args: parameters) => Promise<Resolved<returnType>>
}

type SchedulerItem = {
  args: unknown
  resolve: PromiseWithResolvers<unknown>['resolve']
  reject: PromiseWithResolvers<unknown>['reject']
}

const schedulerCache = /*#__PURE__*/ new Map<number | string, SchedulerItem[]>()

export function createBatchScheduler<
  parameters,
  returnType extends readonly unknown[],
>({
  fn,
  id,
  shouldSplitBatch,
  wait = 0,
  sort,
}: CreateBatchSchedulerArguments<
  parameters,
  returnType
>): CreateBatchSchedulerReturnType<parameters, returnType> {
  const exec = async () => {
    const scheduler = getScheduler()
    flush()

    const args = scheduler.map(({ args }) => args)

    if (args.length === 0) return

    fn(args as parameters[])
      .then((data) => {
        if (sort && Array.isArray(data)) data.sort(sort)
        for (let i = 0; i < scheduler.length; i++) {
          const { resolve } = scheduler[i]
          resolve?.([data[i], data])
        }
      })
      .catch((err) => {
        for (let i = 0; i < scheduler.length; i++) {
          const { reject } = scheduler[i]
          reject?.(err)
        }
      })
  }

  const flush = () => schedulerCache.delete(id)

  const getBatchedArgs = () =>
    getScheduler().map(({ args }) => args) as parameters[]

  const getScheduler = () => schedulerCache.get(id) || []

  const setScheduler = (item: SchedulerItem) =>
    schedulerCache.set(id, [...getScheduler(), item])

  return {
    flush,
    async schedule(args: parameters) {
      const { promise, resolve, reject } = withResolvers()

      const split = shouldSplitBatch?.([...getBatchedArgs(), args])

      if (split) exec()

      const hasActiveScheduler = getScheduler().length > 0
      if (hasActiveScheduler) {
        setScheduler({ args, resolve, reject })
        return promise
      }

      setScheduler({ args, resolve, reject })
      setTimeout(exec, wait)
      return promise
    },
  } as unknown as CreateBatchSchedulerReturnType<parameters, returnType>
}
