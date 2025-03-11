import { hexToBytes } from 'viem'
import { Hex } from 'viem'

import {
  HDFK_EXPAND_COST_GAS,
  SHARED_SECRET_GAS,
} from '@sviem/precompiles/hkdf'
import { Precompile } from '@sviem/precompiles/precompile'

export const ECDH_ADDRESS = '0x65'

export const ecdh: Precompile<[Hex, Hex]> = {
  address: ECDH_ADDRESS,
  abi: [
    {
      name: 'ecdhSymmetricKey',
      inputs: [
        { name: 'secretKey', type: 'bytes32' },
        { name: 'publicKey', type: 'bytes32' },
      ],
      outputs: [{ type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: () => SHARED_SECRET_GAS + HDFK_EXPAND_COST_GAS,
  transformParams: ([sk, pk]: readonly unknown[]) => {
    const skHex = sk as Hex
    const pkHex = pk as Hex
    const skBytes = hexToBytes(skHex)
    const pkBytes = hexToBytes(pkHex)
    if (skBytes.length !== 32) {
      throw new Error(
        `Invalid secret key: must be 32 bytes (received ${skBytes.length})`
      )
    }
    if (pkBytes.length !== 32) {
      throw new Error(
        `Invalid public key: must be 32 bytes (received ${pkBytes.length})`
      )
    }
    return [skHex, pkHex]
  },
}
