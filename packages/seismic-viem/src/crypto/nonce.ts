import { Hex, bytesToHex, trim } from 'viem'

import { randomBytes } from '@noble/ciphers/webcrypto'

export const randomEncryptionNonce = (): Hex =>
  trim(bytesToHex(randomBytes(12)))
