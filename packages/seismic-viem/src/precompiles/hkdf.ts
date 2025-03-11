import { Hex, hexToBytes, stringToHex } from 'viem'

import { Precompile, calcLinearGasCostU32 } from '@sviem/precompiles/precompile'

export const HDFK_ADDRESS = '0x68'

export const SHA256_BASE_GAS = 60n
export const SHA256_PER_WORD = 12n

export const HDFK_EXPAND_COST_GAS = 2n * SHA256_BASE_GAS
export const SHARED_SECRET_GAS = 3000n

export const hdfk: Precompile<[string]> = {
  address: HDFK_ADDRESS,
  abi: [
    {
      name: 'hkdfDeriveSymmetricKey',
      inputs: [{ type: 'bytes' }],
      outputs: [{ type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: ([input]: readonly unknown[]) => {
    const linearGasCost = calcLinearGasCostU32({
      bus: 32,
      len: hexToBytes(input as Hex).length,
      base: SHARED_SECRET_GAS,
      word: SHA256_PER_WORD,
    })
    return 2n * linearGasCost + HDFK_EXPAND_COST_GAS
  },
  transformParams: ([input]: [string]) => {
    return [stringToHex(input)]
  },
}
