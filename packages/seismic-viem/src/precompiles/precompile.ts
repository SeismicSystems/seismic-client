import {
  Abi,
  CallParameters,
  CallReturnType,
  Hex,
  ReadContractReturnType,
  decodeAbiParameters,
  encodeAbiParameters,
} from 'viem'

export type Precompile<P> = {
  address: Hex
  abi: Abi
  // return the gas cost given transformed args
  gas: (targs: readonly unknown[]) => bigint
  // Transform from typescript types to abi types
  transformParams: (args: P) => readonly unknown[]
}

export const callPrecompile = async <P, F extends Precompile<P>>({
  call,
  precompile,
  args,
}: {
  call: (params: CallParameters) => Promise<CallReturnType>
  precompile: F
  args: P
}): Promise<ReadContractReturnType<F['abi']>> => {
  const input = precompile.transformParams(args)
  const data = encodeAbiParameters(precompile.abi, input)
  const result = await call({
    data,
    gas: precompile.gas(input),
    to: precompile.address,
  })
  if (!result.data) {
    throw new Error('No data returned from precompile')
  }
  const decoded = decodeAbiParameters(precompile.abi, result.data)
  return decoded as ReadContractReturnType<F['abi']>
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
