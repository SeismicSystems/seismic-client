import { keccak256, stringToBytes } from 'viem'
import { Hex } from 'viem'

import { Precompile } from '@sviem/precompiles/precompile'

export const SECP256K1_SIG_ADDRESS = '0x69'
export const SECP256K1_SIG_BASE_GAS = 3000n

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
  transformParams: ([secretKey, message]: [Hex, string]) => {
    return [secretKey, keccak256(stringToBytes(message))] as readonly unknown[]
  },
}
