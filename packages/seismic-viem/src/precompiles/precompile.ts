import { Address, CallParameters, CallReturnType, Hex, hexToBytes } from 'viem'

// every call costs at least this much gas
const BASE_TX_GAS_COST = 21_000n

// calldata costs 4 gas per zero byte & 16 gas per non-zero byte
const calldataGasCost = (data: Hex): bigint => {
  const dataBytes = hexToBytes(data)
  const nonZeroBytes = dataBytes.filter((b) => b !== 0).length
  return 4n * BigInt(dataBytes.length) + 12n * BigInt(nonZeroBytes)
}

export type Precompile<P, R> = {
  address: Address
  // return the gas cost given transformed args
  gasCost: (args: P) => bigint
  // Transform from typescript types to abi types
  encodeParams: (args: P) => Hex
  decodeResult: (result: Hex) => R
}

export type CallClient = {
  call: (params: CallParameters) => Promise<CallReturnType>
}

export const callPrecompile = async <P, R>({
  client,
  precompile,
  args,
}: {
  client: CallClient
  precompile: Precompile<P, R>
  args: P
}): Promise<R> => {
  const data = precompile.encodeParams(args)
  const gas =
    BASE_TX_GAS_COST + calldataGasCost(data) + precompile.gasCost(args)
  const result = await client.call({
    data,
    gas,
    to: precompile.address,
  })
  if (!result.data) {
    throw new Error('No data returned from precompile')
  }
  return precompile.decodeResult(result.data)
}

export const calcLinearGasCost = ({
  bus,
  len,
  base,
  word,
}: {
  bus: number
  len: number
  base: bigint
  word: bigint
}): bigint => {
  const wordsCount = BigInt(Math.ceil(len / bus))
  return wordsCount * word + base
}

export const calcLinearGasCostU32 = ({
  len,
  base,
  word,
}: {
  len: number
  base: bigint
  word: bigint
}): bigint => {
  const wordsCount = BigInt(Math.ceil(len / 32))
  return wordsCount * word + base
}
