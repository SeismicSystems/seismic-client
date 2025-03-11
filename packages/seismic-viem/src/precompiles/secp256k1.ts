import {
  AbiParameter,
  encodeAbiParameters,
  isHex,
  keccak256,
  stringToBytes,
} from 'viem'
import { Hex } from 'viem'

import { Precompile } from '@sviem/precompiles/precompile'

export const SECP256K1_SIG_ADDRESS =
  '0x0000000000000000000000000000000000000069'
export const SECP256K1_SIG_BASE_GAS = 3000n

export type Secp256K1SigParams = {
  sk: Hex
  message: string | Hex
}

export const secp256k1Signature: Precompile<Secp256K1SigParams, Hex> = {
  address: SECP256K1_SIG_ADDRESS,
  abi: {
    name: 'secp256k1Signature',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  gasLimit: () => SECP256K1_SIG_BASE_GAS,
  encodeParams: ({ sk, message }, params: readonly AbiParameter[]) => {
    const skHex = sk as Hex
    if (isHex(message)) {
      return encodeAbiParameters(params, [skHex, message])
    }
    return encodeAbiParameters(params, [
      skHex,
      keccak256(stringToBytes(message)),
    ])
  },
  decodeResult: ([output]: readonly unknown[]) => output as Hex,
}
