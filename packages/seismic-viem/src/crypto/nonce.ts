import { bytesToBigInt } from 'viem'

import { randomBytes } from '@noble/ciphers/webcrypto'

export const randomEncryptionNonce = (): bigint =>
  bytesToBigInt(randomBytes(32))
