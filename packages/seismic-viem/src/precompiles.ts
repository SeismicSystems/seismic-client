import {
  Abi,
  CallParameters,
  CallReturnType,
  Hex,
  ReadContractReturnType,
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  stringToBytes,
} from 'viem'

export type Precompile<P> = {
  address: Hex
  abi: Abi
  gas: (args: P) => bigint
  formatInput: (args: P) => readonly unknown[]
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
  const input = precompile.formatInput(args)
  const data = encodeAbiParameters(precompile.abi, input)
  const result = await call({
    data,
    gas: precompile.gas(args),
    to: precompile.address,
  })
  if (!result.data) {
    throw new Error('No data returned from precompile')
  }
  const decoded = decodeAbiParameters(precompile.abi, result.data)
  return decoded as ReadContractReturnType<F['abi']>
}

export const RNG_ADDRESS = '0x64'
export const ECDH_ADDRESS = '0x65'
export const AES_GCM_ENCRYPTION_ADDRESS = '0x66'
export const AES_GCM_DECRYPTION_ADDRESS = '0x67'
export const HDFK_ADDRESS = '0x68'
export const SECP256K1_SIG_ADDRESS = '0x69'

export const RNG_GAS = 3505n
export const SHARED_SECRET_GAS = 3000n
export const SHA256_BASE_GAS = 60n
export const SHA256_PER_WORD = 12n

export const SECP256K1_SIG_BASE_GAS = 3000n

export const rng: Precompile<[bigint]> = {
  address: RNG_ADDRESS,
  abi: [
    {
      name: 'rng',
      inputs: [{ type: 'uint32' }],
      outputs: [{ type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: (args) => RNG_GAS,
  formatInput: (args) => args,
}

export const ecdh: Precompile<[Hex, string]> = {
  address: ECDH_ADDRESS,
  abi: [],
  gas: () => SHARED_SECRET_GAS + 2n * SHA256_BASE_GAS,
  formatInput: (args) => args,
}

export const aesGcmEncryption: Precompile<[Hex, Hex]> = {
  address: AES_GCM_ENCRYPTION_ADDRESS,
  abi: [],
  gas: () => 3000n + 2n * SHA256_BASE_GAS,
  formatInput: (args) => args,
}

export const aesGcmDecryption: Precompile<[Hex, Hex]> = {
  address: AES_GCM_DECRYPTION_ADDRESS,
  abi: [],
  gas: () => 3000n + 2n * SHA256_BASE_GAS,
  formatInput: (args) => args,
}

export const hdfk: Precompile<[Hex, Hex]> = {
  address: HDFK_ADDRESS,
  abi: [],
  gas: () => 3000n + 2n * SHA256_BASE_GAS,
  formatInput: (args) => args,
}

export const secp256k1Signature: Precompile<[Hex, Hex]> = {
  address: SECP256K1_SIG_ADDRESS,
  abi: [
    {
      name: 'secp256k1Signature',
      inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
      outputs: [{ type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: () => SECP256K1_SIG_BASE_GAS,
  formatInput: ([secretKey, message]: [Hex, string]) => {
    return [secretKey, keccak256(stringToBytes(message))]
  },
}
