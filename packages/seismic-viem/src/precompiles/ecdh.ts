import { Address, decodeAbiParameters, hexToBytes } from 'viem'
import { Hex } from 'viem'

import {
  HDFK_EXPAND_COST_GAS,
  SHARED_SECRET_GAS,
} from '@sviem/precompiles/hkdf'
import { Precompile } from '@sviem/precompiles/precompile'

export const ECDH_ADDRESS: Address =
  '0x0000000000000000000000000000000000000065'
const SECRET_KEY_LENGTH = 32
const PUBLIC_KEY_LENGTH = 33

export type EcdhParams = {
  sk: Hex
  pk: Hex
}

const validateKey = (key: Hex, sk: boolean) => {
  const bytes = hexToBytes(key)
  const expectedLength = sk ? SECRET_KEY_LENGTH : PUBLIC_KEY_LENGTH
  if (bytes.length !== expectedLength) {
    throw new Error(
      `Invalid ${sk ? 'secret' : 'public'} key: must be ${expectedLength} bytes (received ${bytes.length})`
    )
  }
}

export const ecdh: Precompile<EcdhParams, Hex> = {
  address: ECDH_ADDRESS,
  gasLimit: () => SHARED_SECRET_GAS + HDFK_EXPAND_COST_GAS,
  encodeParams: ({ sk, pk }) => {
    validateKey(sk, true)
    validateKey(pk, false)
    return `${sk}${pk.slice(2)}`
  },
  decodeResult: (result: Hex) => {
    const [output] = decodeAbiParameters([{ type: 'bytes32' }], result)
    return output as Hex
  },
}
