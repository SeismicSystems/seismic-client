import {
  Hex,
  decodeAbiParameters,
  encodeAbiParameters,
  numberToHex,
} from 'viem'

import { Precompile } from '@sviem/precompiles/precompile'

export const RNG_ADDRESS = '0x0000000000000000000000000000000000000064'
export const RNG_GAS = 3505n

export const rng: Precompile<bigint | number, bigint> = {
  address: RNG_ADDRESS,
  gasLimit: () => RNG_GAS,
  encodeParams: (length) => {
    if (typeof length !== 'bigint' && typeof length !== 'number') {
      throw new Error('Invalid length: must be a number or bigint')
    }
    const value = numberToHex(length, { size: 4 })
    return encodeAbiParameters([{ name: 'length', type: 'bytes4' }], [value])
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'uint256' }], result)
    return output as bigint
  },
}
