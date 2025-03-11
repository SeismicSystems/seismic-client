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
  gasLimit: (targs: readonly unknown[]) => bigint
  // Transform from typescript types to abi types
  encodeParams: (args: P) => Hex
  decodeResult: (result: Hex) => R
}

export const callPrecompile = async <P, R>({
  call,
  precompile,
  args,
}: {
  call: (params: CallParameters) => Promise<CallReturnType>
  precompile: Precompile<P, R>
  args: P
}): Promise<R> => {
  const data = precompile.encodeParams(args)
  const result = await call({
    data,
    // gas: precompile.gasLimit(input),
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
