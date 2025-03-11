import {
  Signature,
  bytesToHex,
  bytesToNumber,
  encodeAbiParameters,
  hashMessage,
  hexToBytes,
} from 'viem'
import { Hex } from 'viem'

import { Precompile } from '@sviem/precompiles/precompile'

export const SECP256K1_SIG_ADDRESS =
  '0x0000000000000000000000000000000000000069'
export const SECP256K1_SIG_BASE_GAS = 3000n
export type Secp256K1SigParams = { sk: Hex; message: string }

export const secp256k1Signature: Precompile<Secp256K1SigParams, Signature> = {
  address: SECP256K1_SIG_ADDRESS,
  gasLimit: () => SECP256K1_SIG_BASE_GAS,
  encodeParams: ({ sk, message }) => {
    const params = [
      { name: 'sk', type: 'bytes32' },
      { name: 'messageHash', type: 'bytes32' },
    ]
    const skHex = sk as Hex
    return encodeAbiParameters(params, [skHex, hashMessage(message)])
  },
  decodeResult: (result: Hex) => {
    const sigBytes = hexToBytes(result)
    const r = bytesToHex(sigBytes.slice(0, 32))
    const s = bytesToHex(sigBytes.slice(32, 64))
    const yParity = bytesToNumber(sigBytes.slice(64, 66))
    return { r, s, yParity }
  },
}
