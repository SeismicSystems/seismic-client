import { Hex, decodeAbiParameters, hexToBytes, isHex, stringToHex } from 'viem'

import { Precompile, calcLinearGasCostU32 } from '@sviem/precompiles/precompile'

export const HDFK_ADDRESS = '0x0000000000000000000000000000000000000068'

const SHA256_BASE_GAS = 60n
const SHA256_PER_WORD = 12n

export const HDFK_EXPAND_COST_GAS = 2n * SHA256_BASE_GAS
export const SHARED_SECRET_GAS = 3000n

export const hdfk: Precompile<string | Hex, Hex> = {
  address: HDFK_ADDRESS,
  gasLimit: ([ikmHex]: readonly unknown[]) => {
    const linearGasCost = calcLinearGasCostU32({
      bus: 32,
      len: hexToBytes(ikmHex as Hex).length,
      base: SHARED_SECRET_GAS,
      word: SHA256_PER_WORD,
    })
    return 2n * linearGasCost + HDFK_EXPAND_COST_GAS
  },
  encodeParams: (input) => {
    if (isHex(input)) {
      return input
    }
    return stringToHex(input)
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'bytes32' }], result)
    return output as Hex
  },
}
