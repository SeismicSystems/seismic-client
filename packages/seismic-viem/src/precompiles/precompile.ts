import {
  Address,
  CallParameters,
  CallReturnType,
  Hex,
  hexToBytes,
  pad,
} from 'viem'

export type Precompile<P, R> = {
  address: Address
  // return the gas cost given transformed args
  gasLimit: (args: P) => bigint
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
  const result = await client.call({
    data,
    // gas: precompile.gasLimit(args),
    to: precompile.address,
  })
  if (!result.data) {
    throw new Error('No data returned from precompile')
  }
  if (hexToBytes(result.data).length < 32) {
    // RNG gives back length ${size} bytes, but viem wants 32+
    result.data = pad(result.data)
  }
  return precompile.decodeResult(result.data)
}

export const calcLinearGasCostU32 = ({
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
