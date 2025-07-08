import { Hex, bytesToHex, trim } from 'viem'

import { randomBytes } from '@noble/ciphers/webcrypto'

export type EncryptionNonce = number | bigint | Hex

export const randomEncryptionNonce = (): Hex => {
  let nonce = bytesToHex(randomBytes(12))
  while (nonce != trim(nonce)) {
    /* 
    TODO: this is a temporary fix.

    RLP decoding fails because nonces are treated as uints and not bytes,
    hence they cannot have leading zeroes.
    
    But we require exactly 12 bytes for the nonce

    If nonce != trim(nonce), then the nonce has leading zeroes and is not valid.

    This happens 1/256 times, so in that case we just try again
    until it's fixed in (presumably) seismic-alloy
    */
    nonce = bytesToHex(randomBytes(12))
  }
  return nonce
}
