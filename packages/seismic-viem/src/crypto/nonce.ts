import { Hex, bytesToHex } from 'viem'

import { randomBytes } from '@noble/ciphers/webcrypto'

export const randomEncryptionNonce = (): Hex => bytesToHex(randomBytes(12))
